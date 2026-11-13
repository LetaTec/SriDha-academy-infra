import { useEffect, useId, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import cx from 'classnames/bind';
import { z } from 'zod';

import { AccountAccess } from '@components/auth/AccountAccess/AccountAccess';
import { Button, ButtonRouteLink } from '@components/ui/Button/Button';
import { Checkbox } from '@components/ui/Checkbox/Checkbox';
import { EmptyState } from '@components/ui/EmptyState/EmptyState';
import { FieldForm, FieldStatus } from '@components/ui/Field/Field';
import { Heading } from '@components/ui/Heading/Heading';
import { Input } from '@components/ui/Input/Input';
import { RuledList } from '@components/ui/RuledList/RuledList';
import { Section } from '@components/ui/Section/Section';
import { Select } from '@components/ui/Select/Select';
import { Spinner } from '@components/ui/Spinner/Spinner';
import { StatusDot } from '@components/ui/StatusDot/StatusDot';
import { Text } from '@components/ui/Text/Text';
import {
  CHECKOUT_KIND,
  CHECKOUT_QUERY_PARAM,
  CHECKOUT_TEXT,
  INDIAN_STATE_OPTIONS,
  INDIAN_STATES,
  PAYMENT_PROVIDER,
} from '@constants/payments';
import { APP_ROUTES } from '@constants/routes';
import { useAuth } from '@context/AuthContext';
import { useApiForm } from '@hooks/useApiForm';
import { useRefreshAfterPayment } from '@hooks/useRefreshAfterPayment';
import { useTopicPreviews } from '@hooks/useTopicPreviews';
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

import { CheckoutTopicCard } from './components/CheckoutTopicCard/CheckoutTopicCard';
import { PriceSummary } from './components/PriceSummary/PriceSummary';
import styles from './CheckoutPage.module.css';

const cn = cx.bind(styles);

const TITLE_ID = 'checkout-title';
const FORM_ID = 'checkout-form';

const billingSchema = z.object({
  fullName: z.string().trim().min(2, CHECKOUT_TEXT.fullNameInvalid),
  email: z.string().trim().pipe(z.email(CHECKOUT_TEXT.emailInvalid)),
  mobile: z
    .string()
    .trim()
    .regex(/^\+?[0-9][0-9\s-]{8,16}[0-9]$/, CHECKOUT_TEXT.mobileInvalid),
  state: z
    .union([z.enum(INDIAN_STATES), z.literal('')])
    .refine(value => value !== '', CHECKOUT_TEXT.stateRequired),
  city: z.string().trim().min(2, CHECKOUT_TEXT.cityRequired).max(80),
  agreed: z.boolean().refine(Boolean, CHECKOUT_TEXT.agreeRequired),
});

// The state starts empty, so the form holds more than it submits
type BillingFormInput = z.input<typeof billingSchema>;
type BillingFormValues = z.output<typeof billingSchema>;

type Stage =
  | { name: 'details' }
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

// The page for one topic's payment: what the student is buying and when,
// their details, and the total with the Pay button. Razorpay's own window
// takes the card or UPI details.
const CheckoutPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const topicId = searchParams.get(CHECKOUT_QUERY_PARAM.topic);
  const batchParam = searchParams.get(CHECKOUT_QUERY_PARAM.batch);
  const { previews, isLoading, hasError, reload } = useTopicPreviews();
  const navigate = useNavigate();

  const preview =
    previews.find(item => item.catalogueTopicId === topicId) ?? null;

  // Back to where the topic was chosen, or to the Topics page when the
  // checkout link was opened directly
  const goBack = () => {
    const historyIndex = (window.history.state as { idx?: number } | null)?.idx;
    if (historyIndex) void navigate(-1);
    else void navigate(APP_ROUTES.TOPICS);
  };

  const chooseBatch = (batchId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set(CHECKOUT_QUERY_PARAM.batch, batchId);
    setSearchParams(next, { replace: true });
  };

  return (
    <Section labelledBy={TITLE_ID} className={cn('page')}>
      <div className={cn('head')}>
        <Button variant="editorial" onClick={goBack}>
          {CHECKOUT_TEXT.back}
        </Button>
        <Text as="div" variant="eyebrow">
          {CHECKOUT_TEXT.pageEyebrow}
        </Text>
        <Heading level={1} variant="display" id={TITLE_ID}>
          {CHECKOUT_TEXT.pageTitle} <em>{CHECKOUT_TEXT.pageTitleEmphasis}</em>
        </Heading>
      </div>

      {preview ? (
        <CheckoutDetails
          key={preview.catalogueTopicId}
          preview={preview}
          preferredBatchId={batchParam}
          onChooseBatch={chooseBatch}
        />
      ) : isLoading || hasError ? (
        <div className={cn('status')} role={isLoading ? 'status' : undefined}>
          {isLoading ? <Spinner tone="muted" /> : null}
          <Text as="p" variant="small" tone="muted">
            {isLoading
              ? CHECKOUT_TEXT.loadingTopic
              : CHECKOUT_TEXT.loadFailedTopic}
          </Text>
          {isLoading ? null : (
            <Button variant="secondary" onClick={reload}>
              {CHECKOUT_TEXT.retry}
            </Button>
          )}
        </div>
      ) : (
        <EmptyState
          title={CHECKOUT_TEXT.notFoundTitle}
          message={CHECKOUT_TEXT.notFoundMessage}
          action={
            <ButtonRouteLink to={APP_ROUTES.TOPICS} endIcon="arrowRight">
              {CHECKOUT_TEXT.browseTopics}
            </ButtonRouteLink>
          }
        />
      )}
    </Section>
  );
};

type CheckoutDetailsProps = {
  preview: TopicPreview;
  // A batch chosen before checkout (or after signing in), from the URL
  preferredBatchId: string | null;
  onChooseBatch: (batchId: string) => void;
};

const CheckoutDetails = ({
  preview,
  preferredBatchId,
  onChooseBatch,
}: CheckoutDetailsProps) => {
  const { status, user } = useAuth();
  const isSignedIn = status === 'authenticated';
  const batchFieldName = useId();
  const refreshAfterPayment = useRefreshAfterPayment();
  const [stage, setStage] = useState<Stage>({ name: 'details' });
  // Problems with Razorpay's window, which are not API errors
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const { topic } = preview;
  const batches = topic.batches;
  const isEnrolment = batches.length > 0;
  const openBatches = batches.filter(isBatchOpen);
  // The batch in the URL while it is open, else the next open one
  const batch =
    openBatches.find(item => item.id === preferredBatchId) ??
    openBatches[0] ??
    null;
  const amount = topic.price ? formatPrice(topic.price) : null;
  const canPay = Boolean(amount) && (!isEnrolment || batch !== null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    formError,
    clearFormError,
    handleApiError,
    reset,
  } = useApiForm<BillingFormInput, BillingFormValues>({
    resolver: zodResolver(billingSchema),
    defaultValues: {
      fullName: user?.student?.fullName ?? '',
      email: user?.email ?? '',
      mobile: '',
      state: '',
      city: '',
      agreed: false,
    },
  });

  // Signing in on this page fills in the details the account knows
  useEffect(() => {
    if (!user) return;
    reset(current => ({
      ...current,
      fullName: current.fullName || (user.student?.fullName ?? ''),
      email: current.email || user.email,
    }));
  }, [user, reset]);

  const onSubmit = handleSubmit(async ({ agreed: _agreed, ...billing }) => {
    clearFormError();
    setPaymentError(null);

    try {
      const checkout = await createCheckout(
        isEnrolment && batch
          ? { kind: CHECKOUT_KIND.enrolment, batchId: batch.id, ...billing }
          : {
              kind: CHECKOUT_KIND.preRegistration,
              topicId: topic.id,
              ...billing,
            },
      );

      if (checkout.provider.name !== PAYMENT_PROVIDER.razorpay) {
        refreshAfterPayment();
        setStage({ name: 'pending', checkout });
        return;
      }

      const result = await payWithRazorpay(checkout, billing).catch(() => {
        setPaymentError(CHECKOUT_TEXT.loadFailed);
        return null;
      });

      if (!result || result.status === 'closed') {
        // Closed after a declined attempt: say why, so they can try again
        if (result?.failureReason) {
          setPaymentError(CHECKOUT_TEXT.paymentFailed(result.failureReason));
        }
        return;
      }

      await verifyPayment(result.verification).catch(() => {
        throw new Error(CHECKOUT_TEXT.verifyFailed);
      });
      refreshAfterPayment();
      setStage({ name: 'paid', checkout });
    } catch (error) {
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

  if (stage.name !== 'details') {
    const isPaid = stage.name === 'paid';
    return (
      <div className={cn('result')}>
        <StatusDot
          color={isPaid ? 'positive' : 'warning'}
          label={isPaid ? CHECKOUT_TEXT.paidTitle : CHECKOUT_TEXT.pendingTitle}
        />
        <Text as="p">
          {!isPaid
            ? CHECKOUT_TEXT.pendingMessage
            : stage.checkout.batch
              ? CHECKOUT_TEXT.paidEnrolment(stage.checkout.batch.name)
              : CHECKOUT_TEXT.paidPreRegistration}
        </Text>
        <div className={cn('resultActions')}>
          <ButtonRouteLink to={APP_ROUTES.MY_LEARNING} endIcon="arrowRight">
            {CHECKOUT_TEXT.goToLearning}
          </ButtonRouteLink>
          <ButtonRouteLink to={APP_ROUTES.TOPICS} variant="secondary">
            {CHECKOUT_TEXT.browseTopics}
          </ButtonRouteLink>
        </div>
      </div>
    );
  }

  const payAction = isSignedIn ? (
    <>
      {formError || paymentError ? (
        <FieldStatus tone="error">{formError ?? paymentError}</FieldStatus>
      ) : null}
      <Checkbox
        form={FORM_ID}
        label={
          <>
            {CHECKOUT_TEXT.agreePrefix}{' '}
            <Link to={APP_ROUTES.TERMS} className={cn('link')}>
              {CHECKOUT_TEXT.agreeTerms}
            </Link>{' '}
            {CHECKOUT_TEXT.agreeJoin}{' '}
            <Link to={APP_ROUTES.REFUNDS} className={cn('link')}>
              {CHECKOUT_TEXT.agreeRefunds}
            </Link>
          </>
        }
        {...register('agreed')}
      />
      {errors.agreed?.message ? (
        <Text as="p" variant="small" tone="danger">
          {errors.agreed.message}
        </Text>
      ) : null}
      <Button
        type="submit"
        form={FORM_ID}
        fullWidth
        loading={isSubmitting}
        disabled={!canPay}
        endIcon="arrowRight"
      >
        {amount
          ? CHECKOUT_TEXT.pay(amount)
          : isEnrolment
            ? CHECKOUT_TEXT.enrolEyebrow
            : CHECKOUT_TEXT.preRegisterEyebrow}
      </Button>
    </>
  ) : (
    <Text as="p" variant="small" tone="muted">
      {CHECKOUT_TEXT.signInToPay}
    </Text>
  );

  return (
    <div className={cn('layout')}>
      <div className={cn('main')}>
        <CheckoutTopicCard
          preview={preview}
          batch={batch}
          isEnrolment={isEnrolment}
        />

        {isEnrolment ? (
          <section className={cn('card')}>
            <fieldset className={cn('batches')}>
              <legend className={cn('legend')}>
                <Text as="span" variant="strong">
                  {CHECKOUT_TEXT.batchLegend}
                </Text>
              </legend>
              {batches.map(item => {
                const isOpen = isBatchOpen(item);
                return (
                  <label
                    key={item.id}
                    className={cn('batch', {
                      batchSelected: item.id === batch?.id,
                      batchClosed: !isOpen,
                    })}
                  >
                    <input
                      type="radio"
                      name={batchFieldName}
                      value={item.id}
                      checked={item.id === batch?.id}
                      disabled={!isOpen}
                      onChange={() => onChooseBatch(item.id)}
                    />
                    <Text as="span" variant="small">
                      {batchLabel(item)}
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
          </section>
        ) : (
          <Text as="p" variant="small" className={cn('note')}>
            {CHECKOUT_TEXT.preRegisterNote}
          </Text>
        )}

        <section className={cn('card')}>
          <Heading level={2} variant="item">
            {CHECKOUT_TEXT.teachTitle}
          </Heading>
          <RuledList items={preview.subtopics} ordered />
          <Link to={APP_ROUTES.REFUNDS} className={cn('link')}>
            {CHECKOUT_TEXT.refundPolicyLink}
          </Link>
        </section>

        <section className={cn('card')}>
          {isSignedIn ? (
            <>
              <div className={cn('cardHead')}>
                <Heading level={2} variant="item">
                  {CHECKOUT_TEXT.detailsTitle}
                </Heading>
                <Text as="p" variant="small" tone="muted">
                  {CHECKOUT_TEXT.detailsNote}
                </Text>
              </div>
              <FieldForm id={FORM_ID} onSubmit={onSubmit}>
                <Input
                  label={CHECKOUT_TEXT.fullNameLabel}
                  autoComplete="name"
                  error={errors.fullName?.message}
                  {...register('fullName')}
                />
                <div className={cn('fieldPair')}>
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
                </div>
                {/* Where the student lives, for the tax invoice */}
                <div className={cn('fieldPair')}>
                  <Select
                    label={CHECKOUT_TEXT.stateLabel}
                    placeholder={CHECKOUT_TEXT.statePlaceholder}
                    options={INDIAN_STATE_OPTIONS}
                    autoComplete="address-level1"
                    error={errors.state?.message}
                    {...register('state')}
                  />
                  <Input
                    label={CHECKOUT_TEXT.cityLabel}
                    placeholder={CHECKOUT_TEXT.cityPlaceholder}
                    autoComplete="address-level2"
                    error={errors.city?.message}
                    {...register('city')}
                  />
                </div>
              </FieldForm>
            </>
          ) : status === 'anonymous' ? (
            <AccountAccess note={CHECKOUT_TEXT.signInNote} />
          ) : (
            <Spinner tone="muted" />
          )}
        </section>
      </div>

      <aside className={cn('aside')}>
        <PriceSummary
          amount={amount}
          taxLabel={topic.price?.taxLabel ?? null}
          action={payAction}
        />
      </aside>
    </div>
  );
};

export default CheckoutPage;
