import { FEATURES } from '@constants/features';
import type { AuthContextValue } from '@context/AuthContext';

// Anyone can read a paper. With student accounts on, answering a question
// or starting a timed test needs one; with them off, everyone can answer.
// Papers are marked in the browser, so this only shapes the screens.
export const canAnswerPapers = (auth: AuthContextValue) =>
  !FEATURES.studentAccounts || auth.status === 'authenticated';

// While the saved session is still being checked, a click waits rather than
// asking a signed-in student to sign in again
export const mustSignInToAnswer = (auth: AuthContextValue) =>
  FEATURES.studentAccounts && auth.status === 'anonymous';
