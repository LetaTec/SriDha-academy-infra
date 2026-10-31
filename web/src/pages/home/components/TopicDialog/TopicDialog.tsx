import cx from 'classnames/bind';

import { TopicDetails } from '@components/catalogue/TopicDetails/TopicDetails';
import { EnrolmentReview } from '@components/enrolments/EnrolmentReview/EnrolmentReview';
import { FieldStatus } from '@components/ui/Field/Field';
import { Modal } from '@components/ui/Modal/Modal';
import { Text } from '@components/ui/Text/Text';
import { CATALOGUE_TEXT } from '@constants/catalogue';
import type { Batch, BatchContext, TopicContext } from '@services/catalogue';

import styles from './TopicDialog.module.css';

const cn = cx.bind(styles);

export type TopicDialogProps = {
  open: boolean;
  context: TopicContext | null;
  selection: BatchContext | null;
  hasUnknownBatch: boolean;
  onClose: () => void;
  onSelectBatch: (batch: Batch) => void;
  onClearBatch: () => void;
  // Hands the chosen batch over to the payment panel
  onContinueToPayment: (selection: BatchContext) => void;
};

// One topic: its lessons and batches, then a review of the chosen batch
// before payment. The dialog's state lives in the URL.
export const TopicDialog = ({
  open,
  context,
  selection,
  hasUnknownBatch,
  onClose,
  onSelectBatch,
  onClearBatch,
  onContinueToPayment,
}: TopicDialogProps) => (
  <Modal
    open={open}
    onClose={onClose}
    eyebrow={
      selection
        ? CATALOGUE_TEXT.reviewEyebrow
        : CATALOGUE_TEXT.topicEyebrow(context?.topic.level ?? null)
    }
    title={
      selection ? (
        <>
          {CATALOGUE_TEXT.reviewTitle}
          <br />
          <em>{CATALOGUE_TEXT.reviewTitleEmphasis}</em>
        </>
      ) : (
        <em>{context?.topic.title}</em>
      )
    }
  >
    <div className={cn('body')}>
      {!selection ? (
        <Text as="p" variant="small" tone="muted" className={cn('note')}>
          {CATALOGUE_TEXT.topicWiseNote}
        </Text>
      ) : null}
      {hasUnknownBatch ? (
        <FieldStatus tone="error">{CATALOGUE_TEXT.batchNotFound}</FieldStatus>
      ) : null}
      {selection ? (
        <EnrolmentReview
          key={selection.batch.id}
          context={selection}
          onChooseAnother={onClearBatch}
          onContinueToPayment={() => onContinueToPayment(selection)}
        />
      ) : null}
      {!selection && context ? (
        <TopicDetails context={context} onSelectBatch={onSelectBatch} />
      ) : null}
    </div>
  </Modal>
);
