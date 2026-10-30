import { useEffect, useId, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import cx from 'classnames/bind';

import { BrandLogo } from '@components/brand/BrandLogo/BrandLogo';
import { TopicSearch } from '@components/catalogue/TopicSearch/TopicSearch';
import { Button, ButtonRouteLink } from '@components/ui/Button/Button';
import { Container } from '@components/ui/Container/Container';
import { IconButton } from '@components/ui/IconButton/IconButton';
import { AUTH_TEXT } from '@constants/auth';
import { CATALOGUE_QUERY_PARAM } from '@constants/catalogue';
import { HEADER_TEXT, NAV_LINKS } from '@constants/home';
import { APP_ROUTES, HOME_SECTION_ID, toPageSection } from '@constants/routes';
import { useAuth } from '@context/AuthContext';
import { useToast } from '@context/ToastContext';
import { useCatalogue } from '@hooks/useCatalogue';
import { logoutStudent } from '@services/auth';
import { listTopics } from '@services/catalogue';

import styles from './SiteHeader.module.css';

const cn = cx.bind(styles);

export const SiteHeader = () => {
  const { clearSession } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const navId = useId();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { subjects } = useCatalogue();
  const catalogueTopics = listTopics(subjects).map(context => context.topic);

  const isHome = location.pathname === APP_ROUTES.HOME;
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    if (!isHome) {
      setIsScrolled(true);
      return;
    }

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 48);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isHome]);

  const isCinema = isHome && !isScrolled;

  // Search results open the topic or batch on the homepage, from any page.
  const showOnHome = (params: Record<string, string>) => {
    setIsMenuOpen(false);
    navigate({
      pathname: APP_ROUTES.HOME,
      search: `?${new URLSearchParams(params)}`,
    });
  };

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
      await navigate(APP_ROUTES.LOGIN, { flushSync: true });
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

  const accountActions = (
    <>
      <ButtonRouteLink
        variant="plain"
        tone={isCinema ? 'inverse' : 'default'}
        to={APP_ROUTES.MY_LEARNING}
        onClick={() => setIsMenuOpen(false)}
      >
        {HEADER_TEXT.myLearning}
      </ButtonRouteLink>
      <Button
        variant="secondary"
        tone={isCinema ? 'inverse' : 'default'}
        loading={isLoggingOut}
        onClick={handleLogout}
      >
        {HEADER_TEXT.logout}
      </Button>
      <ButtonRouteLink
        variant="primary"
        to={APP_ROUTES.REGISTER}
        onClick={() => setIsMenuOpen(false)}
        className={cn('registerCta')}
      >
        Join SriDha
      </ButtonRouteLink>
    </>
  );

  return (
    <header className={cn('header', { headerCinema: isCinema })}>
      <Container className={cn('nav')}>
        <Link
          to={APP_ROUTES.HOME}
          className={cn('logoLink', { logoCinema: isCinema })}
          aria-label={HEADER_TEXT.homeLabel}
        >
          <BrandLogo
            variant="horizontal"
            tone={isCinema ? 'inverse' : 'default'}
          />
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
          <div className={cn('searchSlot')}>
            <TopicSearch
              catalogueTopics={catalogueTopics}
              onOpenTopic={topicId =>
                showOnHome({ [CATALOGUE_QUERY_PARAM.topic]: topicId })
              }
              onSelectBatch={(topicId, batchId) =>
                showOnHome({
                  [CATALOGUE_QUERY_PARAM.topic]: topicId,
                  [CATALOGUE_QUERY_PARAM.batch]: batchId,
                })
              }
              onBrowseTopics={() => {
                setIsMenuOpen(false);
                navigate(
                  toPageSection(APP_ROUTES.HOME, HOME_SECTION_ID.topics),
                );
              }}
            />
          </div>
          <div className={cn('menuActions')}>{accountActions}</div>
        </nav>

        <div className={cn('actions')}>{accountActions}</div>

        <IconButton
          icon={isMenuOpen ? 'close' : 'menu'}
          size="lg"
          label={isMenuOpen ? HEADER_TEXT.closeMenu : HEADER_TEXT.openMenu}
          aria-expanded={isMenuOpen}
          aria-controls={navId}
          className={cn('menuButton', { menuButtonCinema: isCinema })}
          onClick={() => setIsMenuOpen(open => !open)}
        />
      </Container>
    </header>
  );
};
