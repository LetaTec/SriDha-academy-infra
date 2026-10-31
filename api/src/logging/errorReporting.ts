import { logger, setErrorSink } from './logger.js';

// Sends every error the API logs (unhandled request errors, payment,
// webhook and email failures, failed clean-ups) to Sentry, tagged with the
// event name and request id, so the team hears about failures before a
// student reports them. Off unless SENTRY_DSN is set; Sentry is then
// loaded, and nothing is sent without it.
export const initErrorReporting = async (options: {
  dsn: string | null;
  environment: string;
}) => {
  if (!options.dsn) return null;

  const Sentry = await import('@sentry/node');
  Sentry.init({
    dsn: options.dsn,
    environment: options.environment,
    // Errors only, without performance tracing. Nothing about the student
    // leaves with a report: request bodies hold passwords and billing
    // details, cookies hold sessions, and query strings hold reset tokens.
    tracesSampleRate: 0,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
  });

  setErrorSink((event, fields) => {
    const { error, requestId, ...extra } = fields;
    Sentry.withScope(scope => {
      scope.setTag('event', event);
      if (typeof requestId === 'string') scope.setTag('requestId', requestId);
      scope.setExtras(extra);
      if (error instanceof Error) Sentry.captureException(error);
      else Sentry.captureMessage(event, 'error');
    });
  });
  logger.info('monitoring.error_reporting_enabled', {
    environment: options.environment,
  });

  // Waits for queued reports to be sent, for shutdown
  return () => Sentry.close(2000);
};
