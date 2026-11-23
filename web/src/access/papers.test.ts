import type { AuthContextValue } from '@context/AuthContext';

import { canAnswerPapers, mustSignInToAnswer } from './papers';

const auth = (status: AuthContextValue['status']): AuthContextValue => ({
  status,
  user: null,
  isLoggedIn: status === 'authenticated',
  login: () => undefined,
  clearSession: () => undefined,
});

describe('paper access', () => {
  it('lets only signed-in students answer', () => {
    expect(canAnswerPapers(auth('authenticated'))).toBe(true);
    expect(canAnswerPapers(auth('anonymous'))).toBe(false);
    expect(canAnswerPapers(auth('loading'))).toBe(false);
  });

  it('asks visitors to sign in, but not while the session is still loading', () => {
    expect(mustSignInToAnswer(auth('anonymous'))).toBe(true);
    expect(mustSignInToAnswer(auth('loading'))).toBe(false);
    expect(mustSignInToAnswer(auth('authenticated'))).toBe(false);
  });
});
