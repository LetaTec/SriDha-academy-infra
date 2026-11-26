import cx from 'classnames/bind';

import { PaperClock } from '@components/assessment/PaperClock/PaperClock';
import { ButtonRouteLink } from '@components/ui/Button/Button';
import { IconButton } from '@components/ui/IconButton/IconButton';
import { Text } from '@components/ui/Text/Text';
import { CONTINUE_PAPER_TEXT as TEXT } from '@constants/assessment';
import {
  clearActivePaper,
  useActivePaper,
  useIsPaperOnScreen,
} from '@hooks/useActivePaper';
import { useNow } from '@hooks/useNow';

import styles from './ContinuePaper.module.css';

const cn = cx.bind(styles);

// A small card under the header while a test paper is in progress and the
// student is on another page: the paper, its red clock still counting down
// and a link back. Once the time is up the link opens the marked paper.
// The close button puts the paper away: the card goes, and the paper is no
// longer kept in this browser.
export const ContinuePaper = () => {
  const paper = useActivePaper();
  const isOnPaper = useIsPaperOnScreen(paper?.key ?? null);
  const isShown = paper !== null && !isOnPaper;
  const now = useNow(isShown);

  if (!isShown) return null;

  const secondsLeft = Math.max(0, (paper.endsAt - now) / 1000);
  const hasTimedOut = secondsLeft === 0;

  return (
    <aside className={cn('card')} aria-label={TEXT.label}>
      <div className={cn('text')}>
        <Text as="span" variant="label" className={cn('eyebrow')}>
          {TEXT.title}
        </Text>
        <Text as="span" variant="small" className={cn('paper')}>
          {paper.title}
        </Text>
      </div>
      <PaperClock state={{ secondsLeft, hasTimedOut }} size="sm" />
      <ButtonRouteLink to={paper.href} endIcon="arrowRight">
        {hasTimedOut ? TEXT.seeScore : TEXT.action}
      </ButtonRouteLink>
      <IconButton
        icon="close"
        label={TEXT.dismiss}
        className={cn('close')}
        onClick={() => clearActivePaper(paper.key)}
      />
    </aside>
  );
};
