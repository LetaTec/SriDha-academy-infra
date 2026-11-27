import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import type { AppContext } from '../../app/context.js';
import { loadConfig } from '../../config/env.js';
import type { Database } from '../../db/client.js';
import { openApplicationDatabase } from '../../db/startup.js';
import { ApiError } from '../../http/errors.js';
import type { Mailer } from '../../mail/mailer.js';
import {
  asPostgresAdmin,
  postgresSuite,
  postgresUrl,
} from '../../test/postgres.js';
import { confirmSignUp, requestSignUp } from './auth.service.js';

// Sign-up codes on a real PostgreSQL server, as the restricted application
// role: requests that truly run at the same time (PGlite runs one at a
// time). A code is used once, every try is counted, and a checkout buyer's
// record is claimed once.

// Enough hashing threads that simultaneous requests finish their scrypt
// hash together and really race (Node's default of 4 staggers them). Set
// before anything here uses the thread pool, which starts on first use.
process.env.UV_THREADPOOL_SIZE ??= '32';

const local = { mode: 'disable' as const, ca: null };
const NOW = new Date('2026-10-10T09:00:00Z');
const PASSWORD = 'correct-horse-1';

describe(
  'Sign-up codes on real PostgreSQL',
  postgresSuite('signUp.postgres'),
  () => {
    const suffix = randomBytes(5).toString('hex');
    const database = `sridha_signup_test_${suffix}`;
    const password = randomBytes(18).toString('hex');
    const owner = { name: `sridha_t_sown_${suffix}`, password };
    const app = { name: `sridha_t_sapp_${suffix}`, password };
    let db: Database;
    let context: AppContext;
    const codes = new Map<string, string>();

    const mailer: Mailer = {
      sendPasswordResetCode: async () => {},
      sendSignUpCode: async (email, code) => {
        codes.set(email, code);
      },
      sendAccountExistsNotice: async () => {},
      sendAdminSignInLink: async () => {},
      sendPaymentConfirmation: async () => {},
    };

    const signUpRequest = async (email: string) => {
      await requestSignUp(context, {
        fullName: 'Meera Iyer',
        email,
        password: PASSWORD,
      });
      // The code is sent without waiting for the provider
      await new Promise(resolve => setImmediate(resolve));
      const code = codes.get(email);
      assert.ok(code, 'a code was sent');
      return code;
    };

    const outcomeOf = (settled: PromiseSettledResult<unknown>) =>
      settled.status === 'fulfilled'
        ? 'SIGNED_UP'
        : settled.reason instanceof ApiError
          ? settled.reason.code
          : `UNEXPECTED ${String(settled.reason)}`;

    const countUsers = async (email: string) =>
      Number(
        (
          await db.get<{ n: string | number }>(
            'SELECT COUNT(*) AS n FROM users WHERE email = $1',
            [email],
          )
        )?.n ?? 0,
      );

    before(async () => {
      for (const user of [owner, app]) {
        await asPostgresAdmin(
          `CREATE ROLE ${user.name} LOGIN PASSWORD '${user.password}'`,
        );
      }
      await asPostgresAdmin(`CREATE DATABASE ${database} OWNER ${owner.name}`);
      db = await openApplicationDatabase({
        databaseUrl: postgresUrl(database, app),
        migrationDatabaseUrl: postgresUrl(database, owner),
        databaseTls: local,
        pgMaxConnections: 20,
      });
      context = {
        db,
        config: loadConfig({
          NODE_ENV: 'test',
          WEB_ORIGIN: 'http://localhost:5173',
        }),
        mailer,
        now: () => NOW,
      };
    });

    after(async () => {
      await db?.close();
      await asPostgresAdmin(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
      for (const user of [owner, app]) {
        await asPostgresAdmin(`DROP ROLE IF EXISTS ${user.name}`);
      }
    });

    it('creates one account when the same code is confirmed 20 times at once', async () => {
      const email = `race.${suffix}@example.com`;
      const code = await signUpRequest(email);

      const settled = await Promise.allSettled(
        Array.from({ length: 20 }, () =>
          confirmSignUp(context, { email, code, password: PASSWORD }),
        ),
      );
      const outcomes = settled.map(outcomeOf);
      assert.equal(
        outcomes.filter(outcome => outcome === 'SIGNED_UP').length,
        1,
        JSON.stringify(outcomes),
      );
      // Every other request is told the code no longer works
      assert.ok(
        outcomes.every(
          outcome =>
            outcome === 'SIGNED_UP' || outcome === 'INVALID_SIGN_UP_CODE',
        ),
        JSON.stringify(outcomes),
      );
      assert.equal(await countUsers(email), 1);
    });

    it('claims a checkout buyer once when the code is confirmed 20 times at once', async () => {
      const email = `buyer.${suffix}@example.com`;
      await db.query(
        `INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
         VALUES ($1, $2, NULL, 'STUDENT', $3, $3)`,
        [`usr_pg_buyer_${suffix}`, email, NOW.toISOString()],
      );
      const code = await signUpRequest(email);

      const settled = await Promise.allSettled(
        Array.from({ length: 20 }, () =>
          confirmSignUp(context, { email, code, password: PASSWORD }),
        ),
      );
      const outcomes = settled.map(outcomeOf);
      assert.equal(
        outcomes.filter(outcome => outcome === 'SIGNED_UP').length,
        1,
        JSON.stringify(outcomes),
      );
      assert.ok(
        outcomes.every(
          outcome =>
            outcome === 'SIGNED_UP' || outcome === 'INVALID_SIGN_UP_CODE',
        ),
        JSON.stringify(outcomes),
      );
      const claimed = settled.flatMap(result =>
        result.status === 'fulfilled' ? [result.value.id] : [],
      );
      assert.deepEqual(claimed, [`usr_pg_buyer_${suffix}`]);
      assert.equal(await countUsers(email), 1);
    });

    it('sends one code when 20 sign-up requests for an email arrive at once', async () => {
      // A few rounds, each a fresh email, so a race shows up reliably
      for (let round = 0; round < 3; round += 1) {
        const email = `burst${round}.${suffix}@example.com`;
        let sent = 0;
        const counting: AppContext = {
          ...context,
          mailer: {
            ...mailer,
            sendSignUpCode: async () => {
              sent += 1;
            },
          },
        };
        await Promise.all(
          Array.from({ length: 20 }, () =>
            requestSignUp(counting, {
              fullName: 'Meera Iyer',
              email,
              password: PASSWORD,
            }),
          ),
        );
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(sent, 1, `round ${round}`);
        const rows = await db.get<{ n: string | number }>(
          'SELECT COUNT(*) AS n FROM sign_up_verifications WHERE email = $1',
          [email],
        );
        assert.equal(Number(rows?.n), 1, `round ${round}`);
      }
    });

    it('counts every one of many simultaneous wrong guesses', async () => {
      const email = `guess.${suffix}@example.com`;
      const code = await signUpRequest(email);
      const wrong = String((Number(code) + 1) % 1_000_000).padStart(6, '0');

      await Promise.allSettled(
        Array.from({ length: 12 }, () =>
          confirmSignUp(context, { email, code: wrong, password: PASSWORD }),
        ),
      );
      const row = await db.get<{ attempts: number }>(
        'SELECT attempts FROM sign_up_verifications WHERE email = $1',
        [email],
      );
      assert.equal(Number(row?.attempts), 12);

      // Past the limit, even the right code no longer works
      await assert.rejects(
        confirmSignUp(context, { email, code, password: PASSWORD }),
        (error: unknown) =>
          error instanceof ApiError && error.code === 'INVALID_SIGN_UP_CODE',
      );
      assert.equal(await countUsers(email), 0);
    });
  },
);
