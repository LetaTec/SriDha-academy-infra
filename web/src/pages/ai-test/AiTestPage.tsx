import { useSearchParams } from 'react-router-dom';
import cx from 'classnames/bind';

import { SampleTestPaper } from '@components/assessment/SampleTestPaper/SampleTestPaper';
import { ButtonRouteLink } from '@components/ui/Button/Button';
import { Heading } from '@components/ui/Heading/Heading';
import { Section } from '@components/ui/Section/Section';
import { Text } from '@components/ui/Text/Text';
import { AI_TEST_PAGE_TEXT as TEXT } from '@constants/assessment';
import {
  APP_ROUTES,
  HOME_SECTION_ID,
  TEST_PAPER_PARAM,
  toPageSection,
} from '@constants/routes';

import styles from './AiTestPage.module.css';

const cn = cx.bind(styles);

const TITLE_ID = 'ai-test-page-title';
const TOPICS_LINK = toPageSection(APP_ROUTES.HOME, HOME_SECTION_ID.topics);

// The Test Paper page: papers to take straight away, the paper
// leading the page.
// The chosen class or exam and subject live in the address, so the
// header's "Continue your paper" link opens the same paper
const AiTestPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  return (
    <Section labelledBy={TITLE_ID} className={cn('page')}>
      <div className={cn('intro')}>
        <Text as="div" variant="eyebrow">
          {TEXT.eyebrow}
        </Text>
        <Heading level={1} variant="hero" id={TITLE_ID}>
          {TEXT.title}
          <br />
          <em>{TEXT.titleEmphasis}</em>
        </Heading>
      </div>

      <div className={cn('paper')}>
        <SampleTestPaper
          layout="wide"
          initialTrack={
            searchParams.get(TEST_PAPER_PARAM.track) ?? TEXT.initialTrack
          }
          initialSubject={
            searchParams.get(TEST_PAPER_PARAM.subject) ?? undefined
          }
          onChange={(track, subject) =>
            setSearchParams(
              {
                [TEST_PAPER_PARAM.track]: track,
                [TEST_PAPER_PARAM.subject]: subject,
              },
              { replace: true },
            )
          }
        />
      </div>

      <div className={cn('footer')}>
        <Text as="p" tone="muted">
          {TEXT.note}
        </Text>
        <ButtonRouteLink to={TOPICS_LINK} endIcon="arrowRight">
          {TEXT.action}
        </ButtonRouteLink>
      </div>
    </Section>
  );
};

export default AiTestPage;
