import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import {
  startTestServer,
  TEST_SUPER_ADMIN_EMAIL,
} from '../../test/testServer.js';

// Sign-up proves the email before any account, password or session exists.
// Before this, anyone who knew a checkout buyer's email could sign up with
// it, set a password and see what the buyer had bought.

const PASSWORD = 'correct-horse-1';
const START = new Date('2026-10-10T09:00:00Z');
const MINUTE_MS = 60 * 1000;

type Server = Awaited<ReturnType<typeof startTestServer>>;

describe('student sign-up with an emailed code', () => {
  let server: Server;
  let nowMs = START.getTime();

  before(async () => {
    server = await startTestServer();
    server.clock.now = () => new Date(nowMs);
  });

  // Each test starts well clear of the last one's cooldown and hourly cap
  beforeEach(() => {
    nowMs += 2 * 60 * MINUTE_MS;
  });

  after(async () => {
    await server.close();
  });

  const requestSignUp = (email: string, fullName = 'Meera Iyer') =>
    server.createClient().request('POST', '/api/auth/sign-up', {
      fullName,
      email,
      password: PASSWORD,
    });

  const latestCode = (email: string) =>
    server.sentSignUpCodes.filter(sent => sent.email === email).at(-1)?.code;

  // The confirm repeats the password chosen in step 1, which ties the code
  // to whoever asked for it
  const confirm = (
    email: string,
    code: string,
    client = server.createClient(),
    password = PASSWORD,
  ) =>
    client.request('POST', '/api/auth/sign-up/confirm', {
      email,
      code,
      password,
    });

  const wrongCode = (code: string) =>
    String((Number(code) + 1) % 1_000_000).padStart(6, '0');

  const insertBuyer = (id: string, email: string) =>
    server.db.query(
      `INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
       VALUES ($1, $2, NULL, 'STUDENT', $3, $3)`,
      [id, email, START.toISOString()],
    );

  const passwordHashOf = async (email: string) =>
    (
      await server.db.get<{ password_hash: string | null }>(
        'SELECT password_hash FROM users WHERE email = $1',
        [email],
      )
    )?.password_hash ?? null;

  it('creates nothing until the emailed code is confirmed, then signs the student in', async () => {
    const client = server.createClient();
    const requested = await client.request('POST', '/api/auth/sign-up', {
      fullName: '  Meera Iyer ',
      email: 'Meera@Example.com',
      password: PASSWORD,
    });

    assert.equal(requested.status, 202);
    assert.equal(requested.setCookie, null);
    const before = await server.db.get(
      'SELECT id FROM users WHERE email = $1',
      ['meera@example.com'],
    );
    assert.equal(before ?? null, null, 'no account before the code');

    // The code is stored only as a salted hash, never as the code itself
    const code = latestCode('meera@example.com');
    assert.match(String(code), /^\d{6}$/);
    const stored = await server.db.get<{
      code_hash: string;
      password_hash: string;
    }>(
      'SELECT code_hash, password_hash FROM sign_up_verifications WHERE email = $1',
      ['meera@example.com'],
    );
    assert.notEqual(stored?.code_hash, code);
    assert.match(String(stored?.code_hash), /^[0-9a-f]{64}$/);
    assert.match(String(stored?.password_hash), /^scrypt\$/);

    const confirmed = await confirm('meera@example.com', String(code), client);
    assert.equal(confirmed.status, 201);
    assert.equal(confirmed.body.user.email, 'meera@example.com');
    assert.equal(confirmed.body.user.name, 'Meera Iyer');
    assert.equal(confirmed.body.user.role, 'STUDENT');
    // Stays signed in on this device (a lasting cookie, not a browser one)
    assert.match(confirmed.setCookie ?? '', /leta_session=.+; .*HttpOnly/i);
    assert.match(confirmed.setCookie ?? '', /Max-Age=|Expires=/i);

    const session = await client.request('GET', '/api/auth/session');
    assert.equal(session.status, 200);
    assert.equal(session.body.user.name, 'Meera Iyer');

    const login = await server
      .createClient()
      .request('POST', '/api/auth/login', {
        email: 'meera@example.com',
        password: PASSWORD,
        rememberMe: true,
      });
    assert.equal(login.status, 200);
  });

  it("does not let someone who only knows a buyer's email take over their purchases", async () => {
    await insertBuyer('usr_buyer_takeover', 'buyer.takeover@example.com');
    const attacker = server.createClient();

    const requested = await attacker.request('POST', '/api/auth/sign-up', {
      fullName: 'Not The Buyer',
      email: 'buyer.takeover@example.com',
      password: 'attacker-pass-9',
    });
    assert.equal(requested.status, 202);
    assert.equal(requested.setCookie, null);

    // Not signed in, and the buyer record has no password anyone could use
    assert.equal(
      (await attacker.request('GET', '/api/auth/session')).status,
      401,
    );
    assert.equal(await passwordHashOf('buyer.takeover@example.com'), null);
    const login = await server
      .createClient()
      .request('POST', '/api/auth/login', {
        email: 'buyer.takeover@example.com',
        password: 'attacker-pass-9',
        rememberMe: false,
      });
    assert.equal(login.status, 401);

    // The code went to the buyer's inbox; without it, guessing fails
    const code = String(latestCode('buyer.takeover@example.com'));
    const guess = await confirm(
      'buyer.takeover@example.com',
      wrongCode(code),
      attacker,
    );
    assert.equal(guess.status, 400);
    assert.equal(guess.body.code, 'INVALID_SIGN_UP_CODE');
    assert.equal(guess.setCookie, null);
    assert.equal(await passwordHashOf('buyer.takeover@example.com'), null);
  });

  it("never puts an attacker's password on the account when the owner confirms the code", async () => {
    // Found in review: the attacker asks first with their own password; the
    // owner asks within the minute (no new code is sent) and types the only
    // code in their inbox, which belongs to the attacker's request
    await insertBuyer('usr_buyer_hijack', 'buyer.hijack@example.com');
    await server.createClient().request('POST', '/api/auth/sign-up', {
      fullName: 'Attacker',
      email: 'buyer.hijack@example.com',
      password: 'attacker-pass-123',
    });
    nowMs += 20 * 1000;
    await server.createClient().request('POST', '/api/auth/sign-up', {
      fullName: 'Ravi Kumar',
      email: 'buyer.hijack@example.com',
      password: 'victim-pass-456',
    });
    const code = String(latestCode('buyer.hijack@example.com'));

    const owner = await confirm(
      'buyer.hijack@example.com',
      code,
      server.createClient(),
      'victim-pass-456',
    );
    assert.equal(owner.status, 400);
    assert.equal(owner.body.code, 'INVALID_SIGN_UP_CODE');
    assert.equal(await passwordHashOf('buyer.hijack@example.com'), null);
    const attackerLogin = await server
      .createClient()
      .request('POST', '/api/auth/login', {
        email: 'buyer.hijack@example.com',
        password: 'attacker-pass-123',
        rememberMe: false,
      });
    assert.equal(attackerLogin.status, 401);

    // A minute later the owner asks again and gets a code of their own
    nowMs += 2 * MINUTE_MS;
    await server.createClient().request('POST', '/api/auth/sign-up', {
      fullName: 'Ravi Kumar',
      email: 'buyer.hijack@example.com',
      password: 'victim-pass-456',
    });
    const ownCode = String(latestCode('buyer.hijack@example.com'));
    const claimed = await confirm(
      'buyer.hijack@example.com',
      ownCode,
      server.createClient(),
      'victim-pass-456',
    );
    assert.equal(claimed.status, 201);
    assert.equal(claimed.body.user.id, 'usr_buyer_hijack');
    assert.equal(claimed.body.user.name, 'Ravi Kumar');
  });

  it('stops sending codes to an email after 15 wrong tries in a day', async () => {
    const email = 'budget@example.com';
    const sentFor = () =>
      server.sentSignUpCodes.filter(sent => sent.email === email).length;
    for (let round = 0; round < 3; round += 1) {
      await requestSignUp(email);
      const code = String(latestCode(email));
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await confirm(email, wrongCode(code));
      }
      nowMs += 2 * 60 * MINUTE_MS; // clear of the hourly cap
    }
    const before = sentFor();
    assert.equal((await requestSignUp(email)).status, 202);
    assert.equal(sentFor(), before, 'no new code after 15 wrong tries');

    // A day later the email can try again
    nowMs += 24 * 60 * MINUTE_MS;
    await requestSignUp(email);
    assert.equal(sentFor(), before + 1);
  });

  it('does not let guesses at a single code lock an email out for the day', async () => {
    // Found in review: tries past a code's 5 were counted toward the daily
    // budget, so one code and 15 wrong confirms blocked the email
    const email = 'lockout@example.com';
    await requestSignUp(email);
    const code = String(latestCode(email));
    for (let attempt = 0; attempt < 15; attempt += 1) {
      await confirm(email, wrongCode(code));
    }
    nowMs += 2 * 60 * MINUTE_MS;
    const before = server.sentSignUpCodes.length;
    await requestSignUp(email);
    assert.equal(server.sentSignUpCodes.length, before + 1);
  });

  it('takes as long to refuse an email with no pending sign-up as one with', async () => {
    // Found in review: without a pending row the refusal skipped the
    // password hash and came back about 30 times faster, which showed the
    // email already had an account
    await server.signUpStudent({
      fullName: 'Has Account',
      email: 'timing.account@example.com',
      password: PASSWORD,
    });
    nowMs += 2 * 60 * MINUTE_MS;
    await requestSignUp('timing.account@example.com');
    await requestSignUp('timing.new@example.com');

    const median = async (email: string) => {
      const times: number[] = [];
      for (let sample = 0; sample < 3; sample += 1) {
        const started = performance.now();
        const response = await confirm(email, '000000');
        times.push(performance.now() - started);
        assert.equal(response.status, 400);
      }
      return times.sort((a, b) => a - b)[1];
    };
    const withAccount = await median('timing.account@example.com');
    const pending = await median('timing.new@example.com');
    assert.ok(
      withAccount > pending * 0.3,
      `refusals took ${withAccount.toFixed(1)} ms with an account and ${pending.toFixed(1)} ms for a pending sign-up`,
    );
  });

  it('lets the real buyer claim their checkout record with the code, keeping its purchases', async () => {
    await insertBuyer('usr_buyer_claim', 'buyer.claim@example.com');
    assert.equal(
      (await requestSignUp('buyer.claim@example.com', 'Ravi Kumar')).status,
      202,
    );

    const confirmed = await confirm(
      'buyer.claim@example.com',
      String(latestCode('buyer.claim@example.com')),
    );
    assert.equal(confirmed.status, 201);
    // The same account, so seats bought with this email stay with it
    assert.equal(confirmed.body.user.id, 'usr_buyer_claim');
    assert.equal(confirmed.body.user.name, 'Ravi Kumar');
  });

  it('answers every email the same way: new, checkout buyer, existing account or staff', async () => {
    await insertBuyer('usr_buyer_same', 'buyer.same@example.com');
    await server.signUpStudent({
      fullName: 'Has Account',
      email: 'has.account@example.com',
      password: PASSWORD,
    });
    nowMs += 2 * 60 * MINUTE_MS;

    const answers = [];
    for (const email of [
      'brand.new@example.com',
      'buyer.same@example.com',
      'has.account@example.com',
      TEST_SUPER_ADMIN_EMAIL,
    ]) {
      answers.push(await requestSignUp(email));
    }
    for (const answer of answers) {
      assert.equal(answer.status, 202);
      assert.deepEqual(answer.body, answers[0].body);
      assert.equal(answer.setCookie, null);
    }
  });

  it('emails an existing account a notice, not a code, and leaves its password alone', async () => {
    await server.signUpStudent({
      fullName: 'Existing Student',
      email: 'existing@example.com',
      password: PASSWORD,
    });
    nowMs += 2 * 60 * MINUTE_MS;
    const hashBefore = await passwordHashOf('existing@example.com');
    const codesBefore = server.sentSignUpCodes.length;

    assert.equal(
      (await requestSignUp('existing@example.com', 'Someone Else')).status,
      202,
    );
    assert.equal(server.sentSignUpCodes.length, codesBefore, 'no code sent');
    // Sent after the answer, without waiting
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(
      server.sentAccountNotices.at(-1)?.email,
      'existing@example.com',
    );

    // No code exists for it, so no guess can work
    const guess = await confirm('existing@example.com', '123456');
    assert.equal(guess.status, 400);
    assert.equal(await passwordHashOf('existing@example.com'), hashBefore);
  });

  it('never gives a password to a staff account', async () => {
    assert.equal(
      (await requestSignUp(TEST_SUPER_ADMIN_EMAIL, 'Not Staff')).status,
      202,
    );
    await new Promise(resolve => setImmediate(resolve));
    const notice = server.sentAccountNotices.at(-1);
    assert.equal(notice?.email, TEST_SUPER_ADMIN_EMAIL);
    assert.match(String(notice?.signInUrl), /\/admin-sign-in$/);
    assert.equal((await confirm(TEST_SUPER_ADMIN_EMAIL, '123456')).status, 400);
    assert.equal(await passwordHashOf(TEST_SUPER_ADMIN_EMAIL), null);
  });

  it('refuses a code after 15 minutes', async () => {
    await requestSignUp('late@example.com');
    const code = String(latestCode('late@example.com'));
    nowMs += 15 * MINUTE_MS;
    const response = await confirm('late@example.com', code);
    assert.equal(response.status, 400);
    assert.equal(response.body.code, 'INVALID_SIGN_UP_CODE');
  });

  it('uses a code once, even when two requests race with it', async () => {
    await requestSignUp('replay@example.com');
    const code = String(latestCode('replay@example.com'));

    const [first, second] = await Promise.all([
      confirm('replay@example.com', code),
      confirm('replay@example.com', code),
    ]);
    assert.deepEqual(
      [first.status, second.status].sort(),
      [201, 400],
      'exactly one confirm succeeds',
    );
    const again = await confirm('replay@example.com', code);
    assert.equal(again.status, 400);
    const accounts = await server.db.all(
      'SELECT id FROM users WHERE email = $1',
      ['replay@example.com'],
    );
    assert.equal(accounts.length, 1);
  });

  it('stops accepting even the right code after 5 wrong tries', async () => {
    await requestSignUp('guess@example.com');
    const code = String(latestCode('guess@example.com'));
    for (let attempt = 0; attempt < 5; attempt += 1) {
      assert.equal(
        (await confirm('guess@example.com', wrongCode(code))).status,
        400,
      );
    }
    assert.equal((await confirm('guess@example.com', code)).status, 400);
    const account = await server.db.get(
      'SELECT id FROM users WHERE email = $1',
      ['guess@example.com'],
    );
    assert.equal(account ?? null, null);
  });

  it('accepts only the newest code', async () => {
    await requestSignUp('newest@example.com');
    const first = String(latestCode('newest@example.com'));
    nowMs += 2 * MINUTE_MS;
    await requestSignUp('newest@example.com');
    const second = String(latestCode('newest@example.com'));

    if (first !== second) {
      assert.equal((await confirm('newest@example.com', first)).status, 400);
    }
    assert.equal((await confirm('newest@example.com', second)).status, 201);
  });

  it('sends a new code at most once a minute and 5 times an hour', async () => {
    const email = 'cooldown@example.com';
    const sentFor = () =>
      server.sentSignUpCodes.filter(sent => sent.email === email).length;

    await requestSignUp(email);
    assert.equal(sentFor(), 1);
    // Within a minute: the same answer, but no new email
    nowMs += 30 * 1000;
    assert.equal((await requestSignUp(email)).status, 202);
    assert.equal(sentFor(), 1);

    for (let request = 2; request <= 5; request += 1) {
      nowMs += 2 * MINUTE_MS;
      await requestSignUp(email);
      assert.equal(sentFor(), request);
    }
    // A sixth within the hour: answered, nothing sent
    nowMs += 2 * MINUTE_MS;
    assert.equal((await requestSignUp(email)).status, 202);
    assert.equal(sentFor(), 5);
  });

  it('answers 409 only to the owner of the email, once their code proves it', async () => {
    // A buyer asks to sign up, then sets a password through "Forgot
    // password" before using the sign-up code
    await insertBuyer('usr_buyer_race', 'buyer.race@example.com');
    await requestSignUp('buyer.race@example.com');
    const signUpCode = String(latestCode('buyer.race@example.com'));

    await server.createClient().request('POST', '/api/auth/password-reset', {
      email: 'buyer.race@example.com',
    });
    const resetCode = String(server.sentEmails.at(-1)?.code);
    const reset = await server
      .createClient()
      .request('POST', '/api/auth/password-reset/confirm', {
        email: 'buyer.race@example.com',
        code: resetCode,
        password: 'chosen-by-reset-4',
      });
    assert.equal(reset.status, 200);
    const hashAfterReset = await passwordHashOf('buyer.race@example.com');

    const response = await confirm('buyer.race@example.com', signUpCode);
    assert.equal(response.status, 409);
    assert.equal(response.body.code, 'EMAIL_ALREADY_REGISTERED');
    assert.equal(
      await passwordHashOf('buyer.race@example.com'),
      hashAfterReset,
    );
  });

  it('checks the fields of both steps and accepts nothing else', async () => {
    const response = await server
      .createClient()
      .request('POST', '/api/auth/sign-up', {
        fullName: 'A',
        email: 'not-an-email',
        password: 'short',
      });
    assert.equal(response.status, 400);
    assert.equal(response.body.code, 'REQUEST_VALIDATION_FAILED');
    assert.deepEqual(
      response.body.details.body
        .map((issue: { path: string[] }) => issue.path.join('.'))
        .sort(),
      ['email', 'fullName', 'password'],
    );

    const extra = await server
      .createClient()
      .request('POST', '/api/auth/sign-up', {
        fullName: 'Asha Verma',
        email: 'asha.extra@example.com',
        password: PASSWORD,
        role: 'SUPER_ADMIN',
      });
    assert.equal(extra.status, 400);

    for (const body of [
      { email: 'asha@example.com', code: '12345' },
      { email: 'asha@example.com', code: 'abcdef' },
      { email: 'asha@example.com', code: '123456' },
      {
        email: 'asha@example.com',
        code: '123456',
        password: PASSWORD,
        role: 'SUPER_ADMIN',
      },
    ]) {
      const confirmResponse = await server
        .createClient()
        .request('POST', '/api/auth/sign-up/confirm', body);
      assert.equal(confirmResponse.status, 400);
      assert.equal(confirmResponse.body.code, 'REQUEST_VALIDATION_FAILED');
    }
  });
});

describe('sign-up without email', () => {
  it('is unavailable rather than creating an unverified account', async () => {
    const server = await startTestServer({ withMailer: false });
    try {
      const response = await server
        .createClient()
        .request('POST', '/api/auth/sign-up', {
          fullName: 'Meera Iyer',
          email: 'nomail@example.com',
          password: PASSWORD,
        });
      assert.equal(response.status, 503);
      assert.equal(response.body.code, 'SIGN_UP_UNAVAILABLE');
      const account = await server.db.get(
        'SELECT id FROM users WHERE email = $1',
        ['nomail@example.com'],
      );
      assert.equal(account ?? null, null);
    } finally {
      await server.close();
    }
  });
});

describe('sign-up rate limits', () => {
  it('limits sign-up requests and code confirmations separately', async () => {
    const server = await startTestServer({ enableRateLimiting: true });
    try {
      const confirmStatuses = [];
      for (let attempt = 0; attempt < 11; attempt += 1) {
        const response = await server
          .createClient()
          .request('POST', '/api/auth/sign-up/confirm', {
            email: 'limited@example.com',
            code: '123456',
            password: PASSWORD,
          });
        confirmStatuses.push(response.status);
      }
      // 10 confirmations per 15 minutes, as for password-reset codes
      assert.deepEqual(confirmStatuses, [...Array(10).fill(400), 429]);

      // Confirmations do not use up the sign-up requests (5 per 15 minutes)
      const requestStatuses = [];
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const response = await server
          .createClient()
          .request('POST', '/api/auth/sign-up', {
            fullName: 'Limited Student',
            email: `limited${attempt}@example.com`,
            password: PASSWORD,
          });
        requestStatuses.push(response.status);
      }
      assert.deepEqual(requestStatuses, [202, 202, 202, 202, 202, 429]);

      // and do not use up password-reset confirmations (their own limit)
      const reset = await server
        .createClient()
        .request('POST', '/api/auth/password-reset/confirm', {
          email: 'limited@example.com',
          code: '123456',
          password: PASSWORD,
        });
      assert.equal(reset.status, 400);
    } finally {
      await server.close();
    }
  });
});
