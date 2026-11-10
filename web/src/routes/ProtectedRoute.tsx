import { Outlet } from 'react-router-dom';
import cx from 'classnames/bind';

import { AccountAccess } from '@components/auth/AccountAccess/AccountAccess';
import { Heading } from '@components/ui/Heading/Heading';
import { PageLoader } from '@components/ui/PageLoader/PageLoader';
import { Section } from '@components/ui/Section/Section';
import { Text } from '@components/ui/Text/Text';
import { ACCOUNT_ACCESS_TEXT } from '@constants/auth';
import { PAGE_TEXT } from '@constants/pages';
import { useAuth } from '@context/AuthContext';

import styles from './ProtectedRoute.module.css';

const cn = cx.bind(styles);

const TITLE_ID = 'account-gate-title';

// Pages that list a student's own seats (My learning, team orders). The rest
// of the site is open to everyone; here a visitor signs in on the page itself
// and it opens once they do. This guard shapes the experience only — every
// protected API endpoint independently verifies the session on the server.
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
          {ACCOUNT_ACCESS_TEXT.gateEyebrow}
        </Text>
        <Heading level={1} variant="display" id={TITLE_ID}>
          {ACCOUNT_ACCESS_TEXT.gateTitle}{' '}
          <em>{ACCOUNT_ACCESS_TEXT.gateTitleEmphasis}</em>
        </Heading>
        <Text as="p" tone="muted">
          {ACCOUNT_ACCESS_TEXT.gateLead}
        </Text>
        <div className={cn('panel')}>
          <AccountAccess />
        </div>
      </div>
    </Section>
  );
};
