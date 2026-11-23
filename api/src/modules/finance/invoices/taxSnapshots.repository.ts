import type { DatabaseClient, Row } from '../../../db/client.js';
import type { GstSupplyType, TaxSnapshot } from '../../../contracts/finance.js';

export type NewTaxSnapshot = {
  id: string;
  paymentId: string;
  invoiceId: string | null;
  quoteId: string | null;
  supplierLegalName: string;
  supplierGstin: string;
  supplierStateCode: string;
  supplierAddress: string;
  recipientName: string;
  recipientEmail: string;
  recipientMobile: string;
  recipientCustomerType: 'INDIVIDUAL' | 'BUSINESS';
  recipientAddressLine1: string;
  recipientAddressLine2: string | null;
  recipientCity: string;
  recipientState: string;
  recipientStateCode: string;
  recipientPinCode: string;
  recipientBusinessName: string | null;
  recipientGstin: string | null;
  recipientGstinStateCode: string | null;
  placeOfSupplyStateCode: string;
  supplyType: GstSupplyType;
  sacCode: string;
  pricingMode: 'EXCLUSIVE';
  taxableAmountPaise: number;
  gstRateBasisPoints: number;
  cgstRateBasisPoints: number;
  cgstPaise: number;
  sgstRateBasisPoints: number;
  sgstPaise: number;
  igstRateBasisPoints: number;
  igstPaise: number;
  totalGstPaise: number;
  totalAmountPaise: number;
  calculationVersion: string;
  roundingPolicy: string;
  timestamp: string;
};

const toSafeInteger = (val: unknown, fieldName: string): number => {
  const num = typeof val === 'bigint' ? Number(val) : Number(val);
  if (!Number.isSafeInteger(num)) {
    throw new RangeError(
      `Monetary value for ${fieldName} exceeds safe integer limit: ${String(val)}`,
    );
  }
  return num;
};

export const toTaxSnapshot = (row: Row): TaxSnapshot => ({
  id: String(row.id),
  paymentId: String(row.payment_id),
  invoiceId: row.invoice_id ? String(row.invoice_id) : null,
  quoteId: row.quote_id ? String(row.quote_id) : null,
  supplierLegalName: String(row.supplier_legal_name),
  supplierGstin: String(row.supplier_gstin),
  supplierStateCode: String(row.supplier_state_code),
  supplierAddress: String(row.supplier_address),
  recipientName: String(row.recipient_name),
  recipientEmail: String(row.recipient_email),
  recipientMobile: String(row.recipient_mobile),
  recipientCustomerType: row.recipient_customer_type as
    'INDIVIDUAL' | 'BUSINESS',
  recipientAddressLine1: String(row.recipient_address_line1),
  recipientAddressLine2: row.recipient_address_line2
    ? String(row.recipient_address_line2)
    : null,
  recipientCity: String(row.recipient_city),
  recipientState: String(row.recipient_state),
  recipientStateCode: String(row.recipient_state_code),
  recipientPinCode: String(row.recipient_pin_code),
  recipientBusinessName: row.recipient_business_name
    ? String(row.recipient_business_name)
    : null,
  recipientGstin: row.recipient_gstin ? String(row.recipient_gstin) : null,
  recipientGstinStateCode: row.recipient_gstin_state_code
    ? String(row.recipient_gstin_state_code)
    : null,
  placeOfSupplyStateCode: String(row.place_of_supply_state_code),
  supplyType: row.supply_type as GstSupplyType,
  sacCode: String(row.sac_code),
  pricingMode: 'EXCLUSIVE',
  taxableAmountPaise: toSafeInteger(
    row.taxable_amount_paise,
    'taxable_amount_paise',
  ),
  gstRateBasisPoints: Number(row.gst_rate_basis_points),
  cgstRateBasisPoints: Number(row.cgst_rate_basis_points),
  cgstPaise: toSafeInteger(row.cgst_paise, 'cgst_paise'),
  sgstRateBasisPoints: Number(row.sgst_rate_basis_points),
  sgstPaise: toSafeInteger(row.sgst_paise, 'sgst_paise'),
  igstRateBasisPoints: Number(row.igst_rate_basis_points),
  igstPaise: toSafeInteger(row.igst_paise, 'igst_paise'),
  totalGstPaise: toSafeInteger(row.total_gst_paise, 'total_gst_paise'),
  totalAmountPaise: toSafeInteger(row.total_amount_paise, 'total_amount_paise'),
  calculationVersion: String(row.calculation_version),
  roundingPolicy: String(row.rounding_policy),
  createdAt: new Date(String(row.created_at)).toISOString(),
});

export const insertTaxSnapshot = (
  db: DatabaseClient,
  snapshot: NewTaxSnapshot,
) =>
  db.query(
    `INSERT INTO payment_tax_snapshots (
       id, payment_id, invoice_id, quote_id, supplier_legal_name,
       supplier_gstin, supplier_state_code, supplier_address, recipient_name,
       recipient_email, recipient_mobile, recipient_customer_type,
       recipient_address_line1, recipient_address_line2, recipient_city,
       recipient_state, recipient_state_code, recipient_pin_code,
       recipient_business_name, recipient_gstin, recipient_gstin_state_code,
       place_of_supply_state_code, supply_type, sac_code, pricing_mode,
       taxable_amount_paise, gst_rate_basis_points, cgst_rate_basis_points,
       cgst_paise, sgst_rate_basis_points, sgst_paise, igst_rate_basis_points,
       igst_paise, total_gst_paise, total_amount_paise, calculation_version,
       rounding_policy, created_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
             $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26,
             $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38)`,
    [
      snapshot.id,
      snapshot.paymentId,
      snapshot.invoiceId,
      snapshot.quoteId,
      snapshot.supplierLegalName,
      snapshot.supplierGstin,
      snapshot.supplierStateCode,
      snapshot.supplierAddress,
      snapshot.recipientName,
      snapshot.recipientEmail,
      snapshot.recipientMobile,
      snapshot.recipientCustomerType,
      snapshot.recipientAddressLine1,
      snapshot.recipientAddressLine2,
      snapshot.recipientCity,
      snapshot.recipientState,
      snapshot.recipientStateCode,
      snapshot.recipientPinCode,
      snapshot.recipientBusinessName,
      snapshot.recipientGstin,
      snapshot.recipientGstinStateCode,
      snapshot.placeOfSupplyStateCode,
      snapshot.supplyType,
      snapshot.sacCode,
      snapshot.pricingMode,
      snapshot.taxableAmountPaise,
      snapshot.gstRateBasisPoints,
      snapshot.cgstRateBasisPoints,
      snapshot.cgstPaise,
      snapshot.sgstRateBasisPoints,
      snapshot.sgstPaise,
      snapshot.igstRateBasisPoints,
      snapshot.igstPaise,
      snapshot.totalGstPaise,
      snapshot.totalAmountPaise,
      snapshot.calculationVersion,
      snapshot.roundingPolicy,
      snapshot.timestamp,
    ],
  );

export const findTaxSnapshotByPaymentId = async (
  db: DatabaseClient,
  paymentId: string,
): Promise<TaxSnapshot | null> => {
  const row = await db.get(
    'SELECT * FROM payment_tax_snapshots WHERE payment_id = $1',
    [paymentId],
  );
  return row ? toTaxSnapshot(row) : null;
};
