import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isOriginAllowed, isValidWildcardOrigin } from './origins.js';

const ALLOWED = [
  'https://www.sridhaacademy.com',
  'https://*.sridha-academy.pages.dev',
];

describe('allowed origins', () => {
  it('allows exact origins and preview subdomains', () => {
    assert.ok(isOriginAllowed(ALLOWED, 'https://www.sridhaacademy.com'));
    assert.ok(
      isOriginAllowed(
        ALLOWED,
        'https://feat-topic-search-home.sridha-academy.pages.dev',
      ),
    );
    assert.ok(
      isOriginAllowed(ALLOWED, 'https://b7212dff.sridha-academy.pages.dev'),
    );
  });

  it('rejects look-alikes of a wildcard host', () => {
    for (const origin of [
      // The bare project host is not a preview
      'https://sridha-academy.pages.dev',
      // Only one label, so no nesting
      'https://a.b.sridha-academy.pages.dev',
      // Another Cloudflare project that ends the same way
      'https://evil-sridha-academy.pages.dev',
      'https://x.evil-sridha-academy.pages.dev',
      'https://x.sridha-academy.pages.dev.evil.com',
      // Previews are https only
      'http://x.sridha-academy.pages.dev',
      'https://x.sridha-academy.pages.dev:8443',
      'https://-x.sridha-academy.pages.dev',
    ]) {
      assert.equal(isOriginAllowed(ALLOWED, origin), false, origin);
    }
  });

  it('accepts only https wildcards over a plain host', () => {
    assert.ok(isValidWildcardOrigin('https://*.sridha-academy.pages.dev'));
    assert.equal(isValidWildcardOrigin('http://*.example.com'), false);
    assert.equal(isValidWildcardOrigin('https://*.com'), false);
    assert.equal(isValidWildcardOrigin('https://*.example.com/path'), false);
    assert.equal(isValidWildcardOrigin('https://*.*.example.com'), false);
  });
});
