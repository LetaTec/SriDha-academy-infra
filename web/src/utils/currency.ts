import { DEFAULT_LOCALE } from '@constants/locale';
import type { Price } from '@services/catalogue';

const PAISE_PER_RUPEE = 100;

export const formatPrice = (price: Price): string => {
  const rupees = price.amountPaise / PAISE_PER_RUPEE;
  const amount = new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: 'currency',
    currency: price.currency,
    maximumFractionDigits: Number.isInteger(rupees) ? 0 : 2,
  }).format(rupees);

  return price.taxLabel ? `${amount} + ${price.taxLabel}` : amount;
};

// Amounts in paise, such as order totals, in rupees
export const formatPaise = (amountPaise: number): string =>
  formatPrice({ amountPaise, currency: 'INR', taxLabel: null });
