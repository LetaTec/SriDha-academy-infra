import { Link, Outlet } from 'react-router-dom';
import cx from 'classnames/bind';

import { BrandLogo } from '@components/brand/BrandLogo/BrandLogo';
import { Container } from '@components/ui/Container/Container';
import { HEADER_TEXT } from '@constants/home';
import { APP_ROUTES } from '@constants/routes';
import { useScrollToHash } from '@hooks/useScrollToHash';

import { AuthFooter } from './AuthFooter';
import styles from './AuthShell.module.css';

const cn = cx.bind(styles);

// Plain frame for password reset, team sign-in and the policy pages.
export const AuthShell = () => {
  useScrollToHash();

  return (
    <div className={cn('shell')}>
      <header className={cn('header')}>
        <Container className={cn('nav')}>
          <Link to={APP_ROUTES.HOME} aria-label={HEADER_TEXT.homeLabel}>
            <BrandLogo />
          </Link>
        </Container>
      </header>
      <main className={cn('main')}>
        <Outlet />
      </main>
      <AuthFooter />
    </div>
  );
};
