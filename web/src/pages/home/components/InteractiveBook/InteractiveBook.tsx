import React, { useEffect, useMemo, useRef } from 'react';
import cx from 'classnames/bind';

import { IconButton } from '@components/ui/IconButton/IconButton';
import { Text } from '@components/ui/Text/Text';
import { BOOK_TEXT } from '@constants/home';
import { BOOK_SWIPE_THRESHOLD_PX } from '@constants/ui';
import type { CatalogueState } from '@hooks/useCatalogue';

import { BookPage, type BookPageActions } from './BookPage';
import { buildBookLayout } from './bookPages';
import { useBookNavigation } from './useBookNavigation';
import styles from './InteractiveBook.module.css';

const cn = cx.bind(styles);

const INTERACTIVE_SELECTOR = 'a, button, input, select, textarea, label';
const TYPING_ELEMENTS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export type InteractiveBookProps = Omit<BookPageActions, 'onRetry'> & {
  catalogue: CatalogueState;
};

export const InteractiveBook = ({
  catalogue,
  onOpenTopic,
  onSelectBatch,
}: InteractiveBookProps) => {
  const { subjects, isLoading, hasError, reload } = catalogue;
  const layout = useMemo(
    () => buildBookLayout({ subjects, isLoading, hasError }),
    [subjects, isLoading, hasError],
  );
  const leafCount = layout.leaves.length;
  const {
    index,
    canTurnNext,
    canTurnBack,
    getZIndex,
    turnNext,
    turnBack,
    finishTurn,
  } = useBookNavigation(leafCount);
  const bookRef = useRef<HTMLDivElement>(null);
  const swipeStartX = useRef<number | null>(null);
  const didSwipe = useRef(false);

  const pageActions: BookPageActions = {
    onOpenTopic,
    onSelectBatch,
    onRetry: reload,
  };

  // Arrow keys turn pages unless the student is typing or a dialog is open.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName ?? '';

      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        TYPING_ELEMENTS.has(activeTag) ||
        document.querySelector('dialog[open]')
      ) {
        return;
      }

      if (event.key === 'ArrowRight') turnNext();
      if (event.key === 'ArrowLeft') turnBack();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [turnBack, turnNext]);

  // Clicking the right half turns forward, the left half turns back.
  // Buttons and links inside a page keep their own behaviour.
  const handleBookClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (didSwipe.current) {
      didSwipe.current = false;
      return;
    }

    if ((event.target as Element).closest(INTERACTIVE_SELECTOR)) return;

    const bounds = bookRef.current?.getBoundingClientRect();
    if (!bounds) return;

    if (event.clientX >= bounds.left + bounds.width / 2) {
      turnNext();
    } else {
      turnBack();
    }
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    swipeStartX.current = event.pointerType === 'mouse' ? null : event.clientX;
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (swipeStartX.current === null) return;

    const distance = event.clientX - swipeStartX.current;
    swipeStartX.current = null;

    if (Math.abs(distance) < BOOK_SWIPE_THRESHOLD_PX) return;

    didSwipe.current = true;
    if (distance < 0) {
      turnNext();
    } else {
      turnBack();
    }
  };

  const handleLeafTransitionEnd = (
    leaf: number,
    event: React.TransitionEvent<HTMLDivElement>,
  ) => {
    if (
      event.target === event.currentTarget &&
      event.propertyName === 'transform'
    ) {
      finishTurn(leaf);
    }
  };

  return (
    <div className={cn('stage')}>
      <div className={cn('shadow')} aria-hidden="true" />
      <div className={cn('frame')}>
        {/* Pointer handlers add mouse and swipe shortcuts; the labelled
            buttons below and the arrow keys are the accessible controls. */}
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
        <div
          ref={bookRef}
          className={cn('book')}
          role="group"
          aria-roledescription="book"
          aria-label={BOOK_TEXT.ariaLabel}
          onClick={handleBookClick}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
        >
          <div className={cn('coverBack')} aria-hidden="true" />

          <div className={cn('sheet', 'base', 'leftBase')} inert={index !== 0}>
            <BookPage page={layout.leftBase} {...pageActions} />
          </div>
          <div
            className={cn('sheet', 'base', 'rightBase')}
            inert={index !== leafCount}
          >
            <BookPage page={layout.rightBase} {...pageActions} />
          </div>

          {layout.leaves.map((leaf, leafIndex) => (
            <div
              key={leaf.key}
              className={cn('leaf', { turned: leafIndex < index })}
              style={
                { '--leaf-z': getZIndex(leafIndex) } as React.CSSProperties
              }
              onTransitionEnd={event =>
                handleLeafTransitionEnd(leafIndex, event)
              }
            >
              <div
                className={cn('sheet', 'face', 'front')}
                inert={leafIndex !== index}
              >
                <BookPage page={leaf.front} {...pageActions} />
              </div>
              <div
                className={cn('sheet', 'face', 'back')}
                inert={leafIndex !== index - 1}
              >
                <BookPage page={leaf.back} {...pageActions} />
              </div>
            </div>
          ))}

          <div className={cn('spine')} aria-hidden="true" />
        </div>
      </div>

      <div className={cn('controls')}>
        <IconButton
          icon="chevronLeft"
          label={BOOK_TEXT.previousPage}
          disabled={!canTurnBack}
          onClick={turnBack}
        />
        <Text variant="label" tone="muted" className={cn('instruction')}>
          {BOOK_TEXT.instruction}
        </Text>
        <Text
          variant="label"
          tone="muted"
          role="status"
          className={cn('position')}
        >
          {BOOK_TEXT.pagePosition(index + 1, leafCount + 1)}
        </Text>
        <IconButton
          icon="chevronRight"
          label={BOOK_TEXT.nextPage}
          disabled={!canTurnNext}
          onClick={turnNext}
        />
      </div>
    </div>
  );
};
