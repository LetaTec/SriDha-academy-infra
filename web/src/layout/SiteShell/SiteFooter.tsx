import { Link } from 'react-router-dom';
import cx from 'classnames/bind';

import { BrandLogo } from '@components/brand/BrandLogo/BrandLogo';
import { Container } from '@components/ui/Container/Container';
import { Text } from '@components/ui/Text/Text';
import { BRAND, FOOTER_COLUMNS } from '@constants/home';

import styles from './SiteFooter.module.css';

const cn = cx.bind(styles);

export const SiteFooter = () => {
  return (
    <footer className={cn('footer')}>
      <Container>
        <div className={cn('top')}>
          <div>
            <BrandLogo variant="stacked" tone="inverse" size="lg" />
            <Text as="p" tone="inverseMuted" className={cn('lead')}>
              {BRAND.footerLead}
            </Text>
          </div>

          {FOOTER_COLUMNS.map(column => (
            <nav
              key={column.title}
              aria-label={column.title}
              className={cn('column')}
            >
              <Text
                as="div"
                variant="label"
                tone="accentInverse"
                className={cn('columnTitle')}
              >
                {column.title}
              </Text>
              {column.links.map(link => (
                <Link key={link.label} to={link.to} className={cn('link')}>
                  {link.label}
                </Link>
              ))}
            </nav>
          ))}
        </div>

        <div className={cn('bottom')}>
          <span>{BRAND.copyright}</span>
          <span>{BRAND.footerNote}</span>
        </div>
      </Container>
    </footer>
  );
};
