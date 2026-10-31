import { AsyncLocalStorage } from 'node:async_hooks';

export const LOG_LEVEL = {
  debug: 'debug',
  info: 'info',
  warn: 'warn',
  error: 'error',
  silent: 'silent',
} as const;

export type LogLevel = (typeof LOG_LEVEL)[keyof typeof LOG_LEVEL];

type LogFields = Record<string, unknown>;

const SEVERITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

// Every log line written while a request is handled carries its request
// id, so one failed payment can be followed through the log from the
// checkout to the webhook.
const requestScope = new AsyncLocalStorage<{ requestId: string }>();

let minimumSeverity = SEVERITY.info;
let isPretty = false;

export const configureLogger = (options: {
  level: LogLevel;
  pretty: boolean;
}) => {
  minimumSeverity = SEVERITY[options.level];
  isPretty = options.pretty;
};

export const runWithRequestId = <T>(requestId: string, run: () => T) =>
  requestScope.run({ requestId }, run);

export const currentRequestId = () =>
  requestScope.getStore()?.requestId ?? null;

const toLoggable = (value: unknown): unknown =>
  value instanceof Error
    ? { name: value.name, message: value.message, stack: value.stack }
    : value;

const formatPretty = (entry: LogFields) => {
  const { time, level, event, ...fields } = entry;
  const details = Object.entries(fields)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join(' ');
  return `${String(time)} ${String(level).toUpperCase()} ${String(event)} ${details}`.trimEnd();
};

// One JSON object per line in production, which Render's log search and
// any log drain can filter by event, level or requestId; readable lines in
// development.
const write = (level: LogLevel, event: string, fields: LogFields = {}) => {
  if (SEVERITY[level] < minimumSeverity) return;

  const entry: LogFields = {
    time: new Date().toISOString(),
    level,
    event,
  };
  const requestId = currentRequestId();
  if (requestId) entry.requestId = requestId;
  for (const [key, value] of Object.entries(fields)) {
    entry[key] = toLoggable(value);
  }

  const line = isPretty ? formatPretty(entry) : JSON.stringify(entry);
  const stream =
    SEVERITY[level] >= SEVERITY.warn ? process.stderr : process.stdout;
  stream.write(`${line}\n`);
};

export const logger = {
  debug: (event: string, fields?: LogFields) => write('debug', event, fields),
  info: (event: string, fields?: LogFields) => write('info', event, fields),
  warn: (event: string, fields?: LogFields) => write('warn', event, fields),
  error: (event: string, fields?: LogFields) => write('error', event, fields),
};
