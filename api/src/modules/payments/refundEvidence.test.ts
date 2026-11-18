import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  describeReported,
  REFUND_EVIDENCE_PROBLEM as PROBLEM,
  validateRefundEvidence,
  type RawRefundEvidence,
} from './refundEvidence.js';

const valid: RawRefundEvidence = {
  id: 'rfnd_abc123',
  status: 'failed',
  amountPaise: 5000,
  currency: 'INR',
  paymentId: 'pay_1',
  receipt: 'r1',
};
const expected = {
  providerPaymentId: 'pay_1',
  amountPaise: 5000,
  currency: 'INR',
  receipt: 'r1',
};

const codes = (raw: RawRefundEvidence, exp = expected) => {
  const result = validateRefundEvidence(raw, exp);
  return result.ok ? [] : result.problems.map(item => item.code);
};

describe('refund evidence validation', () => {
  it('accepts complete evidence that matches our records', () => {
    const result = validateRefundEvidence(valid, expected);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.evidence.id, 'rfnd_abc123');
      assert.equal(result.evidence.status, 'failed');
    }
  });

  for (const [label, id] of [
    ['empty', ''],
    ['whitespace', '   '],
    ['tab and newline', '\t\n'],
    ['null', null],
    ['missing', undefined],
    ['number', 12345],
    ['zero', 0],
    ['NaN', Number.NaN],
    ['object', { id: 'rfnd_x' }],
    ['array', ['rfnd_x']],
    ['boolean', true],
    ['padded', ' rfnd_abc123 '],
  ] as const) {
    it(`refuses a ${label} provider refund id`, () => {
      assert.deepEqual(codes({ ...valid, id }), [PROBLEM.idInvalid]);
    });
  }

  it('refuses a refund id that differs from the one expected', () => {
    assert.deepEqual(
      codes(valid, { ...expected, providerRefundId: 'rfnd_other' } as never),
      [PROBLEM.idMismatch],
    );
  });

  it('refuses a missing, blank, foreign or non-text payment id', () => {
    assert.deepEqual(codes({ ...valid, paymentId: undefined }), [
      PROBLEM.paymentIdMissing,
    ]);
    assert.deepEqual(codes({ ...valid, paymentId: null }), [
      PROBLEM.paymentIdMissing,
    ]);
    assert.deepEqual(codes({ ...valid, paymentId: '  ' }), [
      PROBLEM.paymentIdMissing,
    ]);
    assert.deepEqual(codes({ ...valid, paymentId: 42 }), [
      PROBLEM.paymentIdMissing,
    ]);
    assert.deepEqual(codes({ ...valid, paymentId: 'pay_other' }), [
      PROBLEM.paymentIdMismatch,
    ]);
  });

  it('refuses a missing, non-integer or different amount', () => {
    assert.deepEqual(codes({ ...valid, amountPaise: undefined }), [
      PROBLEM.amountInvalid,
    ]);
    assert.deepEqual(codes({ ...valid, amountPaise: '5000' }), [
      PROBLEM.amountInvalid,
    ]);
    assert.deepEqual(codes({ ...valid, amountPaise: 50.5 }), [
      PROBLEM.amountInvalid,
    ]);
    assert.deepEqual(codes({ ...valid, amountPaise: 0 }), [
      PROBLEM.amountInvalid,
    ]);
    assert.deepEqual(codes({ ...valid, amountPaise: 4999 }), [
      PROBLEM.amountMismatch,
    ]);
  });

  it('never invents a currency', () => {
    assert.deepEqual(codes({ ...valid, currency: undefined }), [
      PROBLEM.currencyMissing,
    ]);
    assert.deepEqual(codes({ ...valid, currency: null }), [
      PROBLEM.currencyMissing,
    ]);
    assert.deepEqual(codes({ ...valid, currency: 'USD' }), [
      PROBLEM.currencyMismatch,
    ]);
  });

  it('refuses a missing, non-text or unsupported status', () => {
    assert.deepEqual(codes({ ...valid, status: undefined }), [
      PROBLEM.statusInvalid,
    ]);
    assert.deepEqual(codes({ ...valid, status: 7 }), [PROBLEM.statusInvalid]);
    assert.deepEqual(codes({ ...valid, status: 'cancelled' }), [
      PROBLEM.statusInvalid,
    ]);
  });

  it('checks the status against the one the event implies', () => {
    assert.deepEqual(
      codes(valid, { ...expected, status: 'processed' } as never),
      [PROBLEM.statusInconsistent],
    );
  });

  it('requires our receipt when we have one, and never matches a different one', () => {
    assert.deepEqual(codes({ ...valid, receipt: undefined }), [
      PROBLEM.receiptMissing,
    ]);
    assert.deepEqual(codes({ ...valid, receipt: null }), [
      PROBLEM.receiptMissing,
    ]);
    assert.deepEqual(codes({ ...valid, receipt: 'r2' }), [
      PROBLEM.receiptMismatch,
    ]);
    assert.deepEqual(codes({ ...valid, receipt: 9 }), [PROBLEM.receiptInvalid]);
  });

  it('does not require a receipt when we have none', () => {
    assert.equal(
      validateRefundEvidence(
        { ...valid, receipt: undefined },
        { ...expected, receipt: null },
      ).ok,
      true,
    );
  });

  it('reports every problem, not only the first', () => {
    assert.deepEqual(
      codes({ id: '', status: 'x' }).sort(),
      [
        PROBLEM.idInvalid,
        PROBLEM.paymentIdMissing,
        PROBLEM.amountInvalid,
        PROBLEM.currencyMissing,
        PROBLEM.statusInvalid,
        PROBLEM.receiptMissing,
      ].sort(),
    );
  });

  it('describes reported values safely for an audit entry', () => {
    const described = describeReported({
      id: { nested: true },
      paymentId: 'x'.repeat(300),
      amountPaise: Number.NaN,
      currency: undefined,
      status: ['a'],
      receipt: 5,
    });
    assert.equal(described.providerRefundId, '(object)');
    assert.equal((described.providerPaymentId as string).length, 100);
    assert.equal(described.amountPaise, 'NaN');
    assert.equal(described.currency, null);
    assert.equal(described.status, '(array)');
    assert.equal(described.receipt, 5);
  });
});
