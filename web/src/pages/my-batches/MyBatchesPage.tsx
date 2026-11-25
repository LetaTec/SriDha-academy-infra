import { useState } from 'react';
import cx from 'classnames/bind';

import { canViewMyBatches } from '@/access/account';
import { AccountDialog } from '@components/auth/AccountDialog/AccountDialog';
import { BatchCountdown } from '@components/enrolments/BatchCountdown/BatchCountdown';
import { Button, ButtonRouteLink } from '@components/ui/Button/Button';
import { Card } from '@components/ui/Card/Card';
import { CardGrid } from '@components/ui/CardGrid/CardGrid';
import { EmptyState } from '@components/ui/EmptyState/EmptyState';
import { Heading } from '@components/ui/Heading/Heading';
import {
  KeyValueList,
  type KeyValueItem,
} from '@components/ui/KeyValueList/KeyValueList';
import { Section } from '@components/ui/Section/Section';
import { Skeleton } from '@components/ui/Skeleton/Skeleton';
import { StatusDot } from '@components/ui/StatusDot/StatusDot';
import { Text } from '@components/ui/Text/Text';
import {
  CATALOGUE_TEXT,
  ENROLMENT_STATUS,
  MY_BATCHES_TEXT as TEXT,
} from '@constants/catalogue';
import { APP_ROUTES } from '@constants/routes';
import { useAuth } from '@context/AuthContext';
import { useMyBatches } from '@hooks/useMyBatches';
import { useNow } from '@hooks/useNow';
import { getBatchTimeline, type BatchTimeline } from '@services/catalogue';
import type { Enrolment } from '@services/payments';
import {
  formatClassDate,
  formatWallClockRange,
  formatWallClockTime,
} from '@utils/date';

import styles from './MyBatchesPage.module.css';

const cn = cx.bind(styles);

const TITLE_ID = 'my-batches-title';
const UPCOMING_ID = 'my-batches-upcoming';
const PREVIOUS_ID = 'my-batches-previous';
const PLACEHOLDER_COUNT = 3;
const SECOND_MS = 1000;

type BookedBatch = { enrolment: Enrolment; timeline: BatchTimeline };

// The class dates, time, sessions and teacher of a booked batch
const batchItems = (
  { batch }: Enrolment,
  timeline: BatchTimeline,
): KeyValueItem[] => [
  {
    label: TEXT.datesLabel,
    value:
      timeline.phase === 'unscheduled'
        ? CATALOGUE_TEXT.toBeAnnounced
        : timeline.sessions
            .map(session => formatClassDate(session.date))
            .join(', '),
  },
  {
    label: TEXT.timeLabel,
    value: !batch.startTime
      ? CATALOGUE_TEXT.toBeAnnounced
      : batch.sessionDurationMinutes
        ? formatWallClockRange(batch.startTime, batch.sessionDurationMinutes)
        : formatWallClockTime(batch.startTime),
  },
  {
    label: TEXT.sessionsLabel,
    value: CATALOGUE_TEXT.sessionCount(batch.sessionCount ?? 1),
  },
  {
    label: TEXT.teacherLabel,
    value: batch.instructorName ?? CATALOGUE_TEXT.toBeAnnounced,
  },
];

// What an upcoming batch shows above its details: the countdown to its
// next class, the class that is on now, or that its date is coming
const BatchMoment = ({
  timeline,
  now,
  startTime,
  durationMinutes,
}: {
  timeline: BatchTimeline;
  now: number;
  startTime: string | null;
  durationMinutes: number | null;
}) => {
  if (timeline.phase === 'upcoming') {
    return (
      <BatchCountdown
        label={
          timeline.next.day === 1
            ? TEXT.startsIn
            : TEXT.nextDayIn(timeline.next.day)
        }
        secondsLeft={(timeline.next.startsAt - now) / SECOND_MS}
      />
    );
  }
  if (timeline.phase === 'live') {
    return (
      <div className={cn('live')}>
        <StatusDot color="positive" label={TEXT.liveNow} />
        {startTime && durationMinutes ? (
          <Text as="span" variant="small" tone="muted">
            {formatWallClockRange(startTime, durationMinutes)}
          </Text>
        ) : null}
      </div>
    );
  }
  return (
    <Text as="p" variant="small" tone="muted">
      {TEXT.dateToBeAnnounced}
    </Text>
  );
};

const BatchCard = ({
  booked: { enrolment, timeline },
  now,
}: {
  booked: BookedBatch;
  now: number;
}) => {
  const isOver = timeline.phase === 'over';

  return (
    <Card
      variant="note"
      title={enrolment.topic.shortTitle || enrolment.topic.title}
      description={TEXT.batchLine(enrolment.topic.level, enrolment.batch.name)}
      footer={
        <div className={cn('details')}>
          {isOver ? (
            <StatusDot
              color="neutral"
              label={TEXT.completedOn(formatClassDate(timeline.last.date))}
            />
          ) : (
            <BatchMoment
              timeline={timeline}
              now={now}
              startTime={enrolment.batch.startTime}
              durationMinutes={enrolment.batch.sessionDurationMinutes}
            />
          )}
          <KeyValueList items={batchItems(enrolment, timeline)} />
        </div>
      }
      className={cn('card')}
    />
  );
};

const BatchGroup = ({
  id,
  title,
  batches,
  now,
}: {
  id: string;
  title: string;
  batches: readonly BookedBatch[];
  now: number;
}) =>
  batches.length === 0 ? null : (
    <section className={cn('group')} aria-labelledby={id}>
      <Heading level={2} variant="title" id={id}>
        {title}
      </Heading>
      <CardGrid variant="boxed" columns={3}>
        {batches.map(booked => (
          <BatchCard key={booked.enrolment.id} booked={booked} now={now} />
        ))}
      </CardGrid>
    </section>
  );

const BatchPlaceholders = () => (
  <div role="status">
    <span className={cn('visuallyHidden')}>{TEXT.loading}</span>
    <CardGrid variant="boxed" columns={3}>
      {Array.from({ length: PLACEHOLDER_COUNT }, (_, index) => (
        <div key={index} className={cn('placeholder')} aria-hidden="true">
          <Skeleton shape="title" width="lg" />
          <Skeleton width="md" />
          <Skeleton shape="title" width="full" />
          <Skeleton width="full" />
          <Skeleton width="lg" />
        </div>
      ))}
    </CardGrid>
  </div>
);

// When a batch's next class starts (or its last ended), for sorting
const nextMoment = ({ timeline }: BookedBatch) => {
  if (timeline.phase === 'upcoming') return timeline.next.startsAt;
  if (timeline.phase === 'live') return timeline.current.startsAt;
  if (timeline.phase === 'over') return timeline.last.endsAt;
  return Number.POSITIVE_INFINITY;
};

// A signed-in student's paid batches, reached from the profile menu:
// upcoming ones with a countdown to their next class, soonest first, then
// the batches already taught, most recent first.
const MyBatchesPage = () => {
  const auth = useAuth();
  const canView = canViewMyBatches(auth);
  const { batches, isLoading, hasError, reload } = useMyBatches(canView);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const now = useNow(batches.length > 0);

  const booked = batches
    .filter(enrolment => enrolment.status === ENROLMENT_STATUS.CONFIRMED)
    .map(enrolment => ({
      enrolment,
      timeline: getBatchTimeline(enrolment.batch, now),
    }));
  const upcoming = booked
    .filter(item => item.timeline.phase !== 'over')
    .sort((a, b) => nextMoment(a) - nextMoment(b));
  const previous = booked
    .filter(item => item.timeline.phase === 'over')
    .sort((a, b) => nextMoment(b) - nextMoment(a));

  const renderContent = () => {
    if (auth.status === 'loading' || isLoading) return <BatchPlaceholders />;
    if (!canView) {
      return (
        <EmptyState
          title={TEXT.signInTitle}
          message={TEXT.signInMessage}
          action={
            <Button endIcon="arrowRight" onClick={() => setIsAccountOpen(true)}>
              {TEXT.signIn}
            </Button>
          }
        />
      );
    }
    if (hasError) {
      return (
        <EmptyState
          title={TEXT.loadError}
          action={
            <Button variant="secondary" onClick={reload}>
              {CATALOGUE_TEXT.retry}
            </Button>
          }
        />
      );
    }
    if (booked.length === 0) {
      return (
        <EmptyState
          title={TEXT.emptyTitle}
          message={TEXT.emptyMessage}
          action={
            <ButtonRouteLink to={APP_ROUTES.TOPICS} endIcon="arrowRight">
              {TEXT.browseTopics}
            </ButtonRouteLink>
          }
        />
      );
    }
    return (
      <>
        <BatchGroup
          id={UPCOMING_ID}
          title={TEXT.upcomingTitle}
          batches={upcoming}
          now={now}
        />
        <BatchGroup
          id={PREVIOUS_ID}
          title={TEXT.previousTitle}
          batches={previous}
          now={now}
        />
      </>
    );
  };

  return (
    <Section labelledBy={TITLE_ID} className={cn('page')}>
      <div className={cn('intro')}>
        <Text as="div" variant="eyebrow">
          {TEXT.eyebrow}
        </Text>
        <Heading level={1} variant="hero" id={TITLE_ID}>
          {TEXT.title} <em>{TEXT.titleEmphasis}</em>
        </Heading>
      </div>
      <div className={cn('list')}>{renderContent()}</div>
      <AccountDialog
        open={isAccountOpen}
        onClose={() => setIsAccountOpen(false)}
      />
    </Section>
  );
};

export default MyBatchesPage;
