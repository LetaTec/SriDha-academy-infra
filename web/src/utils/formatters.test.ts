import { formatPrice } from './currency';
import { formatCountdown, formatDateOnly, formatWallClockTime } from './date';
import { resolveInternalPath } from './url';

describe('formatters', () => {
  it('formats prices in rupees with an optional tax label', () => {
    expect(
      formatPrice({ amountPaise: 12900, currency: 'INR', taxLabel: null }),
    ).toBe('₹129');
    expect(
      formatPrice({ amountPaise: 49900, currency: 'INR', taxLabel: 'GST' }),
    ).toBe('₹499 + GST');
  });

  it('formats calendar dates without shifting the day', () => {
    expect(formatDateOnly('2026-11-01')).toBe('1 Nov 2026');
  });

  it('formats published wall-clock times in IST', () => {
    expect(formatWallClockTime('10:00')).toMatch(/^10:00\s?am IST$/i);
  });

  it('formats countdowns as minutes and seconds', () => {
    expect(formatCountdown(300)).toBe('05:00');
    expect(formatCountdown(272)).toBe('04:32');
    expect(formatCountdown(0.4)).toBe('00:01');
    expect(formatCountdown(-3)).toBe('00:00');
  });

  it('puts hours in front of countdowns of an hour or more', () => {
    expect(formatCountdown(7200)).toBe('2:00:00');
    expect(formatCountdown(3599.2)).toBe('1:00:00');
    expect(formatCountdown(3725)).toBe('1:02:05');
    expect(formatCountdown(3599)).toBe('59:59');
  });
});

describe('resolveInternalPath', () => {
  it('accepts same-origin paths only', () => {
    expect(resolveInternalPath('/my-learning', '/')).toBe('/my-learning');
    expect(resolveInternalPath('//evil.example', '/')).toBe('/');
    expect(resolveInternalPath('https://evil.example', '/')).toBe('/');
    expect(resolveInternalPath(null, '/')).toBe('/');
  });
});
