import { Outlet } from 'react-router-dom';
import cx from 'classnames/bind';

import { AdminSignInForm } from '@components/auth/AdminSignInForm/AdminSignInForm';
import { Heading } from '@components/ui/Heading/Heading';
import { PageLoader } from '@components/ui/PageLoader/PageLoader';
import { Section } from '@components/ui/Section/Section';
import { Text } from '@components/ui/Text/Text';
import { ADMIN_SIGN_IN_TEXT } from '@constants/auth';
import { PAGE_TEXT } from '@constants/pages';
import { useAuth } from '@context/AuthContext';

import styles from './ProtectedRoute.module.css';

const cn = cx.bind(styles);

const TITLE_ID = 'team-gate-title';

// Team pages (orders). Students never sign in; the team signs in here, on
// the page itself, with an emailed one-time link. This guard shapes the
// experience only — every protected API endpoint verifies the session and
// role on the server.
export const ProtectedRoute = () => {
  const { status } = useAuth();

  if (status === 'loading') {
    return <PageLoader label={PAGE_TEXT.loading} />;
  }

  if (status === 'authenticated') {
    return <Outlet />;
  }

  return (
    <Section labelledBy={TITLE_ID} className={cn('page')}>
      <div className={cn('content')}>
        <Text as="div" variant="eyebrow">
          {ADMIN_SIGN_IN_TEXT.eyebrow}
        </Text>
        <Heading level={1} variant="display" id={TITLE_ID}>
          {ADMIN_SIGN_IN_TEXT.title} <em>{ADMIN_SIGN_IN_TEXT.titleEmphasis}</em>
        </Heading>
        <Text as="p" tone="muted">
          {ADMIN_SIGN_IN_TEXT.description}
        </Text>
        <div className={cn('panel')}>
          <AdminSignInForm />
        </div>
      </div>
    </Section>
  );
};
