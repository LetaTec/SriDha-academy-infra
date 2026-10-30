import { Link, Outlet, useLocation } from 'react-router-dom';
import cx from 'classnames/bind';

import { BrandLogo } from '@components/brand/BrandLogo/BrandLogo';
import { ButtonRouteLink } from '@components/ui/Button/Button';
import { Container } from '@components/ui/Container/Container';
import { FallingSubjectRain } from '@components/ui/FallingSubjectRain/FallingSubjectRain';
import { AUTH_PAGE_TEXT } from '@constants/auth';
import { HEADER_TEXT } from '@constants/home';
import { APP_ROUTES } from '@constants/routes';
import { useScrollToHash } from '@hooks/useScrollToHash';

import { AuthFooter } from './AuthFooter';
import styles from './AuthShell.module.css';

const cn = cx.bind(styles);

// Frame for the sign-in screens. The query string is kept on the header
// links so switching between log in and sign up preserves redirect_to.
export const AuthShell = () => {
  const { pathname, search } = useLocation();
  const isRegister = pathname === APP_ROUTES.REGISTER;
  useScrollToHash();

  return (
    <div className={cn('shell', { whiteTheme: isRegister })}>
      {isRegister ? <FallingSubjectRain /> : null}
      <header className={cn('header')}>
        <Container className={cn('nav')}>
          <Link
            to={{ pathname: APP_ROUTES.LOGIN, search }}
            aria-label={HEADER_TEXT.homeLabel}
          >
            <BrandLogo />
          </Link>
          <div className={cn('actions')}>
            <ButtonRouteLink
              variant={isRegister ? 'secondary' : 'primary'}
              to={{ pathname: APP_ROUTES.LOGIN, search }}
              aria-current={isRegister ? undefined : 'page'}
            >
              {AUTH_PAGE_TEXT.loginTab}
            </ButtonRouteLink>
            <ButtonRouteLink
              variant={isRegister ? 'primary' : 'secondary'}
              to={{ pathname: APP_ROUTES.REGISTER, search }}
              aria-current={isRegister ? 'page' : undefined}
            >
              {AUTH_PAGE_TEXT.registerTab}
            </ButtonRouteLink>
          </div>
        </Container>
      </header>
      <main className={cn('main')}>
        <Outlet />
      </main>
      <AuthFooter />
    </div>
  );
};
