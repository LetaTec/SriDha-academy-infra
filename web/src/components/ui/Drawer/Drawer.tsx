import React, { useEffect, useId, useRef, useState } from 'react';
import cx from 'classnames/bind';

import { Heading } from '../Heading/Heading';
import { IconButton } from '../IconButton/IconButton';
import { Text } from '../Text/Text';
import styles from './Drawer.module.css';

const cn = cx.bind(styles);

export type DrawerProps = {
  open: boolean;
  onClose: () => void;
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  closeLabel?: string;
  children: React.ReactNode;
  // Pinned to the bottom of the panel, e.g. the main action
  footer?: React.ReactNode;
};

// How long the slide-out runs, read from the panel's own CSS so the two
// never disagree. No transition (reduced motion, tests) closes at once.
const exitDurationMs = (panel: HTMLElement | null) => {
  if (!panel) return 0;
  const seconds = Number.parseFloat(getComputedStyle(panel).transitionDuration);
  return Number.isFinite(seconds) ? seconds * 1000 : 0;
};

// A panel that slides in from the right over a dimmed page, and slides out
// again before it closes. Built on the native <dialog> element like Modal:
// showModal() provides the focus trap, Escape handling, inert background
// and focus return; the page behind stops scrolling while it is open.
//
// The slide starts only once the panel has mounted and the browser has
// drawn it in place off screen. Opening a modal makes the browser restyle
// the whole page behind it; starting the slide at the same moment made it
// jump ahead after that pause instead of gliding.
export const Drawer = ({
  open,
  onClose,
  eyebrow,
  title,
  closeLabel = 'Close',
  children,
  footer,
}: DrawerProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // In place on screen; false while waiting to slide in and while sliding out
  const [isShown, setIsShown] = useState(false);
  // The content stays mounted until the dialog has really closed, so the
  // slide-out has something to move
  const [isMounted, setIsMounted] = useState(open);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;

    if (open) {
      setIsMounted(true);
      if (!dialog.open) dialog.showModal();

      // The first frame draws the panel off screen; the slide starts on the
      // one after, when the work of opening is done
      let frame = window.requestAnimationFrame(() => {
        frame = window.requestAnimationFrame(() => setIsShown(true));
      });
      return () => window.cancelAnimationFrame(frame);
    }

    if (!dialog.open) return undefined;

    // Slide out first, then close the dialog
    setIsShown(false);
    const timer = window.setTimeout(() => {
      dialog.close();
      setIsMounted(false);
    }, exitDurationMs(panelRef.current));

    return () => window.clearTimeout(timer);
  }, [open]);

  const handleCancel = (event: React.SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    onClose();
  };

  const handleClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    if (event.target === dialogRef.current) {
      onClose();
    }
  };

  return (
    // The dialog fills the screen and is the backdrop; clicking beside the
    // panel closes it, and the keyboard path is the native Escape key.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={dialogRef}
      className={cn('drawer', { shown: isShown })}
      aria-labelledby={titleId}
      onCancel={handleCancel}
      onClick={handleClick}
    >
      {open || isMounted ? (
        <div ref={panelRef} className={cn('panel')}>
          <div className={cn('header')}>
            <div className={cn('heading')}>
              {eyebrow ? (
                <Text as="div" variant="eyebrow" tone="accent">
                  {eyebrow}
                </Text>
              ) : null}
              <Heading level={2} variant="title" id={titleId}>
                {title}
              </Heading>
            </div>
            <IconButton
              icon="close"
              size="lg"
              label={closeLabel}
              onClick={onClose}
            />
          </div>
          <div className={cn('body')}>{children}</div>
          {footer ? <div className={cn('footer')}>{footer}</div> : null}
        </div>
      ) : null}
    </dialog>
  );
};
