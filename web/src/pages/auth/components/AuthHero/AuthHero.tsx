import { useRef, type CSSProperties, type PointerEvent } from 'react';
import cx from 'classnames/bind';

import { StudentIllustration } from '@components/brand/StudentIllustration/StudentIllustration';
import { Button } from '@components/ui/Button/Button';
import { ButtonBase } from '@components/ui/ButtonBase/ButtonBase';
import { Heading } from '@components/ui/Heading/Heading';
import { Text } from '@components/ui/Text/Text';
import {
  AUTH_HERO_CARDS,
  AUTH_HERO_TEXT,
  type AuthHeroCardSource,
} from '@constants/auth';
import { BATCH_AVAILABILITY } from '@constants/catalogue';
import type { Subject } from '@services/catalogue';
import { formatPrice } from '@utils/currency';
import { formatDateOnly } from '@utils/date';

import styles from './AuthHero.module.css';
import { SLIDE_MS, useHeroRotation } from './useHeroRotation';

const cn = cx.bind(styles);

// Cards on the track either side of the active one. Enough that the peeking
// neighbours are always real cards while the track glides.
const TRACK_BEHIND = 2;
const TRACK_AHEAD = 3;
// Horizontal travel that counts as a swipe, in px.
const SWIPE_DISTANCE = 40;

export type AuthHeroProps = {
  subjects: readonly Subject[];
  isLoading: boolean;
  hasError: boolean;
  onSelect: (topicId: string) => void;
  onRetry?: () => void;
};

type HeroCard = {
  id: string;
  label: string;
  body: string;
  // The topic the card's button opens, when the catalogue has one.
  topicId: string | null;
  isOpen: boolean;
  scene: AuthHeroCardSource['scene'];
  palette: AuthHeroCardSource['palette'];
  meta: ReadonlyArray<{ label: string; value: string }>;
};

const earliestStart = (topics: Subject['chapters'][number]['topics']) => {
  const dates = topics
    .filter(topic =>
      topic.batches.some(
        batch => batch.availability === BATCH_AVAILABILITY.OPEN,
      ),
    )
    .map(topic => {
      const open = topic.batches
        .filter(batch => batch.availability === BATCH_AVAILABILITY.OPEN)
        .map(batch => batch.startDate)
        .filter((date): date is string => date !== null)
        .sort((a, b) => a.localeCompare(b));

      return open[0] ?? null;
    })
    .filter((date): date is string => date !== null)
    .sort((a, b) => a.localeCompare(b));

  return dates[0] ?? null;
};

// A card is a subject with the topics, fee and next date the catalogue holds
// for it. Subjects that are not listed yet say so instead of inventing them.
const buildCard = (
  source: AuthHeroCardSource,
  subjects: readonly Subject[],
): HeroCard => {
  const subject = subjects.find(item => item.slug === source.slug);
  const topics = subject
    ? subject.chapters.flatMap(chapter => chapter.topics)
    : [];

  if (!subject) {
    return {
      id: source.slug,
      label: source.label,
      body: source.note ?? AUTH_HERO_TEXT.batchesSoon,
      topicId: null,
      isOpen: false,
      scene: source.scene,
      palette: source.palette,
      meta: [
        {
          label: AUTH_HERO_TEXT.batchesLabel,
          value: AUTH_HERO_TEXT.announcedSoon,
        },
        {
          label: AUTH_HERO_TEXT.formatLabel,
          value: AUTH_HERO_TEXT.formatOnline,
        },
      ],
    };
  }

  const openTopic =
    topics.find(topic =>
      topic.batches.some(
        batch => batch.availability === BATCH_AVAILABILITY.OPEN,
      ),
    ) ??
    topics[0] ??
    null;

  const priced = topics
    .map(topic => topic.price)
    .filter((price): price is NonNullable<typeof price> => price !== null)
    .sort((a, b) => a.amountPaise - b.amountPaise);

  // Subjects with no topics yet still list a price when the catalogue holds
  // one, so the card says something real rather than staying empty.
  const fromPrice = priced[0] ?? subject.listPrice;
  const start = earliestStart(topics);
  const body =
    topics.length > 0
      ? topics
          .slice(0, 4)
          .map(topic => topic.title)
          .join(' · ')
      : subject.description;

  return {
    id: subject.id,
    label: source.label,
    body,
    topicId: openTopic?.id ?? null,
    isOpen: openTopic !== null,
    scene: source.scene,
    palette: source.palette,
    meta: [
      ...(topics.length > 0
        ? [
            {
              label: AUTH_HERO_TEXT.topicsLabel,
              value: AUTH_HERO_TEXT.topicsCount(topics.length),
            },
          ]
        : []),
      {
        label: AUTH_HERO_TEXT.nextBatchLabel,
        value: start ? formatDateOnly(start) : AUTH_HERO_TEXT.announcedSoon,
      },
      ...(fromPrice
        ? [{ label: AUTH_HERO_TEXT.feeLabel, value: formatPrice(fromPrice) }]
        : []),
    ],
  };
};

// The horizontal subject carousel beside the sign-in form. Every value on a
// card comes from the catalogue, so nothing here promises a fee or date the
// student cannot actually book. The track only ever slides left; the cards
// around the active one peek in at the sides.
export const AuthHero = ({
  subjects,
  isLoading,
  hasError,
  onSelect,
  onRetry,
}: AuthHeroProps) => {
  const cards = AUTH_HERO_CARDS.map(source => buildCard(source, subjects));
  // The carousel has useful editorial fallback cards, so the catalogue request
  // must not replace the sign-in experience with an error panel.
  const isReady = !isLoading && cards.length > 0;

  const {
    position,
    activeIndex,
    isHeld,
    prefersReducedMotion,
    pause,
    resume,
    toggle,
    next,
    previous,
  } = useHeroRotation(isReady ? cards.length : 0);
  const swipeStartX = useRef<number | null>(null);

  const canRotate = isReady && cards.length > 1 && !prefersReducedMotion;
  const showsControls = isReady && cards.length > 1;

  if (!isReady) {
    const title = AUTH_HERO_TEXT.loading;
    const note = AUTH_HERO_TEXT.loadingNote;

    return (
      <section
        className={cn('panel', 'placeholder')}
        aria-label={AUTH_HERO_TEXT.label}
        aria-busy={isLoading || undefined}
      >
        <header className={cn('header')}>
          <Text
            as="span"
            variant="eyebrow"
            tone="accent"
            className={cn('eyebrow')}
          >
            {AUTH_HERO_TEXT.eyebrow}
          </Text>
          <span className={cn('rule')} aria-hidden="true" />
        </header>

        <div className={cn('placeholderBody')}>
          <Heading
            level={2}
            variant="display"
            className={cn('placeholderTitle')}
          >
            {title}
          </Heading>
          <Text as="p" tone="muted" className={cn('placeholderNote')}>
            {note}
          </Text>
          {onRetry ? (
            <Button variant="secondary" onClick={onRetry}>
              {AUTH_HERO_TEXT.retry}
            </Button>
          ) : null}
        </div>

        {isLoading ? (
          <div className={cn('skeletonDeck')} aria-hidden="true">
            <span className={cn('skeletonCard')} />
            <span className={cn('skeletonCard', 'skeletonCardBack')} />
          </div>
        ) : null}
      </section>
    );
  }

  // Swiping: a horizontal drag past SWIPE_DISTANCE steps the carousel. The
  // viewport keeps touch-action: pan-y, so vertical scrolling still works.
  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    swipeStartX.current = event.clientX;
  };
  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const startX = swipeStartX.current;
    swipeStartX.current = null;
    if (startX === null) return;

    const travel = event.clientX - startX;
    if (travel <= -SWIPE_DISTANCE) next();
    else if (travel >= SWIPE_DISTANCE) previous();
  };

  const slides = [];
  for (
    let slot = position - TRACK_BEHIND;
    slot <= position + TRACK_AHEAD;
    slot += 1
  ) {
    slides.push({
      slot,
      card: cards[((slot % cards.length) + cards.length) % cards.length],
    });
  }

  return (
    <section
      className={cn('panel')}
      aria-label={AUTH_HERO_TEXT.label}
      aria-roledescription="carousel"
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocusCapture={pause}
      onBlurCapture={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) resume();
      }}
    >
      <header className={cn('header')}>
        <div className={cn('headerRow')}>
          <Text
            as="span"
            variant="eyebrow"
            tone="accent"
            className={cn('eyebrow')}
          >
            {AUTH_HERO_TEXT.eyebrow}
          </Text>
          <div className={cn('controls')}>
            {hasError && onRetry ? (
              <ButtonBase
                className={cn('control')}
                aria-label={AUTH_HERO_TEXT.retry}
                onClick={onRetry}
              >
                {AUTH_HERO_TEXT.retry}
              </ButtonBase>
            ) : null}
            {showsControls ? (
              <>
                <ButtonBase
                  className={cn('control')}
                  aria-label={AUTH_HERO_TEXT.previous}
                  onClick={previous}
                >
                  {AUTH_HERO_TEXT.previousLabel}
                </ButtonBase>
                <ButtonBase
                  className={cn('control')}
                  aria-label={AUTH_HERO_TEXT.next}
                  onClick={next}
                >
                  {AUTH_HERO_TEXT.nextLabel}
                </ButtonBase>
              </>
            ) : null}
            {canRotate ? (
              <ButtonBase
                className={cn('control')}
                aria-label={
                  isHeld ? AUTH_HERO_TEXT.resume : AUTH_HERO_TEXT.pause
                }
                onClick={toggle}
              >
                {isHeld
                  ? AUTH_HERO_TEXT.resumeLabel
                  : AUTH_HERO_TEXT.pauseLabel}
              </ButtonBase>
            ) : null}
          </div>
        </div>
        <span className={cn('rule')} aria-hidden="true" />
      </header>

      <div
        className={cn('viewport')}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerEnd}
        onPointerCancel={() => {
          swipeStartX.current = null;
        }}
      >
        <div
          className={cn('track')}
          style={
            {
              '--position': position,
              '--slide-ms': `${SLIDE_MS}ms`,
            } as CSSProperties
          }
        >
          {slides.map(({ slot, card }) => {
            const isActive = slot === position;

            return (
              <article
                key={slot}
                className={cn('card', { active: isActive })}
                style={{ '--slot': slot } as CSSProperties}
                aria-roledescription="slide"
                aria-hidden={isActive ? undefined : true}
                inert={!isActive}
              >
                <div className={cn('cardTop')}>
                  <span className={cn('counter')}>
                    {AUTH_HERO_TEXT.position(
                      (((slot % cards.length) + cards.length) % cards.length) +
                        1,
                      cards.length,
                    )}
                  </span>
                  <span className={cn('tag', { open: card.isOpen })}>
                    {card.isOpen
                      ? AUTH_HERO_TEXT.openForEnrolment
                      : AUTH_HERO_TEXT.openingSoon}
                  </span>
                </div>

                <Heading
                  level={2}
                  variant="display"
                  className={cn('cardTitle')}
                >
                  {card.label}
                </Heading>

                <Text
                  as="p"
                  variant="body"
                  tone="muted"
                  className={cn('cardBody')}
                >
                  {card.body}
                </Text>

                <div className={cn('art')}>
                  <StudentIllustration
                    scene={card.scene}
                    palette={card.palette}
                  />
                </div>

                <div className={cn('cardFoot')}>
                  {card.meta.length > 0 ? (
                    <dl className={cn('meta')}>
                      {card.meta.map(item => (
                        <div key={item.label} className={cn('metaItem')}>
                          <dt className={cn('metaLabel')}>{item.label}</dt>
                          <dd className={cn('metaValue')}>{item.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}

                  {card.topicId ? (
                    <Button
                      variant="primary"
                      endIcon="arrowRight"
                      onClick={() => onSelect(card.topicId as string)}
                    >
                      {AUTH_HERO_TEXT.viewBatches}
                    </Button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <p className={cn('status')} aria-live={isHeld ? 'polite' : 'off'}>
        {cards[activeIndex]?.label}
      </p>
    </section>
  );
};
