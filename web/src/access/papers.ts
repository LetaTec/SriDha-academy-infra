import type { AuthContextValue } from '@context/AuthContext';

// Anyone can read a paper; answering a question or starting a timed test
// needs an account. Papers are marked in the browser, so this only shapes
// the screens.
export const canAnswerPapers = (auth: AuthContextValue) =>
  auth.status === 'authenticated';

// While the saved session is still being checked, a click waits rather than
// asking a signed-in student to sign in again
export const mustSignInToAnswer = (auth: AuthContextValue) =>
  auth.status === 'anonymous';
