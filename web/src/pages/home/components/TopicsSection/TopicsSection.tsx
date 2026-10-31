import cx from 'classnames/bind';

import { TopicPreviewGrid } from '@components/catalogue/TopicPreviewGrid/TopicPreviewGrid';
import { TopicsStatus } from '@components/catalogue/TopicsStatus/TopicsStatus';
import { ButtonRouteLink } from '@components/ui/Button/Button';
import { Section } from '@components/ui/Section/Section';
import { SectionHead } from '@components/ui/SectionHead/SectionHead';
import { TOPICS_TEXT } from '@constants/home';
import { APP_ROUTES, HOME_SECTION_ID } from '@constants/routes';
import { HOME_TOPIC_COUNT } from '@constants/topics';
import { useCheckout } from '@hooks/useCheckout';
import { useTopicPreviews } from '@hooks/useTopicPreviews';

import styles from './TopicsSection.module.css';

const cn = cx.bind(styles);

const TITLE_ID = 'topics-title';

// The first topics on offer, second on the homepage, with their own search
// and a link to every topic on the Topics page.
export const TopicsSection = () => {
  const { openCheckout } = useCheckout();
  const { previews, isLoading, hasError, reload } = useTopicPreviews();

  return (
    <Section id={HOME_SECTION_ID.topics} labelledBy={TITLE_ID}>
      <SectionHead
        titleId={TITLE_ID}
        title={
          <>
            {TOPICS_TEXT.title}
            <br />
            <em>{TOPICS_TEXT.titleEmphasis}</em>
          </>
        }
        description={TOPICS_TEXT.description}
      />
      {isLoading || hasError ? (
        <TopicsStatus hasError={hasError} onRetry={reload} />
      ) : (
        <>
          <TopicPreviewGrid
            previews={previews}
            onChooseTopic={openCheckout}
            limit={HOME_TOPIC_COUNT}
          />
          <div className={cn('more')}>
            <ButtonRouteLink
              to={APP_ROUTES.TOPICS}
              variant="secondary"
              endIcon="arrowRight"
            >
              {TOPICS_TEXT.seeAll(previews.length)}
            </ButtonRouteLink>
          </div>
        </>
      )}
    </Section>
  );
};
