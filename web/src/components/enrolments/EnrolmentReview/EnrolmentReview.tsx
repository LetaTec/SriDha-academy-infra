import cx from 'classnames/bind';

import { SelectionSummary } from '@components/catalogue/SelectionSummary/SelectionSummary';
import { Button } from '@components/ui/Button/Button';
import { Text } from '@components/ui/Text/Text';
import { canEnrolInBatch } from '@access/enrolments';
import { CATALOGUE_TEXT } from '@constants/catalogue';
import { useAuth } from '@context/AuthContext';
import type { BatchContext } from '@services/catalogue';

import styles from './EnrolmentReview.module.css';

const cn = cx.bind(styles);

export type EnrolmentReviewProps = {
  context: BatchContext;
  onChooseAnother: () => void;
  // Opens the payment panel with this batch chosen
  onContinueToPayment: () => void;
};

// The chosen batch before paying. A seat is only taken through payment
// checkout, which this hands over to.
export const EnrolmentReview = ({
  context,
  onChooseAnother,
  onContinueToPayment,
}: EnrolmentReviewProps) => {
  const auth = useAuth();
  const canEnrol = canEnrolInBatch(auth, context.batch);

  return (
    <div className={cn('review')}>
      <SelectionSummary context={context} />
      <Text as="p" variant="small" tone="muted">
        {CATALOGUE_TEXT.paymentNextNote}
      </Text>
      <div className={cn('actions')}>
        <Button variant="secondary" onClick={onChooseAnother}>
          {CATALOGUE_TEXT.chooseAnotherBatch}
        </Button>
        <Button
          disabled={!canEnrol}
          endIcon="arrowRight"
          onClick={onContinueToPayment}
        >
          {CATALOGUE_TEXT.continueToPayment}
        </Button>
      </div>
    </div>
  );
};
