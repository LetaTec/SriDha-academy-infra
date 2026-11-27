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

// A class's start and end, e.g. "20:30" for 90 minutes ->
// "8:30 pm – 10:00 pm IST"
export const formatWallClockRange = (
  start: string,
  durationMinutes: number,
): string => {
  const [hours, minutes] = start.split(':').map(Number);
  const endTotal = (hours * 60 + minutes + durationMinutes) % (24 * 60);
  const end = `${String(Math.floor(endTotal / 60)).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}`;
  return `${formatWallClockTime(start).replace(/ IST$/, '')} – ${formatWallClockTime(end)}`;
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

export type CountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

// A long countdown in whole days, hours, minutes and seconds
export const splitCountdown = (totalSeconds: number): CountdownParts => {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  return {
    days: Math.floor(seconds / 86400),
    hours: Math.floor((seconds % 86400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
  };
};

// A class date with its weekday, e.g. "2026-12-19" -> "Sat, 19 Dec"
export const formatClassDate = (value: string): string =>
  new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));

// A calendar date as day and month, e.g. "2026-12-17" -> "17 Dec"
export const formatDayMonth = (value: string): string =>
  new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
