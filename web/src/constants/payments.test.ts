import { describe, expect, it } from 'vitest';

import { CHECKOUT_TEXT } from './payments';

// Invoicing is switched off until the CA approval is recorded, so checkout
// must not promise a tax invoice (owner decision, November 2026)
describe('checkout copy', () => {
  it('promises no tax invoice while invoicing is disabled', () => {
    for (const [key, text] of Object.entries(CHECKOUT_TEXT)) {
      if (typeof text !== 'string') continue;
      expect(text, key).not.toMatch(/tax invoice|GST invoice/i);
    }
  });

  it('uses the approved payment-confirmation wording', () => {
    expect(CHECKOUT_TEXT.detailsNote).toBe(
      "Payment confirmation will be provided after successful payment. Applicable tax documentation, where required, will be issued separately in accordance with the company's invoicing policy.",
    );
  });
});
