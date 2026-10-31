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
  AUTH_QUERY_PARAM,
  AUTH_TEXT,
  AUTH_VIEW,
  type AuthView,
} from '@constants/auth';
import { CATALOGUE_QUERY_PARAM } from '@constants/catalogue';
import { APP_ROUTES, AUTH_SECTION_ID } from '@constants/routes';
import { useAuth } from '@context/AuthContext';
import { useToast } from '@context/ToastContext';
import { useCatalogue } from '@hooks/useCatalogue';
import type { AuthUser } from '@services/auth';

import { AuthHero } from './components/AuthHero/AuthHero';
import { FeatureSection } from './components/FeatureSection/FeatureSection';
import { LearningModelSection } from './components/LearningModelSection/LearningModelSection';
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

  const catalogue = useCatalogue();

  const goTo = (pathname: string) => navigate({ pathname, search });

  // Choosing a topic on the sign-in screen carries it through registration, so
  // the student lands on the topic they picked once the account exists.
  const handleSelectTopic = (topicId: string) => {
    const destination = `${APP_ROUTES.HOME}?${new URLSearchParams({
      [CATALOGUE_QUERY_PARAM.topic]: topicId,
    }).toString()}`;

    navigate(
      `${APP_ROUTES.REGISTER}?${new URLSearchParams({
        [AUTH_QUERY_PARAM.redirectTo]: destination,
      }).toString()}`,
    );
  };

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
            {AUTH_PAGE_TEXT.kicker}
          </Text>
          <Heading
            level={1}
            variant="display"
            id={TITLE_ID}
            className={cn('headline')}
          >
            {AUTH_PAGE_TEXT.title} <em>{AUTH_PAGE_TEXT.titleEmphasis}</em>
            {AUTH_PAGE_TEXT.titleEnd ? (
              <>
                <br />
                {AUTH_PAGE_TEXT.titleEnd}
              </>
            ) : null}
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
          <AuthHero
            subjects={catalogue.subjects}
            isLoading={catalogue.isLoading}
            hasError={catalogue.hasError}
            onSelect={handleSelectTopic}
            onRetry={catalogue.reload}
          />
        </div>
      </Container>
      <LearningModelSection />
      <FeatureSection />
    </>
  );
};

export default AuthPage;
