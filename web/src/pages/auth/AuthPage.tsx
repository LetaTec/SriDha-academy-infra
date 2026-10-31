import { useLocation, useNavigate } from 'react-router-dom';
import cx from 'classnames/bind';

import { ForgotPasswordForm } from '@components/auth/ForgotPasswordForm/ForgotPasswordForm';
import { LoginForm } from '@components/auth/LoginForm/LoginForm';
import { RegisterForm } from '@components/auth/RegisterForm/RegisterForm';
import { Button } from '@components/ui/Button/Button';
import { Container } from '@components/ui/Container/Container';
import { Heading } from '@components/ui/Heading/Heading';
import { Text } from '@components/ui/Text/Text';
import {
  AUTH_PAGE_TEXT,
  AUTH_TEXT,
  AUTH_VIEW,
  type AuthView,
} from '@constants/auth';
import { APP_ROUTES, AUTH_SECTION_ID } from '@constants/routes';
import { useAuth } from '@context/AuthContext';
import { useToast } from '@context/ToastContext';
import type { AuthUser } from '@services/auth';

import { FeatureSection } from './components/FeatureSection/FeatureSection';
import { LearningModelSection } from './components/LearningModelSection/LearningModelSection';
import { OngoingTopics } from './components/OngoingTopics/OngoingTopics';
import styles from './AuthPage.module.css';

const cn = cx.bind(styles);

const TITLE_ID = 'auth-title';

const VIEW_HEADING: Record<AuthView, string> = {
  [AUTH_VIEW.login]: AUTH_PAGE_TEXT.loginHeading,
  [AUTH_VIEW.register]: AUTH_PAGE_TEXT.registerHeading,
  [AUTH_VIEW.forgotPassword]: AUTH_PAGE_TEXT.forgotHeading,
};

export type AuthPageProps = {
  view: AuthView;
};

// The first screen every visitor sees. Once signed in, PublicOnlyRoute sends
// the student on to redirect_to (or the homepage).
const AuthPage = ({ view }: AuthPageProps) => {
  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { search } = useLocation();

  const goTo = (pathname: string) => navigate({ pathname, search });

  const handleAuthenticated = (user: AuthUser) => {
    login(user);
    showToast(
      view === AUTH_VIEW.register
        ? AUTH_TEXT.registeredToast
        : AUTH_TEXT.loggedInToast,
    );
  };

  return (
    <>
      <Container className={cn('grid')}>
        <section
          id={AUTH_SECTION_ID.access}
          className={cn('copy')}
          aria-labelledby={TITLE_ID}
        >
          <Text
            as="div"
            variant="eyebrow"
            tone="accent"
            className={cn('kicker')}
          >
            <span className={cn('kickerRule')} aria-hidden="true" />
            {AUTH_PAGE_TEXT.kicker}
          </Text>
          <Heading level={1} variant="title" id={TITLE_ID}>
            {AUTH_PAGE_TEXT.title}
            <br />
            <em>{AUTH_PAGE_TEXT.titleEmphasis}</em>
            <br />
            {AUTH_PAGE_TEXT.titleEnd}
          </Heading>
          <Text as="p" variant="lead" tone="muted" className={cn('lead')}>
            {AUTH_PAGE_TEXT.lead}
          </Text>

          <div className={cn('panel')}>
            <Heading level={2} variant="item" className={cn('panelTitle')}>
              {VIEW_HEADING[view]}
            </Heading>
            {view === AUTH_VIEW.login ? (
              <LoginForm
                onAuthenticated={handleAuthenticated}
                onForgotPassword={() => goTo(APP_ROUTES.FORGOT_PASSWORD)}
              />
            ) : null}
            {view === AUTH_VIEW.register ? (
              <RegisterForm
                onAuthenticated={handleAuthenticated}
                onSwitchToLogin={() => goTo(APP_ROUTES.LOGIN)}
              />
            ) : null}
            {view === AUTH_VIEW.forgotPassword ? (
              <ForgotPasswordForm
                onBackToLogin={() => goTo(APP_ROUTES.LOGIN)}
              />
            ) : null}
            {view !== AUTH_VIEW.forgotPassword ? (
              <div className={cn('switch')}>
                <Text variant="small" tone="muted">
                  {view === AUTH_VIEW.login
                    ? AUTH_TEXT.noAccountPrompt
                    : AUTH_TEXT.haveAccountPrompt}
                </Text>
                <Button
                  variant="editorial"
                  onClick={() =>
                    goTo(
                      view === AUTH_VIEW.login
                        ? APP_ROUTES.REGISTER
                        : APP_ROUTES.LOGIN,
                    )
                  }
                >
                  {view === AUTH_VIEW.login
                    ? AUTH_PAGE_TEXT.registerTab
                    : AUTH_PAGE_TEXT.loginTab}
                </Button>
              </div>
            ) : null}
          </div>
        </section>

        <div className={cn('visual')}>
          <OngoingTopics />
        </div>
      </Container>
      <LearningModelSection />
      <FeatureSection />
    </>
  );
};

export default AuthPage;
