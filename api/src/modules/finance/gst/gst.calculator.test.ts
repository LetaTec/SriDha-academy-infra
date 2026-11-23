import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_TAX_CONFIG,
  GST_RATE_BP,
  SUPPLIER_CONFIG,
} from './gst.config.js';
import {
  calculateGst,
  calculateSriDhaGst,
  classifySupplyType,
  normalizeCustomerType,
  validateGstStateCode,
} from './gst.calculator.js';
import { determinePlaceOfSupply } from './gst.placeOfSupply.js';
import { computeTaxPaise, roundHalfUp } from './gst.rounding.js';
import { GST_ERROR_CODE, GstCalculationError } from './gst.types.js';

describe('GST Calculation Engine (Milestone 5)', () => {
  const RAJASTHAN = '08';
  const MAHARASHTRA = '27';
  const DELHI = '07';
  const KARNATAKA = '29';
  const GUJARAT = '24';
  const STANDARD_SAC = '999293';
  const RATE_18_BP = 1800; // 18%

  describe('A. Rajasthan Intra-state Supply (08 -> 08)', () => {
    it('calculates 9% CGST and 9% SGST on ₹1,000.00 (100,000 paise)', () => {
      const result = calculateGst({
        taxableAmountPaise: 100000,
        supplierStateCode: RAJASTHAN,
        placeOfSupplyStateCode: RAJASTHAN,
        customerType: 'INDIVIDUAL',
        sacCode: STANDARD_SAC,
        gstRateBasisPoints: RATE_18_BP,
        pricingMode: 'EXCLUSIVE',
      });

      assert.equal(result.taxableAmountPaise, 100000);
      assert.equal(result.supplyType, 'INTRA_STATE');
      assert.equal(result.gstRateBasisPoints, 1800);

      // Intra-state split
      assert.equal(result.cgstRateBasisPoints, 900);
      assert.equal(result.cgstPaise, 9000); // ₹90.00
      assert.equal(result.sgstRateBasisPoints, 900);
      assert.equal(result.sgstPaise, 9000); // ₹90.00
      assert.equal(result.igstRateBasisPoints, 0);
      assert.equal(result.igstPaise, 0);

      // Totals
      assert.equal(result.totalGstPaise, 18000); // ₹180.00
      assert.equal(result.totalAmountPaise, 118000); // ₹1,180.00

      // Invariants
      assert.equal(result.cgstPaise + result.sgstPaise, result.totalGstPaise);
      assert.equal(
        result.taxableAmountPaise + result.totalGstPaise,
        result.totalAmountPaise,
      );
      assert.equal(result.pricingMode, 'EXCLUSIVE');
      assert.equal(result.sacCode, STANDARD_SAC);
      assert.equal(result.customerType, 'INDIVIDUAL');
    });

    it('works identically via calculateSriDhaGst helper for intra-state', () => {
      assert.equal(DEFAULT_TAX_CONFIG.sacCode, '999293');
      assert.equal(DEFAULT_TAX_CONFIG.gstRateBasisPoints, 1800);
      assert.equal(DEFAULT_TAX_CONFIG.pricingMode, 'EXCLUSIVE');

      const result = calculateSriDhaGst({
        taxableAmountPaise: 100000,
        placeOfSupplyStateCode: RAJASTHAN,
        customerType: 'INDIVIDUAL',
      });

      assert.equal(result.supplyType, 'INTRA_STATE');
      assert.equal(result.supplierStateCode, SUPPLIER_CONFIG.stateCode);
      assert.equal(result.placeOfSupplyStateCode, RAJASTHAN);
      assert.equal(result.cgstPaise, 9000);
      assert.equal(result.sgstPaise, 9000);
      assert.equal(result.igstPaise, 0);
      assert.equal(result.totalGstPaise, 18000);
      assert.equal(result.totalAmountPaise, 118000);
    });
  });

  describe('B. Inter-state Supply (08 -> Other States)', () => {
    it('calculates 18% IGST on ₹1,000.00 to Maharashtra (27)', () => {
      const result = calculateGst({
        taxableAmountPaise: 100000,
        supplierStateCode: RAJASTHAN,
        placeOfSupplyStateCode: MAHARASHTRA,
        customerType: 'BUSINESS',
        sacCode: STANDARD_SAC,
        gstRateBasisPoints: RATE_18_BP,
        pricingMode: 'EXCLUSIVE',
      });

      assert.equal(result.taxableAmountPaise, 100000);
      assert.equal(result.supplyType, 'INTER_STATE');
      assert.equal(result.gstRateBasisPoints, 1800);

      // Inter-state allocation
      assert.equal(result.cgstRateBasisPoints, 0);
      assert.equal(result.cgstPaise, 0);
      assert.equal(result.sgstRateBasisPoints, 0);
      assert.equal(result.sgstPaise, 0);
      assert.equal(result.igstRateBasisPoints, 1800);
      assert.equal(result.igstPaise, 18000); // ₹180.00

      // Totals
      assert.equal(result.totalGstPaise, 18000);
      assert.equal(result.totalAmountPaise, 118000);
      assert.equal(result.customerType, 'BUSINESS');
    });

    it('calculates 18% IGST to Delhi (07), Karnataka (29), Gujarat (24)', () => {
      for (const destState of [DELHI, KARNATAKA, GUJARAT]) {
        const result = calculateGst({
          taxableAmountPaise: 200000, // ₹2,000.00
          supplierStateCode: RAJASTHAN,
          placeOfSupplyStateCode: destState,
          customerType: 'INDIVIDUAL',
          sacCode: STANDARD_SAC,
          gstRateBasisPoints: RATE_18_BP,
          pricingMode: 'EXCLUSIVE',
        });

        assert.equal(result.supplyType, 'INTER_STATE');
        assert.equal(result.igstPaise, 36000); // ₹360.00
        assert.equal(result.cgstPaise, 0);
        assert.equal(result.sgstPaise, 0);
        assert.equal(result.totalGstPaise, 36000);
        assert.equal(result.totalAmountPaise, 236000);
      }
    });
  });

  describe('C. Different Transaction Amounts', () => {
    it('calculates tax for ₹129.00 (12,900 paise)', () => {
      // Intra-state
      const intra = calculateGst({
        taxableAmountPaise: 12900,
        supplierStateCode: RAJASTHAN,
        placeOfSupplyStateCode: RAJASTHAN,
        customerType: 'INDIVIDUAL',
        sacCode: STANDARD_SAC,
        gstRateBasisPoints: RATE_18_BP,
        pricingMode: 'EXCLUSIVE',
      });
      assert.equal(intra.cgstPaise, 1161); // ₹11.61
      assert.equal(intra.sgstPaise, 1161); // ₹11.61
      assert.equal(intra.totalGstPaise, 2322); // ₹23.22
      assert.equal(intra.totalAmountPaise, 15222); // ₹152.22

      // Inter-state
      const inter = calculateGst({
        taxableAmountPaise: 12900,
        supplierStateCode: RAJASTHAN,
        placeOfSupplyStateCode: MAHARASHTRA,
        customerType: 'INDIVIDUAL',
        sacCode: STANDARD_SAC,
        gstRateBasisPoints: RATE_18_BP,
        pricingMode: 'EXCLUSIVE',
      });
      assert.equal(inter.igstPaise, 2322);
      assert.equal(inter.totalGstPaise, 2322);
      assert.equal(inter.totalAmountPaise, 15222);
    });

    it('calculates tax for ₹499.00 (49,900 paise)', () => {
      const intra = calculateGst({
        taxableAmountPaise: 49900,
        supplierStateCode: RAJASTHAN,
        placeOfSupplyStateCode: RAJASTHAN,
        customerType: 'INDIVIDUAL',
        sacCode: STANDARD_SAC,
        gstRateBasisPoints: RATE_18_BP,
        pricingMode: 'EXCLUSIVE',
      });
      assert.equal(intra.cgstPaise, 4491); // ₹44.91
      assert.equal(intra.sgstPaise, 4491); // ₹44.91
      assert.equal(intra.totalGstPaise, 8982); // ₹89.82
      assert.equal(intra.totalAmountPaise, 58882); // ₹588.82

      const inter = calculateGst({
        taxableAmountPaise: 49900,
        supplierStateCode: RAJASTHAN,
        placeOfSupplyStateCode: MAHARASHTRA,
        customerType: 'INDIVIDUAL',
        sacCode: STANDARD_SAC,
        gstRateBasisPoints: RATE_18_BP,
        pricingMode: 'EXCLUSIVE',
      });
      assert.equal(inter.igstPaise, 8982);
      assert.equal(inter.totalGstPaise, 8982);
      assert.equal(inter.totalAmountPaise, 58882);
    });

    it('calculates tax for ₹999.00 (99,900 paise)', () => {
      const intra = calculateGst({
        taxableAmountPaise: 99900,
        supplierStateCode: RAJASTHAN,
        placeOfSupplyStateCode: RAJASTHAN,
        customerType: 'INDIVIDUAL',
        sacCode: STANDARD_SAC,
        gstRateBasisPoints: RATE_18_BP,
        pricingMode: 'EXCLUSIVE',
      });
      assert.equal(intra.cgstPaise, 8991); // ₹89.91
      assert.equal(intra.sgstPaise, 8991); // ₹89.91
      assert.equal(intra.totalGstPaise, 17982); // ₹179.82
      assert.equal(intra.totalAmountPaise, 117882); // ₹1,178.82

      const inter = calculateGst({
        taxableAmountPaise: 99900,
        supplierStateCode: RAJASTHAN,
        placeOfSupplyStateCode: MAHARASHTRA,
        customerType: 'INDIVIDUAL',
        sacCode: STANDARD_SAC,
        gstRateBasisPoints: RATE_18_BP,
        pricingMode: 'EXCLUSIVE',
      });
      assert.equal(inter.igstPaise, 17982);
      assert.equal(inter.totalGstPaise, 17982);
      assert.equal(inter.totalAmountPaise, 117882);
    });

    it('calculates tax for ₹10,000.00 (1,000,000 paise)', () => {
      const intra = calculateGst({
        taxableAmountPaise: 1000000,
        supplierStateCode: RAJASTHAN,
        placeOfSupplyStateCode: RAJASTHAN,
        customerType: 'BUSINESS',
        sacCode: STANDARD_SAC,
        gstRateBasisPoints: RATE_18_BP,
        pricingMode: 'EXCLUSIVE',
      });
      assert.equal(intra.cgstPaise, 90000); // ₹900.00
      assert.equal(intra.sgstPaise, 90000); // ₹900.00
      assert.equal(intra.totalGstPaise, 180000); // ₹1,800.00
      assert.equal(intra.totalAmountPaise, 1180000); // ₹11,800.00
    });

    it('handles large transaction values accurately without overflow or precision loss', () => {
      // ₹1,00,00,000.00 (1 Crore = 100,000,000 paise)
      const oneCrore = 100000000;
      const result = calculateGst({
        taxableAmountPaise: oneCrore,
        supplierStateCode: RAJASTHAN,
        placeOfSupplyStateCode: RAJASTHAN,
        customerType: 'BUSINESS',
        sacCode: STANDARD_SAC,
        gstRateBasisPoints: RATE_18_BP,
        pricingMode: 'EXCLUSIVE',
      });
      assert.equal(result.cgstPaise, 9000000); // ₹9,00,000.00
      assert.equal(result.sgstPaise, 9000000); // ₹9,00,000.00
      assert.equal(result.totalGstPaise, 18000000); // ₹18,00,000.00
      assert.equal(result.totalAmountPaise, 118000000); // ₹1,18,00,000.00
      assert.ok(Number.isSafeInteger(result.totalAmountPaise));
    });
  });

  describe('D. Monetary Precision and Rounding Policy', () => {
    it('implements pure roundHalfUp integer math', () => {
      // 0.50 rounds up to 1
      assert.equal(roundHalfUp(5000n, 10000n), 1n);
      // 0.4999 rounds down to 0
      assert.equal(roundHalfUp(4999n, 10000n), 0n);
      // 1.50 rounds up to 2
      assert.equal(roundHalfUp(15000n, 10000n), 2n);
      // 1.4999 rounds down to 1
      assert.equal(roundHalfUp(14999n, 10000n), 1n);
      // 0 rounds to 0
      assert.equal(roundHalfUp(0n, 10000n), 0n);
    });

    it('handles half-paisa boundaries correctly', () => {
      // 550 paise at 9% = 49.50 paise -> rounds half-up to 50 paise
      assert.equal(computeTaxPaise(550, 900), 50);

      // 549 paise at 9% = 49.41 paise -> rounds to 49 paise
      assert.equal(computeTaxPaise(549, 900), 49);

      // 555 paise at 9% = 49.95 paise -> rounds to 50 paise
      assert.equal(computeTaxPaise(555, 900), 50);
    });

    it('preserves component symmetry and invariant: totalGst === cgst + sgst', () => {
      // Odd taxable amounts in paise
      for (const amount of [1, 3, 7, 13, 27, 49, 129, 499, 999, 1001, 77777]) {
        const intra = calculateGst({
          taxableAmountPaise: amount,
          supplierStateCode: RAJASTHAN,
          placeOfSupplyStateCode: RAJASTHAN,
          customerType: 'INDIVIDUAL',
          sacCode: STANDARD_SAC,
          gstRateBasisPoints: RATE_18_BP,
          pricingMode: 'EXCLUSIVE',
        });

        // Symmetry: CGST and SGST are always identical when rates match
        assert.equal(intra.cgstPaise, intra.sgstPaise);
        // Component sum invariant
        assert.equal(intra.totalGstPaise, intra.cgstPaise + intra.sgstPaise);
        // Total invariant
        assert.equal(
          intra.totalAmountPaise,
          intra.taxableAmountPaise + intra.totalGstPaise,
        );
      }
    });

    it('rejects invalid inputs to roundHalfUp', () => {
      assert.throws(() => roundHalfUp(10n, 0n), RangeError);
      assert.throws(() => roundHalfUp(10n, -5n), RangeError);
      assert.throws(() => roundHalfUp(-5n, 10n), RangeError);
    });
  });

  describe('E. Input Validation and Failure Modes', () => {
    it('rejects negative or zero taxable amounts', () => {
      for (const amount of [0, -1, -500, -10000]) {
        assert.throws(
          () =>
            calculateGst({
              taxableAmountPaise: amount,
              supplierStateCode: RAJASTHAN,
              placeOfSupplyStateCode: RAJASTHAN,
              customerType: 'INDIVIDUAL',
              sacCode: STANDARD_SAC,
              gstRateBasisPoints: RATE_18_BP,
              pricingMode: 'EXCLUSIVE',
            }),
          (err: GstCalculationError) =>
            err.code === GST_ERROR_CODE.invalidTaxableAmount,
        );
      }
    });

    it('rejects non-integer and unsafe integer amounts', () => {
      for (const amount of [
        1.5,
        NaN,
        Infinity,
        -Infinity,
        Number.MAX_SAFE_INTEGER + 10,
      ]) {
        assert.throws(
          () =>
            calculateGst({
              taxableAmountPaise: amount,
              supplierStateCode: RAJASTHAN,
              placeOfSupplyStateCode: RAJASTHAN,
              customerType: 'INDIVIDUAL',
              sacCode: STANDARD_SAC,
              gstRateBasisPoints: RATE_18_BP,
              pricingMode: 'EXCLUSIVE',
            }),
          (err: GstCalculationError) =>
            err.code === GST_ERROR_CODE.invalidTaxableAmount,
        );
      }
    });

    it('rejects unknown GST state codes for supplier and place of supply', () => {
      for (const invalidCode of ['00', '99', 'XX', '', '  ', '8', '999']) {
        assert.throws(
          () =>
            calculateGst({
              taxableAmountPaise: 100000,
              supplierStateCode: invalidCode,
              placeOfSupplyStateCode: RAJASTHAN,
              customerType: 'INDIVIDUAL',
              sacCode: STANDARD_SAC,
              gstRateBasisPoints: RATE_18_BP,
              pricingMode: 'EXCLUSIVE',
            }),
          (err: GstCalculationError) =>
            err.code === GST_ERROR_CODE.invalidStateCode,
        );

        assert.throws(
          () =>
            calculateGst({
              taxableAmountPaise: 100000,
              supplierStateCode: RAJASTHAN,
              placeOfSupplyStateCode: invalidCode,
              customerType: 'INDIVIDUAL',
              sacCode: STANDARD_SAC,
              gstRateBasisPoints: RATE_18_BP,
              pricingMode: 'EXCLUSIVE',
            }),
          (err: GstCalculationError) =>
            err.code === GST_ERROR_CODE.invalidStateCode,
        );
      }
    });

    it('accepts legacy state codes 28 (Andhra Pradesh) and 25 (Daman and Diu)', () => {
      const apLegacy = calculateGst({
        taxableAmountPaise: 100000,
        supplierStateCode: RAJASTHAN,
        placeOfSupplyStateCode: '28',
        customerType: 'INDIVIDUAL',
        sacCode: STANDARD_SAC,
        gstRateBasisPoints: RATE_18_BP,
        pricingMode: 'EXCLUSIVE',
      });
      assert.equal(apLegacy.supplyType, 'INTER_STATE');
      assert.equal(apLegacy.placeOfSupplyStateCode, '28');

      const ddLegacy = calculateGst({
        taxableAmountPaise: 100000,
        supplierStateCode: RAJASTHAN,
        placeOfSupplyStateCode: '25',
        customerType: 'BUSINESS',
        sacCode: STANDARD_SAC,
        gstRateBasisPoints: RATE_18_BP,
        pricingMode: 'EXCLUSIVE',
      });
      assert.equal(ddLegacy.supplyType, 'INTER_STATE');
      assert.equal(ddLegacy.placeOfSupplyStateCode, '25');
    });

    it('rejects malformed SAC codes', () => {
      for (const badSac of ['999', '99929', '9992931', 'ABCDEF', '99 92', '']) {
        assert.throws(
          () =>
            calculateGst({
              taxableAmountPaise: 100000,
              supplierStateCode: RAJASTHAN,
              placeOfSupplyStateCode: RAJASTHAN,
              customerType: 'INDIVIDUAL',
              sacCode: badSac,
              gstRateBasisPoints: RATE_18_BP,
              pricingMode: 'EXCLUSIVE',
            }),
          (err: GstCalculationError) =>
            err.code === GST_ERROR_CODE.invalidSacCode,
        );
      }
    });

    it('rejects out-of-range or non-integer GST rates', () => {
      for (const rate of [-1, -100, 10001, 50000, 18.5, NaN]) {
        assert.throws(
          () =>
            calculateGst({
              taxableAmountPaise: 100000,
              supplierStateCode: RAJASTHAN,
              placeOfSupplyStateCode: RAJASTHAN,
              customerType: 'INDIVIDUAL',
              sacCode: STANDARD_SAC,
              gstRateBasisPoints: rate,
              pricingMode: 'EXCLUSIVE',
            }),
          (err: GstCalculationError) =>
            err.code === GST_ERROR_CODE.invalidGstRate,
        );
      }
    });

    it('rejects odd basis-point rates for intra-state supply', () => {
      assert.throws(
        () =>
          calculateGst({
            taxableAmountPaise: 100000,
            supplierStateCode: RAJASTHAN,
            placeOfSupplyStateCode: RAJASTHAN,
            customerType: 'INDIVIDUAL',
            sacCode: STANDARD_SAC,
            gstRateBasisPoints: 1775, // Odd rate cannot split equally into integer bp
            pricingMode: 'EXCLUSIVE',
          }),
        (err: GstCalculationError) =>
          err.code === GST_ERROR_CODE.oddIntraStateRate,
      );
    });

    it('rejects unsupported INCLUSIVE pricing mode with clear error', () => {
      assert.throws(
        () =>
          calculateGst({
            taxableAmountPaise: 100000,
            supplierStateCode: RAJASTHAN,
            placeOfSupplyStateCode: RAJASTHAN,
            customerType: 'INDIVIDUAL',
            sacCode: STANDARD_SAC,
            gstRateBasisPoints: RATE_18_BP,
            pricingMode: 'INCLUSIVE',
          }),
        (err: GstCalculationError) => {
          assert.equal(err.code, GST_ERROR_CODE.unsupportedPricingMode);
          assert.match(
            err.message,
            /Inclusive pricing mode is currently unsupported/,
          );
          return true;
        },
      );
    });

    it('rejects invalid customer types', () => {
      for (const invalidType of [
        'STUDENT',
        'FOREIGN',
        'GOVERNMENT',
        '',
        '123',
      ]) {
        assert.throws(
          () =>
            calculateGst({
              taxableAmountPaise: 100000,
              supplierStateCode: RAJASTHAN,
              placeOfSupplyStateCode: RAJASTHAN,
              customerType: invalidType as any,
              sacCode: STANDARD_SAC,
              gstRateBasisPoints: RATE_18_BP,
              pricingMode: 'EXCLUSIVE',
            }),
          (err: GstCalculationError) =>
            err.code === GST_ERROR_CODE.invalidCustomerType,
        );
      }
    });
  });

  describe('F. Customer Type Normalization (B2C & B2B)', () => {
    it('normalizes B2C and INDIVIDUAL to canonical INDIVIDUAL', () => {
      assert.equal(normalizeCustomerType('INDIVIDUAL'), 'INDIVIDUAL');
      assert.equal(normalizeCustomerType('individual'), 'INDIVIDUAL');
      assert.equal(normalizeCustomerType('B2C'), 'INDIVIDUAL');
      assert.equal(normalizeCustomerType('b2c'), 'INDIVIDUAL');
    });

    it('normalizes B2B and BUSINESS to canonical BUSINESS', () => {
      assert.equal(normalizeCustomerType('BUSINESS'), 'BUSINESS');
      assert.equal(normalizeCustomerType('business'), 'BUSINESS');
      assert.equal(normalizeCustomerType('B2B'), 'BUSINESS');
      assert.equal(normalizeCustomerType('b2b'), 'BUSINESS');
    });

    it('classifies supply types and validates state codes independently', () => {
      assert.equal(classifySupplyType(RAJASTHAN, RAJASTHAN), 'INTRA_STATE');
      assert.equal(classifySupplyType(RAJASTHAN, MAHARASHTRA), 'INTER_STATE');
      assert.equal(validateGstStateCode('08', 'supplierStateCode'), '08');
      assert.equal(validateGstStateCode('27', 'placeOfSupplyStateCode'), '27');
    });
  });

  describe('G. Core Mathematical Invariants', () => {
    it('satisfies all GST invariants across combinations of amounts, states and rates', () => {
      const amounts = [1, 99, 129, 499, 1000, 9999, 50000, 100000, 9999999];
      const rates = [
        GST_RATE_BP.zero,
        GST_RATE_BP.low5,
        GST_RATE_BP.reduced12,
        GST_RATE_BP.standard18,
      ];
      const destinations = [RAJASTHAN, MAHARASHTRA, DELHI];

      for (const taxable of amounts) {
        for (const rate of rates) {
          for (const dest of destinations) {
            const res = calculateGst({
              taxableAmountPaise: taxable,
              supplierStateCode: RAJASTHAN,
              placeOfSupplyStateCode: dest,
              customerType: 'INDIVIDUAL',
              sacCode: STANDARD_SAC,
              gstRateBasisPoints: rate,
              pricingMode: 'EXCLUSIVE',
            });

            // 1. Total GST equals sum of components
            assert.equal(
              res.totalGstPaise,
              res.cgstPaise + res.sgstPaise + res.igstPaise,
              `Total GST mismatch for ${taxable} @ ${rate} to ${dest}`,
            );

            // 2. Total amount equals taxable + total GST
            assert.equal(
              res.totalAmountPaise,
              res.taxableAmountPaise + res.totalGstPaise,
              `Total amount mismatch for ${taxable} @ ${rate} to ${dest}`,
            );

            // 3. Intra-state has zero IGST
            if (res.supplyType === 'INTRA_STATE') {
              assert.equal(res.igstPaise, 0);
              assert.equal(res.igstRateBasisPoints, 0);
              assert.equal(res.cgstPaise, res.sgstPaise);
              assert.equal(
                res.cgstRateBasisPoints + res.sgstRateBasisPoints,
                res.gstRateBasisPoints,
              );
            }

            // 4. Inter-state has zero CGST & SGST
            if (res.supplyType === 'INTER_STATE') {
              assert.equal(res.cgstPaise, 0);
              assert.equal(res.sgstPaise, 0);
              assert.equal(res.cgstRateBasisPoints, 0);
              assert.equal(res.sgstRateBasisPoints, 0);
              assert.equal(res.igstRateBasisPoints, res.gstRateBasisPoints);
            }

            // 5. All monetary amounts are non-negative safe integers
            assert.ok(
              Number.isSafeInteger(res.taxableAmountPaise) &&
                res.taxableAmountPaise > 0,
            );
            assert.ok(
              Number.isSafeInteger(res.totalGstPaise) && res.totalGstPaise >= 0,
            );
            assert.ok(
              Number.isSafeInteger(res.cgstPaise) && res.cgstPaise >= 0,
            );
            assert.ok(
              Number.isSafeInteger(res.sgstPaise) && res.sgstPaise >= 0,
            );
            assert.ok(
              Number.isSafeInteger(res.igstPaise) && res.igstPaise >= 0,
            );
            assert.ok(
              Number.isSafeInteger(res.totalAmountPaise) &&
                res.totalAmountPaise > 0,
            );

            // 6. Determinism: identical input produces identical output
            const rerun = calculateGst({
              taxableAmountPaise: taxable,
              supplierStateCode: RAJASTHAN,
              placeOfSupplyStateCode: dest,
              customerType: 'INDIVIDUAL',
              sacCode: STANDARD_SAC,
              gstRateBasisPoints: rate,
              pricingMode: 'EXCLUSIVE',
            });
            assert.deepEqual(res, rerun);
          }
        }
      }
    });
  });

  describe('H. Place of Supply Determination (Section 12 IGST Act)', () => {
    it('determines B2B POS from GSTIN registration state', () => {
      // GSTIN in Maharashtra (27), billing in Rajasthan (08)
      const res = determinePlaceOfSupply({
        customerType: 'BUSINESS',
        billingStateCode: RAJASTHAN,
        gstinStateCode: MAHARASHTRA,
      });

      assert.equal(res.placeOfSupplyStateCode, MAHARASHTRA);
      assert.equal(res.state, 'Maharashtra');
      assert.equal(res.ruleApplied, 'B2B_GSTIN_REGISTRATION_STATE');
      // Mismatch is flagged for CA review
      assert.equal(res.caReviewRequired, true);
      assert.ok(res.reviewReasons.includes('GSTIN_BILLING_STATE_MISMATCH'));
    });

    it('determines B2B POS when GSTIN state matches billing state without CA flag', () => {
      const res = determinePlaceOfSupply({
        customerType: 'B2B',
        billingStateCode: DELHI,
        gstinStateCode: DELHI,
      });

      assert.equal(res.placeOfSupplyStateCode, DELHI);
      assert.equal(res.state, 'Delhi');
      assert.equal(res.ruleApplied, 'B2B_GSTIN_REGISTRATION_STATE');
      assert.equal(res.caReviewRequired, false);
      assert.deepEqual(res.reviewReasons, []);
    });

    it('determines B2C POS from recipient billing address on record', () => {
      const res = determinePlaceOfSupply({
        customerType: 'INDIVIDUAL',
        billingStateCode: KARNATAKA,
      });

      assert.equal(res.placeOfSupplyStateCode, KARNATAKA);
      assert.equal(res.state, 'Karnataka');
      assert.equal(res.ruleApplied, 'B2C_BILLING_ADDRESS_STATE');
      assert.equal(res.caReviewRequired, false);
      assert.deepEqual(res.reviewReasons, []);
    });

    it('flags business customer without GSTIN state for CA review', () => {
      const res = determinePlaceOfSupply({
        customerType: 'BUSINESS',
        billingStateCode: GUJARAT,
        gstinStateCode: null,
      });

      assert.equal(res.placeOfSupplyStateCode, GUJARAT);
      assert.equal(res.ruleApplied, 'B2C_BILLING_ADDRESS_STATE');
      assert.equal(res.caReviewRequired, true);
      assert.ok(res.reviewReasons.includes('UNREGISTERED_BUSINESS'));
    });

    it('flags businesses with multiple GST registrations or ambiguous establishments', () => {
      const multiReg = determinePlaceOfSupply({
        customerType: 'BUSINESS',
        billingStateCode: DELHI,
        gstinStateCode: DELHI,
        hasMultipleRegistrations: true,
      });
      assert.equal(multiReg.caReviewRequired, true);
      assert.ok(
        multiReg.reviewReasons.includes('POTENTIAL_MULTI_ESTABLISHMENT'),
      );

      const unclearEst = determinePlaceOfSupply({
        customerType: 'BUSINESS',
        billingStateCode: DELHI,
        gstinStateCode: DELHI,
        receivingEstablishmentUnclear: true,
      });
      assert.equal(unclearEst.caReviewRequired, true);
      assert.ok(
        unclearEst.reviewReasons.includes('UNCLEAR_RECEIVING_ESTABLISHMENT'),
      );
    });

    it('flags SEZ customers for CA verification and zero-rating compliance', () => {
      const sez = determinePlaceOfSupply({
        customerType: 'BUSINESS',
        billingStateCode: GUJARAT,
        gstinStateCode: GUJARAT,
        isSez: true,
      });
      assert.equal(sez.ruleApplied, 'SEZ_ZERO_RATED_INTER_STATE');
      assert.equal(sez.caReviewRequired, true);
      assert.ok(sez.reviewReasons.includes('SEZ_UNIT_REQUIRING_CA_VALIDATION'));
    });

    it('flags foreign cross-border recipients under Section 13 IGST Act', () => {
      const foreign = determinePlaceOfSupply({
        customerType: 'INDIVIDUAL',
        isForeignRecipient: true,
      });
      assert.equal(foreign.ruleApplied, 'CROSS_BORDER_EXPORT_OR_OIDAR');
      assert.equal(foreign.caReviewRequired, true);
      assert.ok(
        foreign.reviewReasons.includes(
          'FOREIGN_RECIPIENT_REQUIRING_CA_VALIDATION',
        ),
      );
    });

    it('falls back to supplier location when recipient address is missing and flags CA review', () => {
      const missingAddr = determinePlaceOfSupply({
        customerType: 'INDIVIDUAL',
        billingStateCode: null,
      });
      assert.equal(
        missingAddr.placeOfSupplyStateCode,
        SUPPLIER_CONFIG.stateCode,
      );
      assert.equal(missingAddr.ruleApplied, 'SUPPLIER_LOCATION_FALLBACK');
      assert.equal(missingAddr.caReviewRequired, true);
      assert.ok(
        missingAddr.reviewReasons.includes('MISSING_RECIPIENT_ADDRESS'),
      );
    });

    it('rejects invalid state codes in POS determination', () => {
      assert.throws(
        () =>
          determinePlaceOfSupply({
            customerType: 'INDIVIDUAL',
            billingStateCode: '99',
          }),
        (err: GstCalculationError) =>
          err.code === GST_ERROR_CODE.invalidStateCode,
      );
    });
  });

  describe('I. Monetary Overflow and Safe Integer Limits', () => {
    it('throws MONETARY_OVERFLOW when total amount exceeds Number.MAX_SAFE_INTEGER', () => {
      // MAX_SAFE_INTEGER is 9,007,199,254,740,991
      // Taxable amount near MAX_SAFE_INTEGER:
      const hugeAmount = Number.MAX_SAFE_INTEGER - 1000;

      assert.throws(
        () =>
          calculateGst({
            taxableAmountPaise: hugeAmount,
            supplierStateCode: RAJASTHAN,
            placeOfSupplyStateCode: RAJASTHAN,
            customerType: 'INDIVIDUAL',
            sacCode: STANDARD_SAC,
            gstRateBasisPoints: RATE_18_BP,
            pricingMode: 'EXCLUSIVE',
          }),
        (err: GstCalculationError) => {
          assert.equal(err.code, GST_ERROR_CODE.monetaryOverflow);
          assert.match(err.message, /exceeds JavaScript safe integer limit/);
          return true;
        },
      );
    });

    it('computes correctly for largest amount whose total remains within MAX_SAFE_INTEGER', () => {
      // If total = taxable * 1.18 <= MAX_SAFE_INTEGER
      // taxable <= floor(MAX_SAFE_INTEGER / 1.18) ≈ 7,633,219,707,407,619
      const maxSafeTaxable = Math.floor(Number.MAX_SAFE_INTEGER / 1.18) - 1000;
      const res = calculateGst({
        taxableAmountPaise: maxSafeTaxable,
        supplierStateCode: RAJASTHAN,
        placeOfSupplyStateCode: RAJASTHAN,
        customerType: 'BUSINESS',
        sacCode: STANDARD_SAC,
        gstRateBasisPoints: RATE_18_BP,
        pricingMode: 'EXCLUSIVE',
      });

      assert.ok(Number.isSafeInteger(res.totalAmountPaise));
      assert.equal(
        res.totalAmountPaise,
        res.taxableAmountPaise + res.totalGstPaise,
      );
    });
  });

  describe('J. Exported computeTaxPaise Unit Validation & Overflow Guard', () => {
    it('validates taxable amount in computeTaxPaise', () => {
      for (const invalid of [
        -1,
        -500,
        1.5,
        NaN,
        Infinity,
        Number.MAX_SAFE_INTEGER + 10,
      ]) {
        assert.throws(
          () => computeTaxPaise(invalid, 1800),
          (err: GstCalculationError) =>
            err.code === GST_ERROR_CODE.invalidTaxableAmount,
        );
      }
    });

    it('validates rate in computeTaxPaise', () => {
      for (const invalid of [-1, 10001, 18.5, NaN, Infinity]) {
        assert.throws(
          () => computeTaxPaise(100000, invalid),
          (err: GstCalculationError) =>
            err.code === GST_ERROR_CODE.invalidGstRate,
        );
      }
    });

    it('throws MONETARY_OVERFLOW when calculation exceeds safe integer limits', () => {
      // Input at MAX_SAFE_INTEGER with 100% rate overflows safe representation
      assert.throws(
        () => computeTaxPaise(Number.MAX_SAFE_INTEGER, 10000),
        (err: GstCalculationError) => {
          assert.equal(err.code, GST_ERROR_CODE.monetaryOverflow);
          assert.match(err.message, /exceeds JavaScript safe integer limit/);
          return true;
        },
      );

      // Input at MAX_SAFE_INTEGER with 18% rate overflows safe representation
      assert.throws(
        () => computeTaxPaise(Number.MAX_SAFE_INTEGER, 1800),
        (err: GstCalculationError) => {
          assert.equal(err.code, GST_ERROR_CODE.monetaryOverflow);
          return true;
        },
      );
    });

    it('computes correctly for the maximum safe accepted taxable amount', () => {
      // Largest taxable amount at 18% where total (taxable + tax) <= MAX_SAFE_INTEGER
      const maxSafe18 = Math.floor(Number.MAX_SAFE_INTEGER / 1.18) - 1000;
      const tax = computeTaxPaise(maxSafe18, 1800);
      assert.ok(Number.isSafeInteger(tax));
      assert.ok(Number.isSafeInteger(maxSafe18 + tax));
      assert.ok(maxSafe18 + tax <= Number.MAX_SAFE_INTEGER);
    });

    it('calculates zero tax for zero amount or zero rate', () => {
      assert.equal(computeTaxPaise(0, 1800), 0);
      assert.equal(computeTaxPaise(100000, 0), 0);
      assert.equal(computeTaxPaise(100000, 1800), 18000);
    });
  });

  describe('K. Component vs Total Rounding Comparison (Decision C8)', () => {
    it('demonstrates component vs total rounding behavior across fractional boundaries', () => {
      // Example: ₹5.50 (550 paise) at 18% GST (9% CGST + 9% SGST)
      // Component-level:
      // CGST: 550 * 9% = 49.5 paise -> rounds half-up to 50 paise
      // SGST: 550 * 9% = 49.5 paise -> rounds half-up to 50 paise
      // Total GST = 50 + 50 = 100 paise (₹1.00)
      const res = calculateGst({
        taxableAmountPaise: 550,
        supplierStateCode: RAJASTHAN,
        placeOfSupplyStateCode: RAJASTHAN,
        customerType: 'INDIVIDUAL',
        sacCode: STANDARD_SAC,
        gstRateBasisPoints: RATE_18_BP,
        pricingMode: 'EXCLUSIVE',
      });

      assert.equal(res.cgstPaise, 50);
      assert.equal(res.sgstPaise, 50);
      assert.equal(res.totalGstPaise, 100);
      assert.equal(res.totalAmountPaise, 650);

      // Preserves invariant: totalGst === cgst + sgst
      assert.equal(res.totalGstPaise, res.cgstPaise + res.sgstPaise);
      assert.equal(res.roundingPolicy, 'HALF_UP_COMPONENT_SUM');
      assert.equal(
        DEFAULT_TAX_CONFIG.roundingPolicyStatus,
        'PROPOSED_PENDING_CA_APPROVAL',
      );
    });
  });
});
