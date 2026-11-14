import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import cx from 'classnames/bind';

import { AdminSignInForm } from '@components/auth/AdminSignInForm/AdminSignInForm';
import { FieldStatus } from '@components/ui/Field/Field';
import { Heading } from '@components/ui/Heading/Heading';
import { Section } from '@components/ui/Section/Section';
import { Spinner } from '@components/ui/Spinner/Spinner';
import { Text } from '@components/ui/Text/Text';
import { ADMIN_SIGN_IN_TEXT, AUTH_QUERY_PARAM } from '@constants/auth';
import { APP_ROUTES } from '@constants/routes';
import { useAuth } from '@context/AuthContext';
import { useToast } from '@context/ToastContext';
import { getApiErrorMessage } from '@services/api/errors';
import { confirmAdminSignIn } from '@services/auth';

import styles from './AdminSignInPage.module.css';

const cn = cx.bind(styles);

const TITLE_ID = 'admin-sign-in-title';

// Team sign-in without a password. Without a token it asks for an emailed
// link; opened from that link it exchanges the token for a session.
const AdminSignInPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get(AUTH_QUERY_PARAM.signInToken);
  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [linkError, setLinkError] = useState<string | null>(null);
  // Links are single-use, so confirm each token exactly once (React may run
  // effects twice in development).
  const confirmedToken = useRef<string | null>(null);

  useEffect(() => {
    if (!token || confirmedToken.current === token) return;
    confirmedToken.current = token;

    confirmAdminSignIn({ token })
      .then(user => {
        login(user);
        showToast(ADMIN_SIGN_IN_TEXT.signedInToast);
        navigate(APP_ROUTES.TEAM_ORDERS, { replace: true });
      })
      .catch((error: unknown) => {
        setLinkError(getApiErrorMessage(error, ADMIN_SIGN_IN_TEXT.linkError));
      });
  }, [token, login, showToast, navigate]);

  const isConfirming = Boolean(token) && linkError === null;

  return (
    <Section labelledBy={TITLE_ID} className={cn('page')}>
      <div className={cn('panel')}>
        <Text as="div" variant="eyebrow">
          {ADMIN_SIGN_IN_TEXT.eyebrow}
        </Text>
        <Heading
          level={1}
          variant="title"
          id={TITLE_ID}
          className={cn('title')}
        >
          {ADMIN_SIGN_IN_TEXT.title} <em>{ADMIN_SIGN_IN_TEXT.titleEmphasis}</em>
        </Heading>

        {isConfirming ? (
          <div className={cn('confirming')} role="status">
            <Spinner tone="muted" />
            <Text variant="small" tone="muted">
              {ADMIN_SIGN_IN_TEXT.confirming}
            </Text>
          </div>
        ) : (
          <>
            {linkError ? (
              <FieldStatus tone="error">{linkError}</FieldStatus>
            ) : null}
            <Text as="p" tone="muted">
              {ADMIN_SIGN_IN_TEXT.description}
            </Text>
            <AdminSignInForm />
          </>
        )}
      </div>
    </Section>
  );
};

export default AdminSignInPage;
