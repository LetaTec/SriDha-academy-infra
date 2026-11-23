import { Router } from 'express';
import { z } from 'zod';

import type { AppContext } from '../../app/context.js';
import type {
  AuditLogResponse,
  HistoricalPaymentsReportResponse,
  InvoiceResponse,
  ReconcileRefundsRequestBody,
  ReconcileRefundsResponse,
  RefundDetailResponse,
  RefundExceptionsResponse,
  RefundResponse,
  RefundsListResponse,
  ResolveRefundExceptionResponse,
  TaxApprovalResponse,
  TaxApprovalsResponse,
} from '../../contracts/finance.js';
import { ApiError, ERROR_CODE } from '../../http/errors.js';
import { validate } from '../../http/validate.js';
import { requirePermission } from '../auth/permissions.js';
import { requireAuth } from '../auth/session.js';
import { createPaymentGateway } from '../payments/gateway.js';
import {
  refundRequestSchema,
  requestRefund,
} from '../payments/payments.refunds.js';
import { reconcilePendingRefunds } from '../payments/payments.refunds.reconciliation.js';
import { findInvoiceByPaymentId } from './invoices/invoices.repository.js';
import {
  listTaxApprovals,
  recordTaxApproval,
  taxApprovalRequestSchema,
} from './invoices/taxApprovals.service.js';
import { findTaxSnapshotByPaymentId } from './invoices/taxSnapshots.repository.js';
import {
  AUDIT_ACTION,
  listAuditEntries,
  recordAudit,
} from './audit.service.js';
import {
  DEFAULT_HISTORICAL_SINCE_IST,
  formatToIst,
  generateHistoricalPaymentsReport,
  listRefundExceptions,
  toHistoricalPaymentsCsv,
} from './reports.service.js';
import {
  getRefundDetail,
  listRefundsDesk,
  resolveRefundException,
  resolveRefundExceptionSchema,
} from './refundsDesk.service.js';

const pageQuery = z.strictObject({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const reconcileRefundsSchema = z.strictObject({
  olderThanMinutes: z.number().int().min(0).max(43200).optional(),
}) satisfies z.ZodType<ReconcileRefundsRequestBody>;

const historicalReportQuery = z.strictObject({
  format: z.enum(['json', 'csv']).default('json'),
  since: z.string().optional(),
  includeTest: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .transform(val => val === true || val === 'true' || val === '1')
    .default(true),
});

// The finance area: staff only, every route behind a permission check.
// Responses carry financial and personal data, so they are never cached
// (the API sets no-store on everything).
export const createFinanceRouter = (context: AppContext) => {
  const router = Router();
  const gateway =
    context.paymentGateway ?? createPaymentGateway(context.config);

  router.use(requireAuth);

  router.post(
    '/payments/:paymentId/refunds',
    requirePermission(context, 'manageRefunds'),
    async (req, res) => {
      const input = validate(refundRequestSchema, req.body);
      const { refund, created } = await requestRefund(
        context,
        gateway,
        req.staff!,
        String(req.params.paymentId),
        input,
      );
      res.status(created ? 201 : 200).json({ refund } satisfies RefundResponse);
    },
  );

  router.post(
    '/refunds/reconcile',
    requirePermission(context, 'manageRefunds'),
    async (req, res) => {
      const input = validate(reconcileRefundsSchema, req.body ?? {});
      const result = await reconcilePendingRefunds(context, gateway, input);
      res.json(result satisfies ReconcileRefundsResponse);
    },
  );

  router.get(
    '/audit-log',
    requirePermission(context, 'viewAuditLog'),
    async (req, res) => {
      const page = validate(pageQuery, req.query, 'query');
      res.json({
        entries: await listAuditEntries(context.db, page),
      } satisfies AuditLogResponse);
    },
  );

  router.get(
    '/reports/historical-payments',
    requirePermission(context, 'viewFinanceReports'),
    async (req, res) => {
      const query = validate(historicalReportQuery, req.query, 'query');
      let sinceDate = DEFAULT_HISTORICAL_SINCE_IST;
      if (query.since) {
        sinceDate = new Date(query.since);
        if (Number.isNaN(sinceDate.getTime())) {
          throw new ApiError(
            400,
            ERROR_CODE.requestValidationFailed,
            'The since query parameter must be a valid date or timestamp',
          );
        }
      }

      const report = await generateHistoricalPaymentsReport(
        context.db,
        context.now,
        sinceDate,
      );

      await recordAudit(context.db, {
        actor: req.staff ?? null,
        action: AUDIT_ACTION.reportExported,
        entityType: 'REPORT',
        entityId: 'HISTORICAL_PAYMENTS',
        details: {
          format: query.format,
          scopeSince: sinceDate.toISOString(),
          realCount: report.summary.realPaymentsCount,
          testCount: report.summary.testPaymentsCount,
        },
        at: context.now(),
      });

      if (query.format === 'csv') {
        const csv = toHistoricalPaymentsCsv(report, query.includeTest);
        const fileDate = formatToIst(context.now()).formatted.slice(0, 10);
        res
          .status(200)
          .setHeader('Content-Type', 'text/csv; charset=utf-8')
          .setHeader(
            'Content-Disposition',
            `attachment; filename="historical-payments-report-${fileDate}.csv"`,
          )
          .send(csv);
        return;
      }

      res.json(report satisfies HistoricalPaymentsReportResponse);
    },
  );

  router.get(
    '/invoices/:paymentId',
    requirePermission(context, 'viewFinanceReports'),
    async (req, res) => {
      const paymentId = String(req.params.paymentId);
      const invoice = await findInvoiceByPaymentId(context.db, paymentId);
      const snapshot = await findTaxSnapshotByPaymentId(context.db, paymentId);
      if (!invoice || !snapshot) {
        throw new ApiError(
          404,
          ERROR_CODE.notFound,
          'Invoice or tax snapshot not found for this payment',
        );
      }
      res.json({ invoice, snapshot } satisfies InvoiceResponse);
    },
  );

  // Refunds finance must resolve by hand (read-only)
  router.get(
    '/refund-exceptions',
    requirePermission(context, 'viewPayments'),
    async (_req, res) => {
      res.json(
        (await listRefundExceptions(
          context.db,
        )) satisfies RefundExceptionsResponse,
      );
    },
  );

  // Refund Management Desk: paginated, searchable list of all refunds with KPIs
  router.get(
    '/refunds',
    requirePermission(context, 'viewPayments'),
    async (req, res) => {
      const status =
        typeof req.query.status === 'string' ? req.query.status : undefined;
      const search =
        typeof req.query.search === 'string' ? req.query.search : undefined;
      const limit =
        typeof req.query.limit === 'string'
          ? parseInt(req.query.limit, 10)
          : undefined;
      const offset =
        typeof req.query.offset === 'string'
          ? parseInt(req.query.offset, 10)
          : undefined;

      const result = await listRefundsDesk(context.db, {
        status,
        search,
        limit: Number.isNaN(limit) ? undefined : limit,
        offset: Number.isNaN(offset) ? undefined : offset,
      });

      res.json(result satisfies RefundsListResponse);
    },
  );

  // Refund Management Desk: inspection details with payment and audit trail
  router.get(
    '/refunds/:id',
    requirePermission(context, 'viewPayments'),
    async (req, res) => {
      const id = String(req.params.id);
      const result = await getRefundDetail(context.db, id);
      res.json(result satisfies RefundDetailResponse);
    },
  );

  // Refund Management Desk: resolve a refund exception with verified provider evidence
  router.post(
    '/refund-exceptions/:id/resolve',
    requirePermission(context, 'manageRefunds'),
    async (req, res) => {
      const id = String(req.params.id);
      const input = validate(resolveRefundExceptionSchema, req.body);
      const gateway =
        context.paymentGateway ?? createPaymentGateway(context.config);
      const result = await resolveRefundException(
        context.db,
        gateway,
        id,
        req.staff!,
        input,
        context.now(),
      );
      res.status(200).json(result satisfies ResolveRefundExceptionResponse);
    },
  );

  // The CA approval of the tax configuration: one of the two switches for
  // invoicing (the other is INVOICING_ENABLED in the environment)
  router.get(
    '/tax-approvals',
    requirePermission(context, 'viewFinanceReports'),
    async (_req, res) => {
      res.json(
        (await listTaxApprovals(context)) satisfies TaxApprovalsResponse,
      );
    },
  );

  router.post(
    '/tax-approvals',
    requirePermission(context, 'manageTaxConfiguration'),
    async (req, res) => {
      const input = validate(taxApprovalRequestSchema, req.body);
      const result = await recordTaxApproval(context, req.staff!, input);
      res.status(201).json(result satisfies TaxApprovalResponse);
    },
  );

  return router;
};
