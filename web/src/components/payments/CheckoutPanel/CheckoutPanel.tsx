import { useId, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import cx from 'classnames/bind';
import { z } from 'zod';

import { Button, ButtonRouteLink } from '@components/ui/Button/Button';
import { Drawer } from '@components/ui/Drawer/Drawer';
import { FieldForm, FieldStatus } from '@components/ui/Field/Field';
import { Heading } from '@components/ui/Heading/Heading';
import { Input } from '@components/ui/Input/Input';
import { KeyValueList } from '@components/ui/KeyValueList/KeyValueList';
import { RuledList } from '@components/ui/RuledList/RuledList';
import { Spinner } from '@components/ui/Spinner/Spinner';
import { StatusDot } from '@components/ui/StatusDot/StatusDot';
import { Text } from '@components/ui/Text/Text';
import {
  CHECKOUT_KIND,
  CHECKOUT_TEXT,
  PAYMENT_PROVIDER,
} from '@constants/payments';
import { APP_ROUTES } from '@constants/routes';
import { useAuth } from '@context/AuthContext';
import { useApiForm } from '@hooks/useApiForm';
import { useRefreshAfterPayment } from '@hooks/useRefreshAfterPayment';
import {
  isBatchOpen,
  type Batch,
  type TopicPreview,
} from '@services/catalogue';
import {
  createCheckout,
  payWithRazorpay,
  verifyPayment,
  type Checkout,
} from '@services/payments';
import { formatPrice } from '@utils/currency';
import { formatWallClockTime } from '@utils/date';

import styles from './CheckoutPanel.module.css';

const cn = cx.bind(styles);

const FORM_ID = 'checkout-form';

const billingSchema = z.object({
  fullName: z.string().trim().min(2, CHECKOUT_TEXT.fullNameInvalid),
  email: z.string().trim().pipe(z.email(CHECKOUT_TEXT.emailInvalid)),
  mobile: z
    .string()
    .trim()
    .regex(/^\+?[0-9][0-9\s-]{8,16}[0-9]$/, CHECKOUT_TEXT.mobileInvalid),
});

type BillingFormValues = z.infer<typeof billingSchema>;

type Stage =
  | { name: 'details' }
  // Razorpay's window is open; the panel steps aside so it can be used
  | { name: 'paying' }
  | { name: 'paid'; checkout: Checkout }
  // Test mode: the seat is held until the team collects payment
  | { name: 'pending'; checkout: Checkout };

const batchLabel = (batch: Batch) =>
  [
    batch.name,
    batch.scheduleLabel,
    batch.startTime ? formatWallClockTime(batch.startTime) : null,
  ]
    .filter(Boolean)
    .join(' · ');

export type CheckoutPanelProps = {
  open: boolean;
  // The topic's card with its catalogue topic; null while the catalogue is
  // still loading (or failed to load)
  preview: TopicPreview | null;
  // A batch the student already chose, preselected when still open
  preferredBatchId?: string | null;
  isLoading: boolean;
  onRetry: () => void;
  onClose: () => void;
};

// The payment panel: batch (or pre-registration), order summary and the
// student's details, then Razorpay's checkout for the payment itself. It
// opens at once and fills in when the catalogue arrives, so the panel never
// has to be swapped for another.
export const CheckoutPanel = ({
  open,
  preview,
  preferredBatchId = null,
  isLoading,
  onRetry,
  onClose,
}: CheckoutPanelProps) => {
  const { user } = useAuth();
  const batchFieldName = useId();
  const topic = preview?.topic ?? null;
  const batches = topic?.batches ?? [];
  const isEnrolment = batches.length > 0;
  const openBatches = batches.filter(isBatchOpen);
  const [chosenBatchId, setBatchId] = useState<string | null>(null);
  // The batch chosen earlier, else the next open one, until the student
  // picks another
  const preferredOpenBatch = openBatches.find(
    batch => batch.id === preferredBatchId,
  );
  const batchId =
    chosenBatchId ?? preferredOpenBatch?.id ?? openBatches[0]?.id ?? null;
  const [stage, setStage] = useState<Stage>({ name: 'details' });
  const refreshAfterPayment = useRefreshAfterPayment();
  // Problems with Razorpay's window, which are not API errors
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const selectedBatch = batches.find(batch => batch.id === batchId);
  const amount = topic?.price ? formatPrice(topic.price) : null;
  const action = isEnrolment
    ? CHECKOUT_TEXT.enrolEyebrow
    : CHECKOUT_TEXT.preRegisterEyebrow;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    formError,
    clearFormError,
    handleApiError,
  } = useApiForm<BillingFormValues>({
    resolver: zodResolver(billingSchema),
    defaultValues: {
      fullName: user?.student?.fullName ?? '',
      email: user?.email ?? '',
      mobile: '',
    },
  });

  const onSubmit = handleSubmit(async values => {
    if (!topic) return;
    clearFormError();
    setPaymentError(null);

    try {
      const checkout = await createCheckout(
        isEnrolment && batchId
          ? { kind: CHECKOUT_KIND.enrolment, batchId, ...values }
          : {
              kind: CHECKOUT_KIND.preRegistration,
              topicId: topic.id,
              ...values,
            },
      );

      if (checkout.provider.name !== PAYMENT_PROVIDER.razorpay) {
        refreshAfterPayment();
        setStage({ name: 'pending', checkout });
        return;
      }

      setStage({ name: 'paying' });
      const result = await payWithRazorpay(checkout, values).catch(() => {
        setPaymentError(CHECKOUT_TEXT.loadFailed);
        return null;
      });

      if (!result || result.status === 'closed') {
        // Closed after a declined attempt: say why, so they can try again
        if (result?.failureReason) {
          setPaymentError(CHECKOUT_TEXT.paymentFailed(result.failureReason));
        }
        setStage({ name: 'details' });
        return;
      }

      await verifyPayment(result.verification).catch(() => {
        throw new Error(CHECKOUT_TEXT.verifyFailed);
      });
      refreshAfterPayment();
      setStage({ name: 'paid', checkout });
    } catch (error) {
      setStage({ name: 'details' });
      if (
        error instanceof Error &&
        error.message === CHECKOUT_TEXT.verifyFailed
      ) {
        setPaymentError(CHECKOUT_TEXT.verifyFailed);
      } else {
        handleApiError(error);
      }
    }
  });

  const isFinished = stage.name === 'paid' || stage.name === 'pending';
  const canPay = Boolean(amount) && (!isEnrolment || Boolean(batchId));

  return (
    <Drawer
      open={open && stage.name !== 'paying'}
      onClose={onClose}
      eyebrow={
        preview ? CHECKOUT_TEXT.eyebrow(action, preview.level) : undefined
      }
      title={preview?.title ?? CHECKOUT_TEXT.topicPending}
      closeLabel={CHECKOUT_TEXT.close}
      footer={
        !topic ? undefined : isFinished ? (
          <div className={cn('finishActions')}>
            {stage.name === 'paid' ? (
              <ButtonRouteLink to={APP_ROUTES.MY_LEARNING} fullWidth>
                {CHECKOUT_TEXT.goToLearning}
              </ButtonRouteLink>
            ) : null}
            <Button
              variant={stage.name === 'paid' ? 'secondary' : 'primary'}
              fullWidth
              onClick={onClose}
            >
              {CHECKOUT_TEXT.done}
            </Button>
          </div>
        ) : (
          <div className={cn('payAction')}>
            <Button
              type="submit"
              form={FORM_ID}
              fullWidth
              loading={isSubmitting}
              disabled={!canPay}
              endIcon="arrowRight"
            >
              {amount ? CHECKOUT_TEXT.pay(amount) : action}
            </Button>
            <Text as="p" variant="small" tone="muted">
              {CHECKOUT_TEXT.secureNote}
            </Text>
          </div>
        )
      }
    >
      {!topic || !preview ? (
        <div className={cn('result')} role={isLoading ? 'status' : undefined}>
          {isLoading ? <Spinner tone="muted" /> : null}
          <Text as="p" variant="small" tone="muted">
            {isLoading
              ? CHECKOUT_TEXT.loadingTopic
              : CHECKOUT_TEXT.loadFailedTopic}
          </Text>
          {isLoading ? null : (
            <Button variant="secondary" onClick={onRetry}>
              {CHECKOUT_TEXT.retry}
            </Button>
          )}
        </div>
      ) : isFinished ? (
        <div className={cn('result')}>
          <StatusDot
            color={stage.name === 'paid' ? 'positive' : 'warning'}
            label={
              stage.name === 'paid'
                ? CHECKOUT_TEXT.paidTitle
                : CHECKOUT_TEXT.pendingTitle
            }
          />
          <Text as="p">
            {stage.name === 'pending'
              ? CHECKOUT_TEXT.pendingMessage
              : stage.checkout.batch
                ? CHECKOUT_TEXT.paidEnrolment(stage.checkout.batch.name)
                : CHECKOUT_TEXT.paidPreRegistration}
          </Text>
        </div>
      ) : (
        <div className={cn('sections')}>
          {isEnrolment ? (
            <fieldset className={cn('batches')}>
              <legend className={cn('legend')}>
                <Text as="span" variant="label">
                  {CHECKOUT_TEXT.batchLegend}
                </Text>
              </legend>
              {batches.map(batch => {
                const isOpen = isBatchOpen(batch);
                return (
                  <label
                    key={batch.id}
                    className={cn('batch', {
                      batchSelected: batch.id === batchId,
                      batchClosed: !isOpen,
                    })}
                  >
                    <input
                      type="radio"
                      name={batchFieldName}
                      value={batch.id}
                      checked={batch.id === batchId}
                      disabled={!isOpen}
                      onChange={() => setBatchId(batch.id)}
                    />
                    <Text as="span" variant="small">
                      {batchLabel(batch)}
                    </Text>
                    {isOpen ? null : (
                      <Text as="span" variant="caption" tone="muted">
                        {CHECKOUT_TEXT.batchFull}
                      </Text>
                    )}
                  </label>
                );
              })}
              {openBatches.length === 0 ? (
                <Text as="p" variant="small" tone="muted">
                  {CHECKOUT_TEXT.noOpenBatches}
                </Text>
              ) : null}
            </fieldset>
          ) : (
            <Text as="p" variant="small" className={cn('note')}>
              {CHECKOUT_TEXT.preRegisterNote}
            </Text>
          )}

          <section className={cn('section')}>
            <Heading level={3} variant="item">
              {CHECKOUT_TEXT.teachTitle}
            </Heading>
            <RuledList items={preview.subtopics} ordered />
          </section>

          <section className={cn('section')}>
            <Heading level={3} variant="item">
              {CHECKOUT_TEXT.summaryTitle}
            </Heading>
            <KeyValueList
              columns={2}
              items={[
                {
                  label: CHECKOUT_TEXT.summaryTopic,
                  value: `${preview.title}, ${preview.level}`,
                },
                {
                  label: CHECKOUT_TEXT.summaryBatch,
                  value: selectedBatch
                    ? selectedBatch.name
                    : CHECKOUT_TEXT.summaryFirstBatch,
                },
                {
                  label: CHECKOUT_TEXT.summaryTotal,
                  value: amount ?? '—',
                },
              ]}
            />
          </section>

          <section className={cn('section')}>
            <Heading level={3} variant="item">
              {CHECKOUT_TEXT.detailsTitle}
            </Heading>
            <FieldForm id={FORM_ID} onSubmit={onSubmit}>
              {formError || paymentError ? (
                <FieldStatus tone="error">
                  {formError ?? paymentError}
                </FieldStatus>
              ) : null}
              <Input
                label={CHECKOUT_TEXT.fullNameLabel}
                autoComplete="name"
                error={errors.fullName?.message}
                {...register('fullName')}
              />
              <Input
                label={CHECKOUT_TEXT.emailLabel}
                type="email"
                autoComplete="email"
                error={errors.email?.message}
                {...register('email')}
              />
              <Input
                label={CHECKOUT_TEXT.mobileLabel}
                type="tel"
                autoComplete="tel"
                error={errors.mobile?.message}
                {...register('mobile')}
              />
            </FieldForm>
          </section>
        </div>
      )}
    </Drawer>
  );
};
