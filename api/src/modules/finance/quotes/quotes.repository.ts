import type { DatabaseClient, Row } from '../../../db/client.js';
import type { GstSupplyType, TaxQuote } from '../../../contracts/finance.js';

export type NewTaxQuote = {
  id: string;
  quoteKey: string;
  userId: string | null;
  customerEmail: string;
  itemType: 'TOPIC' | 'BATCH';
  itemId: string;
  customerType: 'INDIVIDUAL' | 'BUSINESS';
  taxableAmountPaise: number;
  gstRateBasisPoints: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalGstPaise: number;
  totalAmountPaise: number;
  supplierStateCode: string;
  placeOfSupplyStateCode: string;
  supplyType: GstSupplyType;
  sacCode: string;
  pricingMode: 'EXCLUSIVE';
  calculationVersion: string;
  roundingPolicy: string;
  expiresAt: string;
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

export const toTaxQuote = (row: Row): TaxQuote => ({
  id: String(row.id),
  quoteKey: String(row.quote_key),
  itemType: row.item_type as 'TOPIC' | 'BATCH',
  itemId: String(row.item_id),
  customerType: row.customer_type as 'INDIVIDUAL' | 'BUSINESS',
  taxableAmountPaise: toSafeInteger(
    row.taxable_amount_paise,
    'taxable_amount_paise',
  ),
  gstRateBasisPoints: Number(row.gst_rate_basis_points),
  cgstPaise: toSafeInteger(row.cgst_paise, 'cgst_paise'),
  sgstPaise: toSafeInteger(row.sgst_paise, 'sgst_paise'),
  igstPaise: toSafeInteger(row.igst_paise, 'igst_paise'),
  totalGstPaise: toSafeInteger(row.total_gst_paise, 'total_gst_paise'),
  totalAmountPaise: toSafeInteger(row.total_amount_paise, 'total_amount_paise'),
  supplierStateCode: String(row.supplier_state_code),
  placeOfSupplyStateCode: String(row.place_of_supply_state_code),
  supplyType: row.supply_type as GstSupplyType,
  sacCode: String(row.sac_code),
  pricingMode: 'EXCLUSIVE',
  calculationVersion: String(row.calculation_version),
  roundingPolicy: String(row.rounding_policy),
  status: row.status as 'ACTIVE' | 'CONSUMED' | 'EXPIRED',
  expiresAt: new Date(String(row.expires_at)).toISOString(),
  createdAt: new Date(String(row.created_at)).toISOString(),
});

export const insertTaxQuote = (db: DatabaseClient, quote: NewTaxQuote) =>
  db.query(
    `INSERT INTO tax_quotes (
       id, quote_key, user_id, customer_email, item_type, item_id,
       customer_type, taxable_amount_paise, gst_rate_basis_points,
       cgst_paise, sgst_paise, igst_paise, total_gst_paise, total_amount_paise,
       supplier_state_code, place_of_supply_state_code, supply_type,
       sac_code, pricing_mode, calculation_version, rounding_policy,
       status, expires_at, created_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
             $15, $16, $17, $18, $19, $20, $21, 'ACTIVE', $22, $23)`,
    [
      quote.id,
      quote.quoteKey,
      quote.userId,
      quote.customerEmail,
      quote.itemType,
      quote.itemId,
      quote.customerType,
      quote.taxableAmountPaise,
      quote.gstRateBasisPoints,
      quote.cgstPaise,
      quote.sgstPaise,
      quote.igstPaise,
      quote.totalGstPaise,
      quote.totalAmountPaise,
      quote.supplierStateCode,
      quote.placeOfSupplyStateCode,
      quote.supplyType,
      quote.sacCode,
      quote.pricingMode,
      quote.calculationVersion,
      quote.roundingPolicy,
      quote.expiresAt,
      quote.timestamp,
    ],
  );

export const findTaxQuoteById = async (
  db: DatabaseClient,
  id: string,
): Promise<TaxQuote | null> => {
  const row = await db.get('SELECT * FROM tax_quotes WHERE id = $1', [id]);
  return row ? toTaxQuote(row) : null;
};

// The quote row (with its owner), locked for the redeeming transaction
export const findTaxQuoteRowForUpdate = (db: DatabaseClient, id: string) =>
  db.get<Row>('SELECT * FROM tax_quotes WHERE id = $1 FOR UPDATE', [id]);

export const findActiveTaxQuoteByKey = async (
  db: DatabaseClient,
  quoteKey: string,
  nowIso: string,
): Promise<TaxQuote | null> => {
  const row = await db.get(
    `SELECT * FROM tax_quotes
     WHERE quote_key = $1 AND status = 'ACTIVE' AND expires_at > $2
     ORDER BY created_at DESC LIMIT 1`,
    [quoteKey, nowIso],
  );
  return row ? toTaxQuote(row) : null;
};

/**
 * Atomically consumes a tax quote.
 * Guarantees that an already consumed or expired quote cannot be re-used.
 */
export const consumeTaxQuote = async (
  db: DatabaseClient,
  id: string,
  timestamp: string,
): Promise<TaxQuote | null> => {
  const row = await db.get(
    `UPDATE tax_quotes
     SET status = 'CONSUMED', consumed_at = $2
     WHERE id = $1 AND status = 'ACTIVE' AND expires_at > $2
     RETURNING *`,
    [id, timestamp],
  );
  return row ? toTaxQuote(row) : null;
};
