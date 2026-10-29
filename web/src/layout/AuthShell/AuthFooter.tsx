import { Link, useLocation } from 'react-router-dom';
import cx from 'classnames/bind';

import { BrandLogo } from '@components/brand/BrandLogo/BrandLogo';
import { Container } from '@components/ui/Container/Container';
import { Text } from '@components/ui/Text/Text';
import { ADMIN_SIGN_IN_TEXT } from '@constants/auth';
import { AUTH_FOOTER_TEXT } from '@constants/landing';
import { POLICY_LINKS, POLICY_LINKS_TITLE } from '@constants/policies';
import { APP_ROUTES } from '@constants/routes';

import styles from './AuthFooter.module.css';

const cn = cx.bind(styles);

// Footer for signed-out visitors. Topic and subject links lead to
// registration, since the catalogue itself needs an account.
export const AuthFooter = () => {
  const { search } = useLocation();

  return (
    <footer className={cn('footer')}>
      <Container>
        <div className={cn('top')}>
          <div className={cn('brand')}>
            <BrandLogo variant="stacked" size="lg" />
            <Text as="p" variant="small" tone="muted" className={cn('lead')}>
              {AUTH_FOOTER_TEXT.lead}
            </Text>
          </div>

          {AUTH_FOOTER_TEXT.columns.map(column => (
            <nav
              key={column.title}
              aria-label={column.title}
              className={cn('column')}
            >
              <Text as="div" variant="strong">
                {column.title}
              </Text>
              {column.links.map(link => (
                <Link
                  key={link}
                  to={APP_ROUTES.REGISTER}
                  className={cn('link')}
                >
                  {link}
                </Link>
              ))}
            </nav>
          ))}

          <nav
            aria-label={AUTH_FOOTER_TEXT.accountTitle}
            className={cn('column')}
          >
            <Text as="div" variant="strong">
              {AUTH_FOOTER_TEXT.accountTitle}
            </Text>
            <Link
              to={{ pathname: APP_ROUTES.LOGIN, search }}
              className={cn('link')}
            >
              {AUTH_FOOTER_TEXT.login}
            </Link>
            <Link
              to={{ pathname: APP_ROUTES.REGISTER, search }}
              className={cn('link')}
            >
              {AUTH_FOOTER_TEXT.register}
            </Link>
            <Link to={APP_ROUTES.FORGOT_PASSWORD} className={cn('link')}>
              {AUTH_FOOTER_TEXT.forgotPassword}
            </Link>
            <Link to={APP_ROUTES.ADMIN_SIGN_IN} className={cn('link')}>
              {ADMIN_SIGN_IN_TEXT.footerLink}
            </Link>
          </nav>
          <nav aria-label={POLICY_LINKS_TITLE} className={cn('column')}>
            <Text as="div" variant="strong">
              {POLICY_LINKS_TITLE}
            </Text>
            {POLICY_LINKS.map(link => (
              <Link key={link.to} to={link.to} className={cn('link')}>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className={cn('bottom')}>
          <span>{AUTH_FOOTER_TEXT.copyright}</span>
          <span>{AUTH_FOOTER_TEXT.note}</span>
        </div>
      </Container>
    </footer>
  );
};
