import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import type {
  RefundDetailResponse,
  RefundsListResponse,
  ResolveRefundExceptionResponse,
} from '../../contracts/finance.js';
import { createScriptedRazorpay } from '../../test/fakeRazorpay.js';
import {
  startTestServer,
  TEST_SUPER_ADMIN_EMAIL,
  type TestClient,
} from '../../test/testServer.js';
import {
  insertBuyerIfNew,
  insertPayment,
  insertPreRegistration,
} from '../payments/payments.repository.js';
import { AUDIT_ACTION, recordAudit } from './audit.service.js';

type TestServer = Awaited<ReturnType<typeof startTestServer>>;

describe('Phase 2.1: Refund Management Desk Backend', () => {
  const FINANCE_EMAIL = 'finance.desk@sridha.test';
  const STUDENT_EMAIL = 'student.buyer@example.com';
  let server: TestServer;
  let finance: TestClient;
  let admin: TestClient;
  let student: TestClient;
  let scripted: ReturnType<typeof createScriptedRazorpay>;

  // Fixture IDs
  let userId: string;
  let paymentId1: string;
  let paymentId2: string;
  let refundRequiresReviewId: string;
  let refundPendingId: string;
  let refundProcessedId: string;

  before(async () => {
    scripted = createScriptedRazorpay();
    server = await startTestServer({
      invoicingEnabled: true,
      financeAdminEmails: [FINANCE_EMAIL],
      paymentGateway: scripted.gateway,
    });
    finance = await server.signInStaff(FINANCE_EMAIL);
    admin = await server.signInStaff(TEST_SUPER_ADMIN_EMAIL);
    student = server.createClient();

    // Create test customer
    userId = randomUUID();
    await insertBuyerIfNew(server.db, {
      id: userId,
      email: STUDENT_EMAIL,
      role: 'STUDENT',
      timestamp: new Date().toISOString(),
    });

    // Create test pre-registrations
    const preReg1 = randomUUID();
    await insertPreRegistration(server.db, {
      id: preReg1,
      userId,
      topicId: 'topic_accounts_gst_class_11',
      status: 'CONFIRMED',
      timestamp: new Date().toISOString(),
    });

    const preReg2 = randomUUID();
    await insertPreRegistration(server.db, {
      id: preReg2,
      userId,
      topicId: 'topic_physics_ray_optics_class_12',
      status: 'CONFIRMED',
      timestamp: new Date().toISOString(),
    });

    // Create test payments
    paymentId1 = randomUUID();
    await insertPayment(server.db, {
      id: paymentId1,
      userId,
      amountPaise: 500000,
      currency: 'INR',
      status: 'CREATED',
      provider: 'RAZORPAY',
      providerOrderId: 'order_test_1',
      billingName: 'Rahul Sharma',
      billingEmail: STUDENT_EMAIL,
      billingMobile: '+91 98765 43210',
      billingState: 'Rajasthan',
      billingCity: 'Jaipur',
      customerType: 'INDIVIDUAL',
      addressLine1: '12 Civil Lines',
      addressLine2: null,
      pinCode: '302006',
      billingStateCode: '08',
      businessLegalName: null,
      gstin: null,
      gstinStateCode: null,
      gstinCheck: null,
      purchaseOrderReference: null,
      itemDescription: 'Topic Wave Optics',
      itemTopicId: 'topic_physics_ray_optics_class_12',
      itemBatchId: null,
      unitPricePaise: 500000,
      timestamp: new Date(Date.now() - 3600_000).toISOString(),
      enrolmentId: null,
      preRegistrationId: preReg1,
      testAttemptId: null,
    });

    paymentId2 = randomUUID();
    await insertPayment(server.db, {
      id: paymentId2,
      userId,
      amountPaise: 300000,
      currency: 'INR',
      status: 'CREATED',
      provider: 'RAZORPAY',
      providerOrderId: 'order_test_2',
      billingName: 'Rahul Sharma',
      billingEmail: STUDENT_EMAIL,
      billingMobile: '+91 98765 43210',
      billingState: 'Rajasthan',
      billingCity: 'Jaipur',
      customerType: 'INDIVIDUAL',
      addressLine1: '12 Civil Lines',
      addressLine2: null,
      pinCode: '302006',
      billingStateCode: '08',
      businessLegalName: null,
      gstin: null,
      gstinStateCode: null,
      gstinCheck: null,
      purchaseOrderReference: null,
      itemDescription: 'Topic Wave Optics',
      itemTopicId: 'topic_physics_ray_optics_class_12',
      itemBatchId: null,
      unitPricePaise: 300000,
      timestamp: new Date(Date.now() - 1800_000).toISOString(),
      enrolmentId: null,
      preRegistrationId: preReg2,
      testAttemptId: null,
    });

    await server.db.query(
      `UPDATE payments SET status = 'PAID', paid_at = created_at, provider_payment_id = 'pay_test_1' WHERE id = $1`,
      [paymentId1],
    );
    await server.db.query(
      `UPDATE payments SET status = 'PAID', paid_at = created_at, provider_payment_id = 'pay_test_2' WHERE id = $1`,
      [paymentId2],
    );

    // 1. Create a refund in REQUIRES_REVIEW (an exception awaiting resolution)
    refundRequiresReviewId = randomUUID();
    await server.db.query(
      `INSERT INTO payment_refunds (
         id, payment_id, provider, provider_refund_id, receipt, amount_paise,
         currency, status, source, review_reason, created_at, updated_at
       )
       VALUES ($1, $2, 'RAZORPAY', NULL, 'rcpt_review_1', 100000,
               'INR', 'REQUIRES_REVIEW', 'FINANCE_ADMIN',
               'Razorpay did not return this refund in payments list after 24 hours',
               now(), now())`,
      [refundRequiresReviewId, paymentId1],
    );

    // 2. Create a refund in PENDING
    refundPendingId = randomUUID();
    await server.db.query(
      `INSERT INTO payment_refunds (
         id, payment_id, provider, provider_refund_id, receipt, amount_paise,
         currency, status, source, created_at, updated_at
       )
       VALUES ($1, $2, 'RAZORPAY', NULL, 'rcpt_pending_2', 50000,
               'INR', 'PENDING', 'FINANCE_ADMIN', now(), now())`,
      [refundPendingId, paymentId1],
    );

    // 3. Create a refund in PROCESSED
    refundProcessedId = randomUUID();
    await server.db.query(
      `INSERT INTO payment_refunds (
         id, payment_id, provider, provider_refund_id, receipt, amount_paise,
         currency, status, source, processed_at, created_at, updated_at
       )
       VALUES ($1, $2, 'RAZORPAY', 'rfnd_proc_3', 'rcpt_proc_3', 200000,
               'INR', 'PROCESSED', 'FINANCE_ADMIN', now(), now(), now())`,
      [refundProcessedId, paymentId2],
    );

    // Add an audit log entry for paymentId1
    await recordAudit(server.db, {
      actor: null,
      action: AUDIT_ACTION.refundRequested,
      entityType: 'PAYMENT_REFUND',
      entityId: refundRequiresReviewId,
      details: { amountPaise: 100000, reason: 'Test exception' },
      at: new Date(),
    });
  });

  after(async () => {
    await server.close();
  });

  describe('GET /api/finance/refunds (Desk List & KPIs)', () => {
    it('refuses unauthenticated and non-staff visitors', async () => {
      const unauth = await student.request('GET', '/api/finance/refunds');
      assert.equal(unauth.status, 401);
    });

    it('returns paginated refunds and summary metrics to finance staff', async () => {
      const response = await finance.request<RefundsListResponse>(
        'GET',
        '/api/finance/refunds',
      );
      assert.equal(response.status, 200);
      const data = response.body;

      assert.ok(data.total >= 3);
      assert.equal(data.summary.requiresReviewCount, 1);
      assert.equal(data.summary.requiresReviewPaise, 100000);
      assert.equal(data.summary.pendingCount, 1);
      assert.equal(data.summary.processedCount, 1);
      assert.equal(data.summary.processedPaise, 200000);

      // Sorting ensures REQUIRES_REVIEW items appear first
      assert.equal(data.refunds[0].id, refundRequiresReviewId);
      assert.equal(data.refunds[0].status, 'REQUIRES_REVIEW');
      assert.equal(data.refunds[0].customerEmail, STUDENT_EMAIL);
    });

    it('filters refunds by status', async () => {
      const response = await finance.request<RefundsListResponse>(
        'GET',
        '/api/finance/refunds?status=REQUIRES_REVIEW',
      );
      assert.equal(response.status, 200);
      assert.equal(response.body.refunds.length, 1);
      assert.equal(response.body.refunds[0].id, refundRequiresReviewId);
      assert.equal(response.body.refunds[0].status, 'REQUIRES_REVIEW');
    });

    it('searches refunds by receipt and payment references', async () => {
      const response = await finance.request<RefundsListResponse>(
        'GET',
        '/api/finance/refunds?search=rcpt_proc_3',
      );
      assert.equal(response.status, 200);
      assert.equal(response.body.refunds.length, 1);
      assert.equal(response.body.refunds[0].id, refundProcessedId);
      assert.equal(response.body.refunds[0].providerRefundId, 'rfnd_proc_3');
    });
  });

  describe('GET /api/finance/refunds/:id (Refund Details)', () => {
    it('returns full refund details, associated payment, and audit entries', async () => {
      const response = await finance.request<RefundDetailResponse>(
        'GET',
        `/api/finance/refunds/${refundRequiresReviewId}`,
      );
      assert.equal(response.status, 200);
      const data = response.body;

      assert.equal(data.refund.id, refundRequiresReviewId);
      assert.equal(data.refund.status, 'REQUIRES_REVIEW');
      assert.ok(data.refund.reviewReason);

      assert.ok(data.payment);
      assert.equal(data.payment?.id, paymentId1);
      assert.equal(data.payment?.customerEmail, STUDENT_EMAIL);
      assert.equal(data.payment?.amountPaise, 500000);

      assert.ok(Array.isArray(data.auditEntries));
      assert.ok(data.auditEntries.length >= 1);
      assert.equal(data.auditEntries[0].entityId, refundRequiresReviewId);
    });

    it('returns 404 for an unknown refund ID', async () => {
      const unknownId = randomUUID();
      const response = await finance.request(
        'GET',
        `/api/finance/refunds/${unknownId}`,
      );
      assert.equal(response.status, 404);
    });
  });

  describe('POST /api/finance/refund-exceptions/:id/resolve (Exception Resolution)', () => {
    async function createPaymentWithException(options: {
      amountPaise: number;
      createdAt?: string;
      receipt?: string;
    }): Promise<{
      paymentId: string;
      refundId: string;
      providerPaymentId: string;
      receipt: string;
    }> {
      const buyerId = randomUUID();
      const preRegId = randomUUID();
      const paymentId = randomUUID();
      const refundId = randomUUID();
      const providerPaymentId = `pay_${randomUUID().replace(/-/g, '').slice(0, 14)}`;
      const providerOrderId = `order_${randomUUID().replace(/-/g, '').slice(0, 14)}`;
      const receipt = options.receipt ?? `rcpt_${randomUUID().slice(0, 8)}`;
      const createdAt = options.createdAt ?? new Date().toISOString();

      await insertBuyerIfNew(server.db, {
        id: buyerId,
        email: `buyer_${randomUUID().slice(0, 8)}@example.com`,
        role: 'STUDENT',
        timestamp: createdAt,
      });

      await insertPreRegistration(server.db, {
        id: preRegId,
        userId: buyerId,
        topicId: 'topic_physics_ray_optics_class_12',
        status: 'CONFIRMED',
        timestamp: createdAt,
      });

      await insertPayment(server.db, {
        id: paymentId,
        userId: buyerId,
        amountPaise: options.amountPaise * 2,
        currency: 'INR',
        status: 'CREATED',
        provider: 'RAZORPAY',
        providerOrderId,
        billingName: 'Rahul Sharma',
        billingEmail: STUDENT_EMAIL,
        billingMobile: '+91 98765 43210',
        billingState: 'Rajasthan',
        billingCity: 'Jaipur',
        customerType: 'INDIVIDUAL',
        addressLine1: '12 Civil Lines',
        addressLine2: null,
        pinCode: '302006',
        billingStateCode: '08',
        businessLegalName: null,
        gstin: null,
        gstinStateCode: null,
        gstinCheck: null,
        purchaseOrderReference: null,
        itemDescription: 'Topic Wave Optics',
        itemTopicId: 'topic_physics_ray_optics_class_12',
        itemBatchId: null,
        unitPricePaise: options.amountPaise * 2,
        timestamp: createdAt,
        enrolmentId: null,
        preRegistrationId: preRegId,
        testAttemptId: null,
      });

      await server.db.query(
        `UPDATE payments SET status = 'PAID', paid_at = created_at, provider_payment_id = $1 WHERE id = $2`,
        [providerPaymentId, paymentId],
      );

      await server.db.query(
        `INSERT INTO payment_refunds (
           id, payment_id, provider, provider_refund_id, receipt, amount_paise,
           currency, status, source, review_reason, created_at, updated_at
         )
         VALUES ($1, $2, 'RAZORPAY', NULL, $3, $4,
                 'INR', 'REQUIRES_REVIEW', 'FINANCE_ADMIN',
                 'Pending resolution verification', $5, $5)`,
        [refundId, paymentId, receipt, options.amountPaise, createdAt],
      );

      return { paymentId, refundId, providerPaymentId, receipt };
    }

    it('refuses resolution from non-staff', async () => {
      const response = await student.request(
        'POST',
        `/api/finance/refund-exceptions/${refundRequiresReviewId}/resolve`,
        {
          action: 'CONFIRM_PROCESSED',
          evidenceReference: 'Gateway ARN 12345',
          notes: 'Confirmed in Razorpay dashboard',
          providerRefundId: 'rfnd_resolved_001',
        },
      );
      assert.equal(response.status, 401);
    });

    it('refuses resolution with missing required evidence reference or notes', async () => {
      const response = await finance.request(
        'POST',
        `/api/finance/refund-exceptions/${refundRequiresReviewId}/resolve`,
        {
          action: 'CONFIRM_PROCESSED',
          notes: 'Missing evidence reference',
        },
      );
      assert.equal(response.status, 400);
    });

    it('refuses resolving a refund that is not in REQUIRES_REVIEW status', async () => {
      const response = await finance.request(
        'POST',
        `/api/finance/refund-exceptions/${refundProcessedId}/resolve`,
        {
          action: 'CONFIRM_PROCESSED',
          evidenceReference: 'Gateway ARN 12345',
          notes: 'Already processed',
          providerRefundId: 'rfnd_already_proc',
        },
      );
      assert.equal(response.status, 409);
    });

    it('refuses CONFIRM_PROCESSED if provider refund does not exist on Razorpay', async () => {
      const response = await finance.request(
        'POST',
        `/api/finance/refund-exceptions/${refundRequiresReviewId}/resolve`,
        {
          action: 'CONFIRM_PROCESSED',
          evidenceReference: 'Gateway ARN 12345',
          notes: 'Claimed processed',
          providerRefundId: 'rfnd_nonexistent_xyz',
        },
      );
      assert.equal(response.status, 502);
    });

    it('refuses CONFIRM_PROCESSED if provider refund status is still PENDING on Razorpay', async () => {
      const pendingRefundId = 'rfnd_provider_pending_99';
      scripted.refunds.set(pendingRefundId, {
        id: pendingRefundId,
        status: 'pending',
        amountPaise: 100000,
        currency: 'INR',
        paymentId: 'pay_test_1',
        receipt: 'rcpt_review_1',
      });

      const response = await finance.request(
        'POST',
        `/api/finance/refund-exceptions/${refundRequiresReviewId}/resolve`,
        {
          action: 'CONFIRM_PROCESSED',
          evidenceReference: 'Gateway ARN 12345',
          notes: 'Premature confirmation attempt',
          providerRefundId: pendingRefundId,
        },
      );
      assert.equal(response.status, 409);
    });

    it('refuses CONFIRM_PROCESSED if provider refund amount mismatches recorded amount', async () => {
      const wrongAmtRefundId = 'rfnd_wrong_amt_88';
      scripted.refunds.set(wrongAmtRefundId, {
        id: wrongAmtRefundId,
        status: 'processed',
        amountPaise: 50000, // 500 instead of 1000
        currency: 'INR',
        paymentId: 'pay_test_1',
        receipt: 'rcpt_review_1',
      });

      const response = await finance.request(
        'POST',
        `/api/finance/refund-exceptions/${refundRequiresReviewId}/resolve`,
        {
          action: 'CONFIRM_PROCESSED',
          evidenceReference: 'Gateway ARN 12345',
          notes: 'Mismatched amount test',
          providerRefundId: wrongAmtRefundId,
        },
      );
      assert.equal(response.status, 409);
    });

    it('refuses CONFIRM_PROCESSED if provider refund belongs to a different payment', async () => {
      const wrongPaymentRefundId = 'rfnd_wrong_payment_77';
      scripted.refunds.set(wrongPaymentRefundId, {
        id: wrongPaymentRefundId,
        status: 'processed',
        amountPaise: 100000,
        currency: 'INR',
        paymentId: 'pay_different_payment_999',
        receipt: 'rcpt_review_1',
      });

      const response = await finance.request(
        'POST',
        `/api/finance/refund-exceptions/${refundRequiresReviewId}/resolve`,
        {
          action: 'CONFIRM_PROCESSED',
          evidenceReference: 'Gateway ARN 12345',
          notes: 'Cross-payment confirmation attempt',
          providerRefundId: wrongPaymentRefundId,
        },
      );
      assert.equal(response.status, 409);
    });

    it('refuses CONFIRM_PROCESSED if provider refund currency mismatches', async () => {
      const wrongCurrencyRefundId = 'rfnd_wrong_curr_66';
      scripted.refunds.set(wrongCurrencyRefundId, {
        id: wrongCurrencyRefundId,
        status: 'processed',
        amountPaise: 100000,
        currency: 'USD',
        paymentId: 'pay_test_1',
        receipt: 'rcpt_review_1',
      });

      const response = await finance.request(
        'POST',
        `/api/finance/refund-exceptions/${refundRequiresReviewId}/resolve`,
        {
          action: 'CONFIRM_PROCESSED',
          evidenceReference: 'Gateway ARN 12345',
          notes: 'Wrong currency test',
          providerRefundId: wrongCurrencyRefundId,
        },
      );
      assert.equal(response.status, 409);
    });

    it('refuses CONFIRM_PROCESSED if provider refund omits or has null paymentId', async () => {
      const missingPaymentRefundId = 'rfnd_missing_pay_55';
      scripted.refunds.set(missingPaymentRefundId, {
        id: missingPaymentRefundId,
        status: 'processed',
        amountPaise: 100000,
        currency: 'INR',
        paymentId: null,
        receipt: 'rcpt_review_1',
      });

      const response = await finance.request(
        'POST',
        `/api/finance/refund-exceptions/${refundRequiresReviewId}/resolve`,
        {
          action: 'CONFIRM_PROCESSED',
          evidenceReference: 'Gateway ARN 12345',
          notes: 'Missing paymentId test',
          providerRefundId: missingPaymentRefundId,
        },
      );
      assert.equal(response.status, 409);
    });

    it('refuses CONFIRM_PROCESSED if provider refund omits or has null currency', async () => {
      const missingCurrencyRefundId = 'rfnd_missing_curr_44';
      scripted.refunds.set(missingCurrencyRefundId, {
        id: missingCurrencyRefundId,
        status: 'processed',
        amountPaise: 100000,
        currency: null,
        paymentId: 'pay_test_1',
        receipt: 'rcpt_review_1',
      });

      const response = await finance.request(
        'POST',
        `/api/finance/refund-exceptions/${refundRequiresReviewId}/resolve`,
        {
          action: 'CONFIRM_PROCESSED',
          evidenceReference: 'Gateway ARN 12345',
          notes: 'Missing currency test',
          providerRefundId: missingCurrencyRefundId,
        },
      );
      assert.equal(response.status, 409);
    });

    it('refuses CONFIRM_PROCESSED if provider refund ID returned mismatches requested ID', async () => {
      const requestedId = 'rfnd_req_mismatch_33';
      scripted.refunds.set(requestedId, {
        id: 'rfnd_different_returned_id_99',
        status: 'processed',
        amountPaise: 100000,
        currency: 'INR',
        paymentId: 'pay_test_1',
        receipt: 'rcpt_review_1',
      });

      const response = await finance.request(
        'POST',
        `/api/finance/refund-exceptions/${refundRequiresReviewId}/resolve`,
        {
          action: 'CONFIRM_PROCESSED',
          evidenceReference: 'Gateway ARN 12345',
          notes: 'ID mismatch test',
          providerRefundId: requestedId,
        },
      );
      assert.equal(response.status, 409);
    });

    it('resolves a REQUIRES_REVIEW refund with CONFIRM_PROCESSED when provider evidence is verified', async () => {
      const resolutionEvidence = 'Razorpay ARN: 20261117-RAZORPAY-REFUND-001';
      const resolutionNotes = 'Verified with Razorpay support ticket #8841';
      const providerRefundId = 'rfnd_support_verified_123';

      scripted.refunds.set(providerRefundId, {
        id: providerRefundId,
        status: 'processed',
        amountPaise: 100000,
        currency: 'INR',
        paymentId: 'pay_test_1',
        receipt: 'rcpt_review_1',
      });

      const response = await finance.request<ResolveRefundExceptionResponse>(
        'POST',
        `/api/finance/refund-exceptions/${refundRequiresReviewId}/resolve`,
        {
          action: 'CONFIRM_PROCESSED',
          evidenceReference: resolutionEvidence,
          notes: resolutionNotes,
          providerRefundId,
        },
      );

      assert.equal(response.status, 200);
      assert.equal(response.body.resolved, true);
      assert.equal(response.body.refund.status, 'PROCESSED');
      assert.equal(response.body.refund.providerRefundId, providerRefundId);

      // Verify DB state
      const updated = await server.db.get<{
        status: string;
        provider_refund_id: string;
        processed_at: string;
      }>(
        'SELECT status, provider_refund_id, processed_at FROM payment_refunds WHERE id = $1',
        [refundRequiresReviewId],
      );
      assert.equal(updated?.status, 'PROCESSED');
      assert.equal(updated?.provider_refund_id, providerRefundId);
      assert.ok(updated?.processed_at);

      // Verify Audit Log
      const auditEntry = await server.db.get<{
        action: string;
        actor_role: string;
        details: Record<string, unknown>;
      }>(
        `SELECT action, actor_role, details FROM finance_audit_log
         WHERE action = 'REFUND_EXCEPTION_RESOLVED' AND entity_id = $1`,
        [refundRequiresReviewId],
      );
      assert.ok(auditEntry);
      assert.equal(auditEntry.action, 'REFUND_EXCEPTION_RESOLVED');
      assert.equal(auditEntry.actor_role, 'FINANCE_ADMIN');
      assert.equal(auditEntry.details.resolutionAction, 'CONFIRM_PROCESSED');
      assert.equal(auditEntry.details.evidenceReference, resolutionEvidence);
      assert.equal(auditEntry.details.notes, resolutionNotes);
      assert.equal(auditEntry.details.verifiedProviderStatus, 'processed');
    });

    it('enforces database uniqueness: returns HTTP 409 and rolls back when attempting to reuse a provider_refund_id', async () => {
      const {
        refundId: secondExceptionId,
        providerPaymentId,
        receipt,
      } = await createPaymentWithException({ amountPaise: 50000 });

      // Configure fake gateway with matching fields for the already used ID
      scripted.refunds.set('rfnd_support_verified_123', {
        id: 'rfnd_support_verified_123',
        status: 'processed',
        amountPaise: 50000,
        currency: 'INR',
        paymentId: providerPaymentId,
        receipt,
      });

      // Attempt to resolve second refund with the ALREADY USED provider_refund_id via API
      const response = await admin.request(
        'POST',
        `/api/finance/refund-exceptions/${secondExceptionId}/resolve`,
        {
          action: 'CONFIRM_PROCESSED',
          evidenceReference: 'Gateway ARN duplicate test',
          notes: 'Testing duplicate index conflict resolution',
          providerRefundId: 'rfnd_support_verified_123',
        },
      );

      assert.equal(response.status, 409);
      assert.equal(response.body.code, 'PAYMENT_VERIFICATION_FAILED');

      // Verify second refund was NOT updated in DB (transaction was rolled back)
      const dbRow = await server.db.get<{
        status: string;
        provider_refund_id: string | null;
      }>(
        'SELECT status, provider_refund_id FROM payment_refunds WHERE id = $1',
        [secondExceptionId],
      );
      assert.equal(dbRow?.status, 'REQUIRES_REVIEW');
      assert.equal(dbRow?.provider_refund_id, null);
    });

    it('refuses MARK_FAILED if provider refund is PROCESSED on Razorpay', async () => {
      const { refundId, providerPaymentId, receipt } =
        await createPaymentWithException({ amountPaise: 75000 });

      const processedOnProviderId = 'rfnd_actually_processed_11';
      scripted.refunds.set(processedOnProviderId, {
        id: processedOnProviderId,
        status: 'processed',
        amountPaise: 75000,
        currency: 'INR',
        paymentId: providerPaymentId,
        receipt,
      });

      const response = await admin.request(
        'POST',
        `/api/finance/refund-exceptions/${refundId}/resolve`,
        {
          action: 'MARK_FAILED',
          evidenceReference: 'Employee false claim',
          notes: 'Trying to mark processed refund as failed',
          providerRefundId: processedOnProviderId,
        },
      );
      assert.equal(response.status, 409);
    });

    it('refuses MARK_FAILED if provider refund is still PENDING on Razorpay', async () => {
      const { refundId, providerPaymentId, receipt } =
        await createPaymentWithException({ amountPaise: 75000 });

      const pendingOnProviderId = 'rfnd_actually_pending_22';
      scripted.refunds.set(pendingOnProviderId, {
        id: pendingOnProviderId,
        status: 'pending',
        amountPaise: 75000,
        currency: 'INR',
        paymentId: providerPaymentId,
        receipt,
      });

      const response = await admin.request(
        'POST',
        `/api/finance/refund-exceptions/${refundId}/resolve`,
        {
          action: 'MARK_FAILED',
          evidenceReference: 'Premature claim',
          notes: 'Trying to mark pending refund as failed',
          providerRefundId: pendingOnProviderId,
        },
      );
      assert.equal(response.status, 409);
    });

    it('refuses MARK_FAILED if provider refund status is FAILED but paymentId mismatches', async () => {
      const { refundId, receipt } = await createPaymentWithException({
        amountPaise: 75000,
      });

      const wrongPayFailId = 'rfnd_fail_wrong_pay_1';
      scripted.refunds.set(wrongPayFailId, {
        id: wrongPayFailId,
        status: 'failed',
        amountPaise: 75000,
        currency: 'INR',
        paymentId: 'pay_unrelated_payment_888',
        receipt,
      });

      const response = await admin.request(
        'POST',
        `/api/finance/refund-exceptions/${refundId}/resolve`,
        {
          action: 'MARK_FAILED',
          evidenceReference: 'Cross payment fail attempt',
          notes: 'Testing payment mismatch in failed refund',
          providerRefundId: wrongPayFailId,
        },
      );
      assert.equal(response.status, 409);
    });

    it('refuses MARK_FAILED if provider refund status is FAILED but paymentId is omitted/null', async () => {
      const { refundId, receipt } = await createPaymentWithException({
        amountPaise: 75000,
      });

      const missingPayFailId = 'rfnd_fail_missing_pay_2';
      scripted.refunds.set(missingPayFailId, {
        id: missingPayFailId,
        status: 'failed',
        amountPaise: 75000,
        currency: 'INR',
        paymentId: null,
        receipt,
      });

      const response = await admin.request(
        'POST',
        `/api/finance/refund-exceptions/${refundId}/resolve`,
        {
          action: 'MARK_FAILED',
          evidenceReference: 'Missing paymentId fail attempt',
          notes: 'Testing missing paymentId in failed refund',
          providerRefundId: missingPayFailId,
        },
      );
      assert.equal(response.status, 409);
    });

    it('refuses MARK_FAILED if provider refund status is FAILED but amount mismatches', async () => {
      const { refundId, providerPaymentId, receipt } =
        await createPaymentWithException({ amountPaise: 75000 });

      const wrongAmtFailId = 'rfnd_fail_wrong_amt_3';
      scripted.refunds.set(wrongAmtFailId, {
        id: wrongAmtFailId,
        status: 'failed',
        amountPaise: 1000, // 10 instead of 750
        currency: 'INR',
        paymentId: providerPaymentId,
        receipt,
      });

      const response = await admin.request(
        'POST',
        `/api/finance/refund-exceptions/${refundId}/resolve`,
        {
          action: 'MARK_FAILED',
          evidenceReference: 'Wrong amount fail attempt',
          notes: 'Testing amount mismatch in failed refund',
          providerRefundId: wrongAmtFailId,
        },
      );
      assert.equal(response.status, 409);
    });

    it('refuses MARK_FAILED if provider refund status is FAILED but currency mismatches or is null', async () => {
      const { refundId, providerPaymentId, receipt } =
        await createPaymentWithException({ amountPaise: 75000 });

      const wrongCurrFailId = 'rfnd_fail_wrong_curr_4';
      scripted.refunds.set(wrongCurrFailId, {
        id: wrongCurrFailId,
        status: 'failed',
        amountPaise: 75000,
        currency: 'USD',
        paymentId: providerPaymentId,
        receipt,
      });

      const response = await admin.request(
        'POST',
        `/api/finance/refund-exceptions/${refundId}/resolve`,
        {
          action: 'MARK_FAILED',
          evidenceReference: 'Wrong currency fail attempt',
          notes: 'Testing currency mismatch in failed refund',
          providerRefundId: wrongCurrFailId,
        },
      );
      assert.equal(response.status, 409);
    });

    it('refuses MARK_FAILED if provider refund ID returned mismatches requested ID', async () => {
      const { refundId, providerPaymentId, receipt } =
        await createPaymentWithException({ amountPaise: 75000 });
      const requestedFailId = 'rfnd_fail_req_mismatch_5';
      scripted.refunds.set(requestedFailId, {
        id: 'rfnd_fail_returned_different_77',
        status: 'failed',
        amountPaise: 75000,
        currency: 'INR',
        paymentId: providerPaymentId,
        receipt,
      });

      const response = await admin.request(
        'POST',
        `/api/finance/refund-exceptions/${refundId}/resolve`,
        {
          action: 'MARK_FAILED',
          evidenceReference: 'ID mismatch fail attempt',
          notes: 'Testing refund ID mismatch in failed refund',
          providerRefundId: requestedFailId,
        },
      );
      assert.equal(response.status, 409);
    });

    it('resolves MARK_FAILED when provider explicitly reports status = FAILED with all matching invariants', async () => {
      const { refundId, providerPaymentId, receipt } =
        await createPaymentWithException({ amountPaise: 75000 });

      const providerFailedId = 'rfnd_terminal_failed_33';
      scripted.refunds.set(providerFailedId, {
        id: providerFailedId,
        status: 'failed',
        amountPaise: 75000,
        currency: 'INR',
        paymentId: providerPaymentId,
        receipt,
      });

      const response = await admin.request<ResolveRefundExceptionResponse>(
        'POST',
        `/api/finance/refund-exceptions/${refundId}/resolve`,
        {
          action: 'MARK_FAILED',
          evidenceReference: 'Gateway error code: BANK_DECLINED',
          notes:
            'Customer card declined refund credit; funds remained in merchant pool',
          providerRefundId: providerFailedId,
        },
      );

      assert.equal(response.status, 200);
      assert.equal(response.body.resolved, true);
      assert.equal(response.body.refund.status, 'FAILED');
      assert.equal(response.body.refund.providerRefundId, providerFailedId);

      const dbCheck = await server.db.get<{
        status: string;
        failure_reason: string;
      }>('SELECT status, failure_reason FROM payment_refunds WHERE id = $1', [
        refundId,
      ]);
      assert.equal(dbCheck?.status, 'FAILED');
      assert.equal(
        dbCheck?.failure_reason,
        'Customer card declined refund credit; funds remained in merchant pool',
      );
    });

    it('refuses MARK_FAILED when refund is absent from provider records regardless of age (absence never proves failure)', async () => {
      // Created 72 hours ago
      const threeDaysAgo = new Date(
        server.clock.now().getTime() - 72 * 3600_000,
      ).toISOString();
      const { refundId } = await createPaymentWithException({
        amountPaise: 75000,
        createdAt: threeDaysAgo,
      });

      const response = await admin.request(
        'POST',
        `/api/finance/refund-exceptions/${refundId}/resolve`,
        {
          action: 'MARK_FAILED',
          evidenceReference: 'Absence claim',
          notes: 'Trying to mark absent refund failed based on age alone',
        },
      );
      assert.equal(response.status, 409);

      // Verify refund status remains REQUIRES_REVIEW and funds remain reserved
      const dbCheck = await server.db.get<{ status: string }>(
        'SELECT status FROM payment_refunds WHERE id = $1',
        [refundId],
      );
      assert.equal(dbCheck?.status, 'REQUIRES_REVIEW');
    });

    it('refuses MARK_FAILED on payment refund list when amount matches but receipt is different', async () => {
      const { refundId, providerPaymentId } = await createPaymentWithException({
        amountPaise: 75000,
        receipt: 'rcpt_our_internal_refund_A',
      });

      // Provider has a failed refund on the same payment with the same amount, but DIFFERENT receipt
      const differentReceiptRefundId = 'rfnd_diff_receipt_88';
      scripted.refunds.set(differentReceiptRefundId, {
        id: differentReceiptRefundId,
        status: 'failed',
        amountPaise: 75000,
        currency: 'INR',
        paymentId: providerPaymentId,
        receipt: 'rcpt_some_other_refund_B',
      });

      const response = await admin.request(
        'POST',
        `/api/finance/refund-exceptions/${refundId}/resolve`,
        {
          action: 'MARK_FAILED',
          evidenceReference: 'Loose amount match claim',
          notes: 'Testing receipt isolation',
        },
      );
      // Must not match on amount alone! Must reject because receipt does not match
      assert.equal(response.status, 409);

      const dbCheck = await server.db.get<{ status: string }>(
        'SELECT status FROM payment_refunds WHERE id = $1',
        [refundId],
      );
      assert.equal(dbCheck?.status, 'REQUIRES_REVIEW');
    });

    it('resolves MARK_FAILED via payment refund list when receipt strictly matches and status = failed', async () => {
      const exactReceipt = 'rcpt_strict_matching_99';
      const { refundId, providerPaymentId } = await createPaymentWithException({
        amountPaise: 75000,
        receipt: exactReceipt,
      });

      const matchedRefundId = 'rfnd_strict_matched_99';
      scripted.refunds.set(matchedRefundId, {
        id: matchedRefundId,
        status: 'failed',
        amountPaise: 75000,
        currency: 'INR',
        paymentId: providerPaymentId,
        receipt: exactReceipt,
      });

      const response = await admin.request<ResolveRefundExceptionResponse>(
        'POST',
        `/api/finance/refund-exceptions/${refundId}/resolve`,
        {
          action: 'MARK_FAILED',
          evidenceReference: 'Confirmed by receipt match',
          notes:
            'Razorpay returned terminal failure for receipt rcpt_strict_matching_99',
        },
      );

      assert.equal(response.status, 200);
      assert.equal(response.body.resolved, true);
      assert.equal(response.body.refund.status, 'FAILED');
      assert.equal(response.body.refund.providerRefundId, matchedRefundId);
    });

    it('refuses MARK_FAILED via payment refund list when matched refund id is empty string ("")', async () => {
      const receiptKey = 'rcpt_malformed_id_empty';
      const { paymentId, refundId, providerPaymentId } =
        await createPaymentWithException({
          amountPaise: 75000,
          receipt: receiptKey,
        });

      scripted.paymentRefunds.set(providerPaymentId, [
        {
          id: '',
          status: 'failed',
          amountPaise: 75000,
          currency: 'INR',
          paymentId: providerPaymentId,
          receipt: receiptKey,
        },
      ]);

      const response = await admin.request(
        'POST',
        `/api/finance/refund-exceptions/${refundId}/resolve`,
        {
          action: 'MARK_FAILED',
          evidenceReference: 'Empty provider refund ID evidence',
          notes: 'Testing empty string ID rejection in Path B',
        },
      );

      assert.equal(response.status, 409);
      assert.equal(response.body.code, 'PAYMENT_VERIFICATION_FAILED');
      assert.match(
        response.body.message,
        /missing an authoritative refund ID/i,
      );

      // Verify DB row remains REQUIRES_REVIEW with null provider_refund_id
      const dbRow = await server.db.get<{
        status: string;
        provider_refund_id: string | null;
      }>(
        'SELECT status, provider_refund_id FROM payment_refunds WHERE id = $1',
        [refundId],
      );
      assert.equal(dbRow?.status, 'REQUIRES_REVIEW');
      assert.equal(dbRow?.provider_refund_id, null);

      // Verify reserved refund amount remains included in active refund totals
      const activeRefunds = await server.db.get<{ sum: string | number }>(
        `SELECT COALESCE(SUM(amount_paise), 0) AS sum FROM payment_refunds WHERE payment_id = $1 AND status <> 'FAILED'`,
        [paymentId],
      );
      assert.equal(Number(activeRefunds?.sum ?? 0), 75000);

      // Verify no successful resolution audit event was recorded
      const auditCount = await server.db.get<{ count: string | number }>(
        `SELECT COUNT(*) AS count FROM finance_audit_log WHERE action = 'REFUND_EXCEPTION_RESOLVED' AND entity_id = $1`,
        [refundId],
      );
      assert.equal(Number(auditCount?.count ?? 0), 0);
    });

    it('refuses MARK_FAILED via payment refund list when matched refund id is null', async () => {
      const receiptKey = 'rcpt_malformed_id_null';
      const { paymentId, refundId, providerPaymentId } =
        await createPaymentWithException({
          amountPaise: 75000,
          receipt: receiptKey,
        });

      scripted.paymentRefunds.set(providerPaymentId, [
        {
          id: null as any,
          status: 'failed',
          amountPaise: 75000,
          currency: 'INR',
          paymentId: providerPaymentId,
          receipt: receiptKey,
        },
      ]);

      const response = await admin.request(
        'POST',
        `/api/finance/refund-exceptions/${refundId}/resolve`,
        {
          action: 'MARK_FAILED',
          evidenceReference: 'Null provider refund ID evidence',
          notes: 'Testing null ID rejection in Path B',
        },
      );

      assert.equal(response.status, 409);
      assert.equal(response.body.code, 'PAYMENT_VERIFICATION_FAILED');
      assert.match(
        response.body.message,
        /missing an authoritative refund ID/i,
      );

      const dbRow = await server.db.get<{
        status: string;
        provider_refund_id: string | null;
      }>(
        'SELECT status, provider_refund_id FROM payment_refunds WHERE id = $1',
        [refundId],
      );
      assert.equal(dbRow?.status, 'REQUIRES_REVIEW');
      assert.equal(dbRow?.provider_refund_id, null);

      const activeRefunds = await server.db.get<{ sum: string | number }>(
        `SELECT COALESCE(SUM(amount_paise), 0) AS sum FROM payment_refunds WHERE payment_id = $1 AND status <> 'FAILED'`,
        [paymentId],
      );
      assert.equal(Number(activeRefunds?.sum ?? 0), 75000);

      const auditCount = await server.db.get<{ count: string | number }>(
        `SELECT COUNT(*) AS count FROM finance_audit_log WHERE action = 'REFUND_EXCEPTION_RESOLVED' AND entity_id = $1`,
        [refundId],
      );
      assert.equal(Number(auditCount?.count ?? 0), 0);
    });

    it('refuses MARK_FAILED via payment refund list when matched refund id is omitted entirely', async () => {
      const receiptKey = 'rcpt_malformed_id_omitted';
      const { paymentId, refundId, providerPaymentId } =
        await createPaymentWithException({
          amountPaise: 75000,
          receipt: receiptKey,
        });

      scripted.paymentRefunds.set(providerPaymentId, [
        {
          status: 'failed',
          amountPaise: 75000,
          currency: 'INR',
          paymentId: providerPaymentId,
          receipt: receiptKey,
        } as any,
      ]);

      const response = await admin.request(
        'POST',
        `/api/finance/refund-exceptions/${refundId}/resolve`,
        {
          action: 'MARK_FAILED',
          evidenceReference: 'Omitted provider refund ID evidence',
          notes: 'Testing omitted ID rejection in Path B',
        },
      );

      assert.equal(response.status, 409);
      assert.equal(response.body.code, 'PAYMENT_VERIFICATION_FAILED');
      assert.match(
        response.body.message,
        /missing an authoritative refund ID/i,
      );

      const dbRow = await server.db.get<{
        status: string;
        provider_refund_id: string | null;
      }>(
        'SELECT status, provider_refund_id FROM payment_refunds WHERE id = $1',
        [refundId],
      );
      assert.equal(dbRow?.status, 'REQUIRES_REVIEW');
      assert.equal(dbRow?.provider_refund_id, null);

      const activeRefunds = await server.db.get<{ sum: string | number }>(
        `SELECT COALESCE(SUM(amount_paise), 0) AS sum FROM payment_refunds WHERE payment_id = $1 AND status <> 'FAILED'`,
        [paymentId],
      );
      assert.equal(Number(activeRefunds?.sum ?? 0), 75000);

      const auditCount = await server.db.get<{ count: string | number }>(
        `SELECT COUNT(*) AS count FROM finance_audit_log WHERE action = 'REFUND_EXCEPTION_RESOLVED' AND entity_id = $1`,
        [refundId],
      );
      assert.equal(Number(auditCount?.count ?? 0), 0);
    });

    it('refuses MARK_FAILED via payment refund list when matched refund id is whitespace only ("   ")', async () => {
      const receiptKey = 'rcpt_malformed_id_whitespace';
      const { paymentId, refundId, providerPaymentId } =
        await createPaymentWithException({
          amountPaise: 75000,
          receipt: receiptKey,
        });

      scripted.paymentRefunds.set(providerPaymentId, [
        {
          id: '   ',
          status: 'failed',
          amountPaise: 75000,
          currency: 'INR',
          paymentId: providerPaymentId,
          receipt: receiptKey,
        },
      ]);

      const response = await admin.request(
        'POST',
        `/api/finance/refund-exceptions/${refundId}/resolve`,
        {
          action: 'MARK_FAILED',
          evidenceReference: 'Whitespace provider refund ID evidence',
          notes: 'Testing whitespace ID rejection in Path B',
        },
      );

      assert.equal(response.status, 409);
      assert.equal(response.body.code, 'PAYMENT_VERIFICATION_FAILED');
      assert.match(
        response.body.message,
        /missing an authoritative refund ID/i,
      );

      const dbRow = await server.db.get<{
        status: string;
        provider_refund_id: string | null;
      }>(
        'SELECT status, provider_refund_id FROM payment_refunds WHERE id = $1',
        [refundId],
      );
      assert.equal(dbRow?.status, 'REQUIRES_REVIEW');
      assert.equal(dbRow?.provider_refund_id, null);

      const activeRefunds = await server.db.get<{ sum: string | number }>(
        `SELECT COALESCE(SUM(amount_paise), 0) AS sum FROM payment_refunds WHERE payment_id = $1 AND status <> 'FAILED'`,
        [paymentId],
      );
      assert.equal(Number(activeRefunds?.sum ?? 0), 75000);

      const auditCount = await server.db.get<{ count: string | number }>(
        `SELECT COUNT(*) AS count FROM finance_audit_log WHERE action = 'REFUND_EXCEPTION_RESOLVED' AND entity_id = $1`,
        [refundId],
      );
      assert.equal(Number(auditCount?.count ?? 0), 0);
    });

    it('concurrency: rejects resolving an exception that was already resolved by another process', async () => {
      const { refundId, providerPaymentId, receipt } =
        await createPaymentWithException({ amountPaise: 75000 });
      const failId = 'rfnd_first_resolution_ok';
      scripted.refunds.set(failId, {
        id: failId,
        status: 'failed',
        amountPaise: 75000,
        currency: 'INR',
        paymentId: providerPaymentId,
        receipt,
      });

      const firstRes = await admin.request(
        'POST',
        `/api/finance/refund-exceptions/${refundId}/resolve`,
        {
          action: 'MARK_FAILED',
          evidenceReference: 'Resolution 1',
          notes: 'First staff resolution',
          providerRefundId: failId,
        },
      );
      assert.equal(firstRes.status, 200);

      // Second attempt to resolve the same refund must be rejected with 409
      const secondRes = await admin.request(
        'POST',
        `/api/finance/refund-exceptions/${refundId}/resolve`,
        {
          action: 'MARK_FAILED',
          evidenceReference: 'Resolution 2',
          notes: 'Second staff resolution attempt on same refund',
          providerRefundId: failId,
        },
      );
      assert.equal(secondRes.status, 409);
    });

    // R31-02: a provider refund is accepted only when it carries OUR receipt
    describe('receipt binding (R31-02)', () => {
      const resolve = (
        client: TestClient,
        refundId: string,
        body: Record<string, unknown>,
      ) =>
        client.request(
          'POST',
          `/api/finance/refund-exceptions/${refundId}/resolve`,
          {
            evidenceReference: 'Receipt binding test',
            notes: 'Receipt binding test notes',
            ...body,
          },
        );

      const assertUntouched = async (
        refundId: string,
        paymentId: string,
        amountPaise: number,
      ) => {
        const row = await server.db.get<{
          status: string;
          provider_refund_id: string | null;
        }>(
          'SELECT status, provider_refund_id FROM payment_refunds WHERE id = $1',
          [refundId],
        );
        assert.equal(row?.status, 'REQUIRES_REVIEW');
        assert.equal(row?.provider_refund_id, null);
        const reserved = await server.db.get<{ sum: string | number }>(
          `SELECT COALESCE(SUM(amount_paise), 0) AS sum FROM payment_refunds
           WHERE payment_id = $1 AND status <> 'FAILED'`,
          [paymentId],
        );
        assert.equal(Number(reserved?.sum), amountPaise);
        const resolved = await server.db.get<{ count: string | number }>(
          `SELECT COUNT(*) AS count FROM finance_audit_log
           WHERE action = 'REFUND_EXCEPTION_RESOLVED' AND entity_id = $1`,
          [refundId],
        );
        assert.equal(Number(resolved?.count), 0);
      };

      const providerRecord = (
        providerPaymentId: string,
        overrides: Record<string, unknown>,
      ) =>
        ({
          status: 'failed',
          amountPaise: 75000,
          currency: 'INR',
          paymentId: providerPaymentId,
          ...overrides,
        }) as never;

      for (const action of ['MARK_FAILED', 'CONFIRM_PROCESSED'] as const) {
        const status = action === 'MARK_FAILED' ? 'failed' : 'processed';

        it(`${action}: refuses a staff-supplied id whose refund carries another receipt, however well amount and payment match`, async () => {
          const { paymentId, refundId, providerPaymentId } =
            await createPaymentWithException({ amountPaise: 75000 });
          const id = `rfnd_unrelated_${action.toLowerCase()}`;
          scripted.refunds.set(
            id,
            providerRecord(providerPaymentId, {
              id,
              status,
              receipt: 'rcpt_belongs_to_another_refund',
            }),
          );
          const response = await resolve(admin, refundId, {
            action,
            providerRefundId: id,
          });
          assert.equal(response.status, 409);
          assert.equal(response.body.code, 'PAYMENT_VERIFICATION_FAILED');
          await assertUntouched(refundId, paymentId, 75000);
        });

        for (const receipt of [undefined, null, '']) {
          it(`${action}: refuses a staff-supplied id whose refund has ${
            receipt === undefined
              ? 'no'
              : receipt === null
                ? 'a null'
                : 'a blank'
          } receipt`, async () => {
            const { paymentId, refundId, providerPaymentId } =
              await createPaymentWithException({ amountPaise: 75000 });
            const id = `rfnd_no_receipt_${action.toLowerCase()}_${String(receipt)}`;
            scripted.refunds.set(
              id,
              providerRecord(providerPaymentId, { id, status, receipt }),
            );
            const response = await resolve(admin, refundId, {
              action,
              providerRefundId: id,
            });
            assert.equal(response.status, 409);
            await assertUntouched(refundId, paymentId, 75000);
          });
        }

        it(`${action}: accepts a staff-supplied id when the refund carries our receipt`, async () => {
          const { refundId, providerPaymentId, receipt } =
            await createPaymentWithException({ amountPaise: 75000 });
          const id = `rfnd_bound_${action.toLowerCase()}`;
          scripted.refunds.set(
            id,
            providerRecord(providerPaymentId, { id, status, receipt }),
          );
          const response = await resolve(admin, refundId, {
            action,
            providerRefundId: id,
          });
          assert.equal(response.status, 200);
          assert.equal(response.body.refund.providerRefundId, id);
        });
      }

      it('refuses a staff-supplied id that is a different refund on the same payment, with its own receipt', async () => {
        const { paymentId, refundId, providerPaymentId } =
          await createPaymentWithException({ amountPaise: 75000 });
        // Razorpay processed OUR refund; staff paste the id of an unrelated
        // failed one (the audit's E4 case)
        scripted.paymentRefunds.set(providerPaymentId, [
          providerRecord(providerPaymentId, {
            id: 'rfnd_other_failed',
            receipt: 'rcpt_other',
          }),
        ]);
        scripted.refunds.set(
          'rfnd_other_failed',
          providerRecord(providerPaymentId, {
            id: 'rfnd_other_failed',
            receipt: 'rcpt_other',
          }),
        );
        const response = await resolve(admin, refundId, {
          action: 'MARK_FAILED',
          providerRefundId: 'rfnd_other_failed',
        });
        assert.equal(response.status, 409);
        await assertUntouched(refundId, paymentId, 75000);
      });

      it('refuses an id that is already recorded for another refund', async () => {
        const first = await createPaymentWithException({ amountPaise: 60000 });
        const second = await createPaymentWithException({ amountPaise: 60000 });
        const id = 'rfnd_claimed_twice';
        scripted.refunds.set(
          id,
          providerRecord(first.providerPaymentId, {
            id,
            amountPaise: 60000,
            receipt: first.receipt,
          }),
        );
        assert.equal(
          (
            await resolve(admin, first.refundId, {
              action: 'MARK_FAILED',
              providerRefundId: id,
            })
          ).status,
          200,
        );
        scripted.refunds.set(
          id,
          providerRecord(second.providerPaymentId, {
            id,
            amountPaise: 60000,
            receipt: second.receipt,
          }),
        );
        const response = await resolve(admin, second.refundId, {
          action: 'MARK_FAILED',
          providerRefundId: id,
        });
        assert.equal(response.status, 409);
        await assertUntouched(second.refundId, second.paymentId, 60000);
      });

      it('refuses a different id when one is already recorded, with 409 and not a server error', async () => {
        const { paymentId, refundId, providerPaymentId, receipt } =
          await createPaymentWithException({ amountPaise: 75000 });
        await server.db.query(
          'UPDATE payment_refunds SET provider_refund_id = $2 WHERE id = $1',
          [refundId, 'rfnd_already_recorded'],
        );
        scripted.refunds.set(
          'rfnd_staff_supplied',
          providerRecord(providerPaymentId, {
            id: 'rfnd_staff_supplied',
            receipt,
          }),
        );
        const response = await resolve(admin, refundId, {
          action: 'MARK_FAILED',
          providerRefundId: 'rfnd_staff_supplied',
        });
        assert.equal(response.status, 409);
        const row = await server.db.get<{
          status: string;
          provider_refund_id: string;
        }>(
          'SELECT status, provider_refund_id FROM payment_refunds WHERE id = $1',
          [refundId],
        );
        assert.equal(row?.status, 'REQUIRES_REVIEW');
        assert.equal(row?.provider_refund_id, 'rfnd_already_recorded');
        const reserved = await server.db.get<{ sum: string | number }>(
          `SELECT COALESCE(SUM(amount_paise), 0) AS sum FROM payment_refunds
           WHERE payment_id = $1 AND status <> 'FAILED'`,
          [paymentId],
        );
        assert.equal(Number(reserved?.sum), 75000);
      });

      it('refuses a receipt-list result when two provider refunds share the receipt, in either order', async () => {
        for (const order of [
          ['failed', 'processed'],
          ['processed', 'failed'],
        ]) {
          const { paymentId, refundId, providerPaymentId, receipt } =
            await createPaymentWithException({ amountPaise: 75000 });
          scripted.paymentRefunds.set(
            providerPaymentId,
            order.map((status, index) =>
              providerRecord(providerPaymentId, {
                id: `rfnd_dup_receipt_${index}_${refundId.slice(0, 8)}`,
                status,
                receipt,
              }),
            ),
          );
          const response = await resolve(admin, refundId, {
            action: 'MARK_FAILED',
          });
          assert.equal(response.status, 409, order.join(','));
          assert.match(response.body.message, /more than one/i);
          await assertUntouched(refundId, paymentId, 75000);
        }
      });

      it('refuses a refund with neither a stored provider id nor a receipt to tie it by', async () => {
        const { paymentId, providerPaymentId } =
          await createPaymentWithException({ amountPaise: 75000 });
        // A refund row with no receipt (the receipt cannot be removed later)
        const refundId = randomUUID();
        await server.db.query(
          `INSERT INTO payment_refunds (
             id, payment_id, provider, provider_refund_id, receipt, amount_paise,
             currency, status, source, review_reason, created_at, updated_at
           ) VALUES ($1, $2, 'RAZORPAY', NULL, NULL, 10000, 'INR',
                     'REQUIRES_REVIEW', 'FINANCE_ADMIN', 'No receipt', now(), now())`,
          [refundId, paymentId],
        );
        scripted.refunds.set(
          'rfnd_nothing_to_bind',
          providerRecord(providerPaymentId, {
            id: 'rfnd_nothing_to_bind',
            amountPaise: 10000,
          }),
        );
        const response = await resolve(admin, refundId, {
          action: 'MARK_FAILED',
          providerRefundId: 'rfnd_nothing_to_bind',
        });
        assert.equal(response.status, 409);
        const row = await server.db.get<{
          status: string;
          provider_refund_id: string | null;
        }>(
          'SELECT status, provider_refund_id FROM payment_refunds WHERE id = $1',
          [refundId],
        );
        assert.equal(row?.status, 'REQUIRES_REVIEW');
        assert.equal(row?.provider_refund_id, null);
      });

      it('refuses ids that are not plain text, padded, or missing, on both lookup paths', async () => {
        const badIds: unknown[] = [
          12345,
          0,
          {},
          ['rfnd_x'],
          true,
          ' rfnd_pad ',
          null,
        ];
        for (const badId of badIds) {
          // Receipt-list path
          const listed = await createPaymentWithException({
            amountPaise: 75000,
          });
          scripted.paymentRefunds.set(listed.providerPaymentId, [
            providerRecord(listed.providerPaymentId, {
              id: badId,
              receipt: listed.receipt,
            }),
          ]);
          const viaList = await resolve(admin, listed.refundId, {
            action: 'MARK_FAILED',
          });
          assert.equal(viaList.status, 409, `list ${JSON.stringify(badId)}`);
          await assertUntouched(listed.refundId, listed.paymentId, 75000);

          // Direct path: the provider answers with an id that is not the one asked for
          const direct = await createPaymentWithException({
            amountPaise: 75000,
          });
          const asked = `rfnd_asked_${direct.refundId.slice(0, 8)}`;
          scripted.refunds.set(
            asked,
            providerRecord(direct.providerPaymentId, {
              id: badId,
              receipt: direct.receipt,
            }),
          );
          const viaId = await resolve(admin, direct.refundId, {
            action: 'MARK_FAILED',
            providerRefundId: asked,
          });
          assert.equal(viaId.status, 409, `direct ${JSON.stringify(badId)}`);
          await assertUntouched(direct.refundId, direct.paymentId, 75000);
        }
      });
    });
  });
});
