import { Outlet } from 'react-router-dom';
import cx from 'classnames/bind';

import { ScrollProgress } from '@components/ui/ScrollProgress/ScrollProgress';
import { HEADER_TEXT } from '@constants/home';
import { useScrollToHash } from '@hooks/useScrollToHash';

import { SiteCheckout } from './SiteCheckout';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';
import styles from './SiteShell.module.css';

const cn = cx.bind(styles);

const MAIN_CONTENT_ID = 'main-content';

export const SiteShell = () => {
  useScrollToHash();

  return (
    <>
      <a href={`#${MAIN_CONTENT_ID}`} className={cn('skipLink')}>
        {HEADER_TEXT.skipToContent}
      </a>
      <ScrollProgress />
      <SiteHeader />
      <main id={MAIN_CONTENT_ID} className={cn('main')}>
        <Outlet />
      </main>
      <SiteFooter />
      <SiteCheckout />
    </>
  );
};
