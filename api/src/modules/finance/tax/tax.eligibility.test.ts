import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { determinePlaceOfSupply } from '../gst/gst.placeOfSupply.js';
import {
  assertTaxCalculationEligibility,
  TaxEligibilityError,
} from './tax.eligibility.js';

describe('Tax Calculation Eligibility Gate', () => {
  it('approves eligible domestic B2C transactions', () => {
    const pos = determinePlaceOfSupply({
      customerType: 'INDIVIDUAL',
      billingStateCode: '08',
    });
    const eligibility = assertTaxCalculationEligibility(pos);
    assert.equal(eligibility, 'ELIGIBLE_DOMESTIC');
  });

  it('approves eligible domestic B2B transactions with matching GSTIN and billing state', () => {
    const pos = determinePlaceOfSupply({
      customerType: 'BUSINESS',
      billingStateCode: '27',
      gstinStateCode: '27',
    });
    const eligibility = assertTaxCalculationEligibility(pos);
    assert.equal(eligibility, 'ELIGIBLE_DOMESTIC');
  });

  it('approves domestic B2B transactions with GSTIN and billing state mismatch (with CA review note)', () => {
    const pos = determinePlaceOfSupply({
      customerType: 'BUSINESS',
      billingStateCode: '08',
      gstinStateCode: '27',
    });
    const eligibility = assertTaxCalculationEligibility(pos);
    assert.equal(eligibility, 'ELIGIBLE_DOMESTIC');
  });

  it('blocks foreign / cross-border recipients', () => {
    const pos = determinePlaceOfSupply({
      customerType: 'INDIVIDUAL',
      isForeignRecipient: true,
    });
    assert.throws(
      () => assertTaxCalculationEligibility(pos),
      (err: TaxEligibilityError) => {
        assert.equal(err.eligibility, 'UNSUPPORTED_CROSS_BORDER');
        assert.match(err.message, /Cross-border services under Section 13/);
        return true;
      },
    );
  });

  it('blocks SEZ units and developers', () => {
    const pos = determinePlaceOfSupply({
      customerType: 'BUSINESS',
      billingStateCode: '24',
      gstinStateCode: '24',
      isSez: true,
    });
    assert.throws(
      () => assertTaxCalculationEligibility(pos),
      (err: TaxEligibilityError) => {
        assert.equal(err.eligibility, 'UNSUPPORTED_SEZ');
        assert.match(err.message, /Supplies to SEZ units require verified/);
        return true;
      },
    );
  });

  it('blocks missing recipient address', () => {
    const pos = determinePlaceOfSupply({
      customerType: 'INDIVIDUAL',
      billingStateCode: null,
    });
    assert.throws(
      () => assertTaxCalculationEligibility(pos),
      (err: TaxEligibilityError) => {
        assert.equal(err.eligibility, 'BLOCKED_MISSING_ADDRESS');
        assert.match(
          err.message,
          /Cannot calculate tax without recipient billing address/,
        );
        return true;
      },
    );
  });

  it('blocks B2B recipients with ambiguous or multiple establishments', () => {
    const multiRegPos = determinePlaceOfSupply({
      customerType: 'BUSINESS',
      billingStateCode: '07',
      gstinStateCode: '07',
      hasMultipleRegistrations: true,
    });
    assert.throws(
      () => assertTaxCalculationEligibility(multiRegPos),
      (err: TaxEligibilityError) => {
        assert.equal(err.eligibility, 'BLOCKED_AMBIGUOUS_ESTABLISHMENT');
        return true;
      },
    );

    const unclearPos = determinePlaceOfSupply({
      customerType: 'BUSINESS',
      billingStateCode: '07',
      gstinStateCode: '07',
      receivingEstablishmentUnclear: true,
    });
    assert.throws(
      () => assertTaxCalculationEligibility(unclearPos),
      (err: TaxEligibilityError) => {
        assert.equal(err.eligibility, 'BLOCKED_AMBIGUOUS_ESTABLISHMENT');
        return true;
      },
    );
  });
});
