type Sentry = typeof import('./sentryClient');

// Loaded only when VITE_SENTRY_DSN is set, so visitors without it never
// download Sentry and nothing is sent
let sentry: Promise<Sentry | null> = Promise.resolve(null);

// Reports crashes and errors in the browser to Sentry: uncaught errors and
// rejected promises automatically, page errors through reportError.
export const initErrorReporting = () => {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  sentry = import('./sentryClient')
    .then(module => {
      module.init({
        dsn,
        environment: import.meta.env.MODE,
        // Errors only, without performance tracing or session replays.
        // Nothing about the student leaves with a report: no user details,
        // cookies, headers, request bodies or query strings (which can hold
        // reset and sign-in tokens).
        tracesSampleRate: 0,
        dataCollection: {
          userInfo: false,
          cookies: false,
          httpHeaders: false,
          httpBodies: [],
          urlQueryParams: false,
        },
      });
      return module;
    })
    .catch(() => null);
};

export const reportError = (error: unknown) => {
  void sentry.then(module => module?.captureException(error));
};
