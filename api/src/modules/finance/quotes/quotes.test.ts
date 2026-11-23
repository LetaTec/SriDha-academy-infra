import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import type { TaxQuote } from '../../../contracts/finance.js';
import { transaction } from '../../../db/client.js';
import { ApiError, ERROR_CODE } from '../../../http/errors.js';
import { startTestServer } from '../../../test/testServer.js';
import { DEFAULT_TAX_CONFIG, SUPPLIER_CONFIG } from '../gst/gst.config.js';
import {
  createTaxQuote,
  redeemTaxQuote,
  type TaxQuoteRedemption,
} from './quotes.service.js';
import { consumeTaxQuote, findTaxQuoteById } from './quotes.repository.js';

const TOPIC_ID = 'topic_accounts_gst_class_11';

describe('Tax Quotes (Milestone 6)', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;

  before(async () => {
    server = await startTestServer({});
  });

  after(async () => {
    await server.close();
  });

  it('creates an intra-state B2C tax quote bound to server catalogue fee', async () => {
    const quote = await createTaxQuote(
      { db: server.db, now: () => new Date('2026-11-16T10:00:00Z') },
      {
        itemType: 'TOPIC',
        itemId: TOPIC_ID,
        customerType: 'INDIVIDUAL',
        customerEmail: 'student@example.com',
        addressLine1: '123 Civil Lines',
        city: 'Jaipur',
        state: 'Rajasthan',
        pinCode: '302001',
      },
    );

    assert.ok(quote.id);
    assert.ok(quote.quoteKey);
    assert.equal(quote.status, 'ACTIVE');
    assert.equal(quote.customerType, 'INDIVIDUAL');
    assert.equal(quote.supplierStateCode, SUPPLIER_CONFIG.stateCode); // '08'
    assert.equal(quote.placeOfSupplyStateCode, '08');
    assert.equal(quote.supplyType, 'INTRA_STATE');
    assert.equal(quote.sacCode, DEFAULT_TAX_CONFIG.sacCode); // '999293'
    assert.equal(quote.gstRateBasisPoints, 1800);

    // Verify tax amounts (18% split into 9% CGST + 9% SGST)
    assert.ok(quote.taxableAmountPaise > 0);
    assert.equal(quote.cgstPaise, quote.sgstPaise);
    assert.equal(quote.igstPaise, 0);
    assert.equal(quote.totalGstPaise, quote.cgstPaise + quote.sgstPaise);
    assert.equal(
      quote.totalAmountPaise,
      quote.taxableAmountPaise + quote.totalGstPaise,
    );
    assert.equal(quote.calculationVersion, 'v1');
    assert.equal(quote.roundingPolicy, 'HALF_UP_COMPONENT_SUM');
  });

  it('creates an inter-state B2B tax quote with verified GSTIN', async () => {
    const quote = await createTaxQuote(
      { db: server.db, now: () => new Date('2026-11-16T10:00:00Z') },
      {
        itemType: 'TOPIC',
        itemId: TOPIC_ID,
        customerType: 'BUSINESS',
        customerEmail: 'finance@corp.com',
        businessLegalName: 'Acme Technologies Pvt Ltd',
        gstin: '27AAGCA1234A1Z5',
        addressLine1: 'Bandra Kurla Complex',
        city: 'Mumbai',
        state: 'Maharashtra',
        pinCode: '400051',
      },
    );

    assert.equal(quote.supplyType, 'INTER_STATE');
    assert.equal(quote.placeOfSupplyStateCode, '27');
    assert.equal(quote.cgstPaise, 0);
    assert.equal(quote.sgstPaise, 0);
    assert.ok(quote.igstPaise > 0);
    assert.equal(quote.totalGstPaise, quote.igstPaise);
    assert.equal(
      quote.totalAmountPaise,
      quote.taxableAmountPaise + quote.totalGstPaise,
    );
  });

  it('returns existing active quote when same customer and item are requested', async () => {
    const input = {
      itemType: 'TOPIC' as const,
      itemId: TOPIC_ID,
      customerType: 'INDIVIDUAL' as const,
      customerEmail: 'student@example.com',
      addressLine1: '123 Civil Lines',
      city: 'Jaipur',
      state: 'Rajasthan' as const,
      pinCode: '302001',
    };
    const context = {
      db: server.db,
      now: () => new Date('2026-11-16T10:00:00Z'),
    };

    const quote1 = await createTaxQuote(context, input);
    const quote2 = await createTaxQuote(context, input);

    assert.equal(quote1.id, quote2.id);
    assert.equal(quote1.quoteKey, quote2.quoteKey);
  });

  it('atomically consumes an active quote and prevents reuse or replay', async () => {
    const context = {
      db: server.db,
      now: () => new Date('2026-11-16T10:00:00Z'),
    };
    const quote = await createTaxQuote(context, {
      itemType: 'TOPIC',
      itemId: TOPIC_ID,
      customerType: 'INDIVIDUAL',
      customerEmail: 'student@example.com',
      addressLine1: '123 Civil Lines',
      city: 'Jaipur',
      state: 'Rajasthan',
      pinCode: '302001',
    });

    // 1. First consumption succeeds
    const consumed = await consumeTaxQuote(
      server.db,
      quote.id,
      '2026-11-16T10:05:00Z',
    );
    assert.ok(consumed);
    assert.equal(consumed.status, 'CONSUMED');

    // 2. Second consumption fails atomically
    const replay = await consumeTaxQuote(
      server.db,
      quote.id,
      '2026-11-16T10:06:00Z',
    );
    assert.equal(replay, null);

    // Verify in database
    const found = await findTaxQuoteById(server.db, quote.id);
    assert.equal(found?.status, 'CONSUMED');
  });

  it('refuses quote consumption if quote has expired', async () => {
    const context = {
      db: server.db,
      now: () => new Date('2026-11-16T10:00:00Z'),
    };
    const quote = await createTaxQuote(context, {
      itemType: 'TOPIC',
      itemId: TOPIC_ID,
      customerType: 'INDIVIDUAL',
      customerEmail: 'student@example.com',
      addressLine1: '123 Civil Lines',
      city: 'Jaipur',
      state: 'Rajasthan',
      pinCode: '302001',
    });

    // Attempt to consume 31 minutes later (quote validity is 30 mins)
    const expiredTimestamp = new Date('2026-11-16T10:31:00Z').toISOString();
    const consumed = await consumeTaxQuote(
      server.db,
      quote.id,
      expiredTimestamp,
    );
    assert.equal(consumed, null);
  });

  it('has no public quote endpoint until checkout charges quotes (H4)', async () => {
    const client = server.createClient();
    const response = await client.request('POST', '/api/payments/tax-quotes', {
      itemType: 'TOPIC',
      itemId: TOPIC_ID,
      customerType: 'INDIVIDUAL',
      customerEmail: 'checkout@example.com',
      addressLine1: '10 Marine Drive',
      city: 'Mumbai',
      state: 'Maharashtra',
      pinCode: '400020',
    });

    assert.equal(response.status, 404);
  });

  describe('redeeming a quote at checkout (H4)', () => {
    const QUOTED_AT = new Date('2026-11-16T10:00:00Z');
    const email = 'redeemer@example.com';

    const newQuote = (
      options: {
        userId?: string;
        customerEmail?: string;
        pinCode?: string;
      } = {},
    ) =>
      createTaxQuote(
        { db: server.db, now: () => QUOTED_AT },
        {
          itemType: 'TOPIC',
          itemId: TOPIC_ID,
          customerType: 'INDIVIDUAL',
          customerEmail: options.customerEmail ?? email,
          addressLine1: '10 Marine Drive',
          city: 'Mumbai',
          state: 'Maharashtra',
          pinCode: options.pinCode ?? '400020',
        },
        { userId: options.userId ?? null },
      );

    const redemptionFor = (
      quote: TaxQuote,
      overrides: Partial<TaxQuoteRedemption> = {},
    ): TaxQuoteRedemption => ({
      quoteId: quote.id,
      userId: null,
      customerEmail: email,
      itemType: 'TOPIC',
      itemId: TOPIC_ID,
      cataloguePricePaise: quote.taxableAmountPaise,
      customerType: 'INDIVIDUAL',
      billingStateCode: '27',
      pinCode: '400020',
      gstin: null,
      now: new Date('2026-11-16T10:10:00Z'),
      ...overrides,
    });

    const redeem = (redemption: TaxQuoteRedemption) =>
      transaction(server.db, tx => redeemTaxQuote(tx, redemption));

    const rejectsWith = (promise: Promise<unknown>, code: string) =>
      assert.rejects(
        promise,
        (error: unknown) => error instanceof ApiError && error.code === code,
      );

    it('charges the quoted total once, and refuses a second use', async () => {
      const quote = await newQuote({ pinCode: '400021' });
      const redeemed = await redeem(
        redemptionFor(quote, { pinCode: '400021' }),
      );
      assert.equal(redeemed.status, 'CONSUMED');
      assert.equal(redeemed.totalAmountPaise, quote.totalAmountPaise);

      await rejectsWith(
        redeem(redemptionFor(quote, { pinCode: '400021' })),
        ERROR_CODE.taxQuoteAlreadyUsed,
      );
    });

    it('allows exactly one of several simultaneous redemptions', async () => {
      const quote = await newQuote({ pinCode: '400022' });
      const results = await Promise.allSettled(
        Array.from({ length: 5 }, () =>
          redeem(redemptionFor(quote, { pinCode: '400022' })),
        ),
      );
      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    });

    it('refuses an expired quote', async () => {
      const quote = await newQuote({ pinCode: '400023' });
      await rejectsWith(
        redeem(
          redemptionFor(quote, {
            pinCode: '400023',
            now: new Date('2026-11-16T10:30:00Z'),
          }),
        ),
        ERROR_CODE.taxQuoteExpired,
      );
      const found = await findTaxQuoteById(server.db, quote.id);
      assert.equal(found?.status, 'ACTIVE');
    });

    it("refuses someone else's quote as if it did not exist", async () => {
      const guestQuote = await newQuote({ pinCode: '400024' });
      await rejectsWith(
        redeem(
          redemptionFor(guestQuote, {
            pinCode: '400024',
            customerEmail: 'someone.else@example.com',
          }),
        ),
        ERROR_CODE.taxQuoteNotFound,
      );

      const ownerId = (
        await server.db.get<{ id: string }>(
          "SELECT id FROM users WHERE role = 'SUPER_ADMIN' LIMIT 1",
        )
      )?.id;
      assert.ok(ownerId);
      const userQuote = await newQuote({ pinCode: '400025', userId: ownerId });
      await rejectsWith(
        redeem(
          redemptionFor(userQuote, {
            pinCode: '400025',
            userId: 'another-user',
          }),
        ),
        ERROR_CODE.taxQuoteNotFound,
      );
      await rejectsWith(
        redeem(redemptionFor(userQuote, { pinCode: '400025', userId: null })),
        ERROR_CODE.taxQuoteNotFound,
      );
      const redeemed = await redeem(
        redemptionFor(userQuote, { pinCode: '400025', userId: ownerId }),
      );
      assert.equal(redeemed.status, 'CONSUMED');

      await rejectsWith(
        redeem(redemptionFor({ ...guestQuote, id: 'no-such-quote' })),
        ERROR_CODE.taxQuoteNotFound,
      );
    });

    it('refuses a quote when the price, item or billing details changed', async () => {
      const quote = await newQuote({ pinCode: '400026' });
      await rejectsWith(
        redeem(
          redemptionFor(quote, {
            pinCode: '400026',
            cataloguePricePaise: quote.taxableAmountPaise + 100,
          }),
        ),
        ERROR_CODE.taxQuoteMismatch,
      );
      await rejectsWith(
        redeem(
          redemptionFor(quote, {
            pinCode: '400026',
            itemType: 'BATCH',
            itemId: 'batch_gst_class_11_december',
          }),
        ),
        ERROR_CODE.taxQuoteMismatch,
      );
      await rejectsWith(
        redeem(redemptionFor(quote, { pinCode: '400099' })),
        ERROR_CODE.taxQuoteMismatch,
      );
      await rejectsWith(
        redeem(
          redemptionFor(quote, { pinCode: '400026', billingStateCode: '08' }),
        ),
        ERROR_CODE.taxQuoteMismatch,
      );
      // None of the refusals used the quote up
      const found = await findTaxQuoteById(server.db, quote.id);
      assert.equal(found?.status, 'ACTIVE');
    });
  });
});
