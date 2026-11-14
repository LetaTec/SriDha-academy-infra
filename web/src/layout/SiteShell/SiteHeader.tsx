import { useEffect, useId, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import cx from 'classnames/bind';

import { canViewTeamOrders } from '@/access/team';
import { BrandLogo } from '@components/brand/BrandLogo/BrandLogo';
import { Button, ButtonRouteLink } from '@components/ui/Button/Button';
import { Container } from '@components/ui/Container/Container';
import { IconButton } from '@components/ui/IconButton/IconButton';
import { AUTH_TEXT } from '@constants/auth';
import { HEADER_TEXT, NAV_LINKS } from '@constants/home';
import { APP_ROUTES } from '@constants/routes';
import { useAuth } from '@context/AuthContext';
import { useToast } from '@context/ToastContext';
import { logoutStudent } from '@services/auth';

import { BatchTicker } from './BatchTicker';
import styles from './SiteHeader.module.css';

const cn = cx.bind(styles);

export const SiteHeader = () => {
  const auth = useAuth();
  const { status, clearSession } = auth;
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const navId = useId();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    if (!isMenuOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMenuOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMenuOpen]);

  const handleLogout = async () => {
    setIsLoggingOut(true);

    try {
      await logoutStudent();
      await navigate(APP_ROUTES.HOME, { flushSync: true });
      clearSession();
      showToast(AUTH_TEXT.loggedOutToast);
    } catch (error) {
      console.error('[auth] logout failed', error);
      showToast(AUTH_TEXT.logoutErrorToast, 'error');
    } finally {
      setIsLoggingOut(false);
      setIsMenuOpen(false);
    }
  };

  // Students never sign in; a signed-in team member reaches orders and
  // signs out here
  const accountActions =
    status === 'authenticated' ? (
      <>
        {canViewTeamOrders(auth) ? (
          <ButtonRouteLink
            variant="plain"
            to={APP_ROUTES.TEAM_ORDERS}
            onClick={() => setIsMenuOpen(false)}
          >
            {HEADER_TEXT.teamOrders}
          </ButtonRouteLink>
        ) : null}
        <Button
          variant="secondary"
          loading={isLoggingOut}
          onClick={handleLogout}
        >
          {HEADER_TEXT.logout}
        </Button>
      </>
    ) : null;

  return (
    <header className={cn('header')}>
      <BatchTicker />
      <Container className={cn('nav')}>
        <Link
          to={APP_ROUTES.HOME}
          className={cn('logoLink')}
          aria-label={HEADER_TEXT.homeLabel}
        >
          <BrandLogo variant="horizontal" />
        </Link>

        <nav
          id={navId}
          aria-label={HEADER_TEXT.primaryNavigation}
          className={cn('links', { linksOpen: isMenuOpen })}
        >
          {NAV_LINKS.map(link =>
            link.isSection ? (
              <Link
                key={link.label}
                to={link.to}
                className={cn('link')}
                onClick={() => setIsMenuOpen(false)}
              >
                {link.label}
              </Link>
            ) : (
              <NavLink
                key={link.label}
                to={link.to}
                end
                className={({ isActive }) =>
                  cn('link', { linkActive: isActive })
                }
                onClick={() => setIsMenuOpen(false)}
              >
                {link.label}
              </NavLink>
            ),
          )}
          {accountActions ? (
            <div className={cn('menuActions')}>{accountActions}</div>
          ) : null}
        </nav>

        <div className={cn('actions')}>{accountActions}</div>

        <IconButton
          icon={isMenuOpen ? 'close' : 'menu'}
          size="lg"
          label={isMenuOpen ? HEADER_TEXT.closeMenu : HEADER_TEXT.openMenu}
          aria-expanded={isMenuOpen}
          aria-controls={navId}
          className={cn('menuButton')}
          onClick={() => setIsMenuOpen(open => !open)}
        />
      </Container>
    </header>
  );
};
