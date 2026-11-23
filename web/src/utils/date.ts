import { DEFAULT_LOCALE } from '@constants/locale';

// Date-only values ("2026-11-01") are calendar dates, so they are formatted in
// UTC to avoid shifting a day in timezones behind UTC.
export const formatDateOnly = (value: string): string =>
  new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));

// Wall-clock times ("10:00") are shown as published, in India Standard Time.
export const formatWallClockTime = (value: string): string => {
  const [hours, minutes] = value.split(':').map(Number);
  const date = new Date(Date.UTC(2000, 0, 1, hours, minutes));

  return `${new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  }).format(date)} IST`;
};

const pad = (value: number) => String(value).padStart(2, '0');

// A countdown as minutes and seconds, e.g. 272 -> "04:32", with hours in
// front once it runs to an hour or more, e.g. 7200 -> "2:00:00".
export const formatCountdown = (totalSeconds: number): string => {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const clock = `${pad(minutes)}:${pad(seconds % 60)}`;
  return hours > 0 ? `${hours}:${clock}` : clock;
};

// Moments ("2026-10-28T13:45:00Z"), such as when an order was placed, shown
// as date and time in India Standard Time.
export const formatDateTime = (value: string): string =>
  new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value));
