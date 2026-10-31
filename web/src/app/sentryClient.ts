// The only parts of Sentry the website uses, imported by name so the rest
// (session replay, feedback widgets) stays out of the bundle. Loaded on
// demand by errorReporting.ts.
export { captureException, init } from '@sentry/browser';
