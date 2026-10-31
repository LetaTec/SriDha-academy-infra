import { useEffect } from 'react';
import { useRouteError } from 'react-router-dom';
import cx from 'classnames/bind';

import { reportError } from '@/app/errorReporting';
import { ButtonLink } from '@components/ui/Button/Button';
import { Heading } from '@components/ui/Heading/Heading';
import { Section } from '@components/ui/Section/Section';
import { Text } from '@components/ui/Text/Text';
import { PAGE_TEXT } from '@constants/pages';
import { APP_ROUTES } from '@constants/routes';

import styles from './RouteErrorBoundary.module.css';

const cn = cx.bind(styles);

export const RouteErrorBoundary = () => {
  const error = useRouteError();

  useEffect(() => {
    console.error('[app] route error', error);
    reportError(error);
  }, [error]);

  return (
    <Section className={cn('page')}>
      <div className={cn('content')}>
        <Heading level={1} variant="display">
          {PAGE_TEXT.routeErrorTitle}
          <br />
          <em>{PAGE_TEXT.routeErrorTitleEmphasis}</em>
        </Heading>
        <Text as="p" tone="muted">
          {PAGE_TEXT.routeErrorMessage}
        </Text>
        <div>
          <ButtonLink href={APP_ROUTES.HOME}>{PAGE_TEXT.backHome}</ButtonLink>
        </div>
      </div>
    </Section>
  );
};
