import { useEffect, useId, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import cx from 'classnames/bind';
import { z } from 'zod';

import { canViewMyBatches } from '@/access/account';
import { canAnswerPapers } from '@/access/papers';
import { AccountDialog } from '@components/auth/AccountDialog/AccountDialog';
import { PasswordField } from '@components/auth/PasswordField/PasswordField';
import { Button, ButtonRouteLink } from '@components/ui/Button/Button';
import { Checkbox } from '@components/ui/Checkbox/Checkbox';
import { EmptyState } from '@components/ui/EmptyState/EmptyState';
import { FieldForm, FieldStatus } from '@components/ui/Field/Field';
import { Heading } from '@components/ui/Heading/Heading';
import { Input } from '@components/ui/Input/Input';
import { RuledList } from '@components/ui/RuledList/RuledList';
import { Section } from '@components/ui/Section/Section';
import { Select } from '@components/ui/Select/Select';
import { Skeleton } from '@components/ui/Skeleton/Skeleton';
import { StatusDot } from '@components/ui/StatusDot/StatusDot';
import { Text } from '@components/ui/Text/Text';
import type { BillingDetails, IndianState } from '@contracts/payments';
import {
  CHECKOUT_KIND,
  CHECKOUT_QUERY_PARAM,
  CHECKOUT_TEXT,
  CUSTOMER_TYPE,
  INDIAN_STATE_OPTIONS,
  INDIAN_STATES,
  PAYMENT_PROVIDER,
  PAYMENT_STATUS,
  TEST_CHECKOUT_TEXT,
} from '@constants/payments';
import {
  findTopicTestSize,
  TOPIC_TEST_DURATION_SECONDS,
} from '@constants/assessment';
import { APP_ROUTES, toTopicTest } from '@constants/routes';
import { useAuth } from '@context/AuthContext';
import { useApiForm } from '@hooks/useApiForm';
import { useRefreshAfterPayment } from '@hooks/useRefreshAfterPayment';
import { signUpStudent } from '@services/auth';
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
import { checkGstin } from '@utils/gstin';

import { CheckoutTopicCard } from './components/CheckoutTopicCard/CheckoutTopicCard';
import { PriceSummary } from './components/PriceSummary/PriceSummary';
import styles from './CheckoutPage.module.css';

const cn = cx.bind(styles);

const TITLE_ID = 'checkout-title';
// The API's minimum for a new password
const PASSWORD_MIN_LENGTH = 8;
const FORM_ID = 'checkout-form';

const billingSchema = z
  .object({
    customerType: z.enum([CUSTOMER_TYPE.individual, CUSTOMER_TYPE.business]),
    fullName: z.string().trim().min(2, CHECKOUT_TEXT.fullNameInvalid),
    email: z.string().trim().pipe(z.email(CHECKOUT_TEXT.emailInvalid)),
    mobile: z
      .string()
      .trim()
      .regex(/^\+?[0-9][0-9\s-]{8,16}[0-9]$/, CHECKOUT_TEXT.mobileInvalid),
    // A business's tax invoice needs its address; an individual has none
    addressLine1: z.string().trim().max(200).optional(),
    addressLine2: z.string().trim().max(200).optional(),
    state: z
      .union([z.enum(INDIAN_STATES), z.literal('')])
      .refine(value => value !== '', CHECKOUT_TEXT.stateRequired),
    city: z.string().trim().min(2, CHECKOUT_TEXT.cityRequired).max(80),
    pinCode: z
      .string()
      .trim()
      .regex(/^[1-9][0-9]{5}$/, CHECKOUT_TEXT.pinCodeInvalid),
    businessLegalName: z.string().trim().max(200).optional(),
    gstin: z.string().trim().max(30).optional(),
    purchaseOrderReference: z.string().trim().max(60).optional(),
    agreed: z.boolean().refine(Boolean, CHECKOUT_TEXT.agreeRequired),
    // A visitor creates their account with the order; checked on submit
    password: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.customerType === CUSTOMER_TYPE.business) {
      if (!data.addressLine1 || data.addressLine1.trim().length < 3) {
        ctx.addIssue({
          code: 'custom',
          path: ['addressLine1'],
          message: CHECKOUT_TEXT.addressLine1Invalid,
        });
      }
      if (!data.businessLegalName || data.businessLegalName.trim().length < 2) {
        ctx.addIssue({
          code: 'custom',
          path: ['businessLegalName'],
          message: CHECKOUT_TEXT.businessLegalNameInvalid,
        });
      }
      if (!data.gstin || !data.gstin.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['gstin'],
          message: CHECKOUT_TEXT.gstinRequired,
        });
      } else {
        const check = checkGstin(data.gstin);
        if (!check.valid) {
          ctx.addIssue({
            code: 'custom',
            path: ['gstin'],
            message:
              CHECKOUT_TEXT.gstinProblemMessage[check.problem] ??
              CHECKOUT_TEXT.gstinInvalid,
          });
        } else if (data.state && check.state !== data.state) {
          ctx.addIssue({
            code: 'custom',
            path: ['gstin'],
            message: CHECKOUT_TEXT.gstinStateMismatch(check.state),
          });
        }
      }
    }
  });

// The state starts empty, so the form holds more than it submits
type BillingFormInput = z.input<typeof billingSchema>;
type BillingFormValues = z.output<typeof billingSchema>;
// The fields an account's details fill in
type AccountField =
  'fullName' | 'email' | 'mobile' | 'state' | 'city' | 'pinCode';

type Stage =
  | { name: 'details' }
  // The confirmation goes to the email the student paid with
  | { name: 'paid'; checkout: Checkout; email: string }
  // Authorised by Razorpay, capture not reported yet
  | { name: 'confirming'; checkout: Checkout; email: string }
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
// their details, and the total with the Pay button. No account is needed:
// the seat belongs to the email they pay with. Razorpay's own window takes
// the card or UPI details.
// The topic, batch and price panels in outline while the topic loads, so
// the page keeps its shape instead of showing a spinner
const CheckoutSkeleton = () => (
  <div className={cn('layout')} role="status">
    <span className={cn('visuallyHidden')}>{CHECKOUT_TEXT.loadingTopic}</span>
    <div className={cn('main')} aria-hidden="true">
      <div className={cn('card')}>
        <Skeleton shape="title" width="md" />
        <Skeleton width="sm" />
        <Skeleton width="lg" />
      </div>
      <div className={cn('card')}>
        <Skeleton shape="icon" />
        <Skeleton shape="price" width="sm" />
        <Skeleton width="md" />
      </div>
      <div className={cn('card')}>
        <Skeleton width="xs" />
        <Skeleton width="md" />
        <Skeleton width="sm" />
        <Skeleton width="md" />
      </div>
    </div>
    <div className={cn('aside')} aria-hidden="true">
      <div className={cn('card')}>
        <Skeleton shape="title" width="md" />
        <Skeleton width="full" />
        <Skeleton shape="price" width="full" />
        <Skeleton shape="title" width="full" />
      </div>
    </div>
  </div>
);

const CheckoutPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const topicId = searchParams.get(CHECKOUT_QUERY_PARAM.topic);
  const batchParam = searchParams.get(CHECKOUT_QUERY_PARAM.batch);
  // An attempt at a topic's test, instead of a seat
  const testTopicId = searchParams.get(CHECKOUT_QUERY_PARAM.test);
  const isTest = testTopicId !== null;
  const { previews, allPreviews, isLoading, hasError, reload } =
    useTopicPreviews();
  const navigate = useNavigate();

  // Test topics have no batches, so they come from every topic
  const preview = isTest
    ? (allPreviews.find(
        item =>
          item.catalogueTopicId === testTopicId &&
          item.topic.testPrice !== null,
      ) ?? null)
    : (previews.find(item => item.catalogueTopicId === topicId) ?? null);

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
          {CHECKOUT_TEXT.pageTitle}{' '}
          <em>
            {isTest
              ? TEST_CHECKOUT_TEXT.pageTitleEmphasis
              : CHECKOUT_TEXT.pageTitleEmphasis}
          </em>
        </Heading>
      </div>

      {preview ? (
        <CheckoutDetails
          key={`${preview.catalogueTopicId}-${isTest}`}
          preview={preview}
          isTest={isTest}
          preferredBatchId={batchParam}
          onChooseBatch={chooseBatch}
        />
      ) : hasError ? (
        <div className={cn('status')}>
          <Text as="p" variant="small" tone="muted">
            {CHECKOUT_TEXT.loadFailedTopic}
          </Text>
          <Button variant="secondary" onClick={reload}>
            {CHECKOUT_TEXT.retry}
          </Button>
        </div>
      ) : isLoading ? (
        <CheckoutSkeleton />
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
  // Buying one attempt at the topic's test, which needs a signed-in student
  isTest: boolean;
  // A batch chosen before checkout, from the URL
  preferredBatchId: string | null;
  onChooseBatch: (batchId: string) => void;
};

const CheckoutDetails = ({
  preview,
  isTest,
  preferredBatchId,
  onChooseBatch,
}: CheckoutDetailsProps) => {
  const batchFieldName = useId();
  const auth = useAuth();
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  // A visitor's account is made with the order: they choose a password
  const isSignedIn = canAnswerPapers(auth);
  const testQuestionCount = findTopicTestSize(preview.catalogueTopicId) ?? 0;
  const testMinutes = TOPIC_TEST_DURATION_SECONDS / 60;
  const refreshAfterPayment = useRefreshAfterPayment();
  const [stage, setStage] = useState<Stage>({ name: 'details' });
  // Problems with Razorpay's window, which are not API errors
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const { topic } = preview;
  const batches = topic.batches;
  const isEnrolment = !isTest && batches.length > 0;
  const openBatches = batches.filter(isBatchOpen);
  // The batch in the URL while it is open, else the next open one
  const batch =
    openBatches.find(item => item.id === preferredBatchId) ??
    openBatches[0] ??
    null;
  const price = isTest ? topic.testPrice : topic.price;
  const amount = price ? formatPrice(price) : null;
  const canPay = Boolean(amount) && (!isEnrolment || batch !== null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    formError,
    clearFormError,
    handleApiError,
    getValues,
    setValue,
    setError,
  } = useApiForm<BillingFormInput, BillingFormValues>({
    resolver: zodResolver(billingSchema),
    defaultValues: {
      customerType: CUSTOMER_TYPE.individual,
      fullName: '',
      email: '',
      mobile: '',
      addressLine1: '',
      addressLine2: '',
      state: '',
      city: '',
      pinCode: '',
      businessLegalName: '',
      gstin: '',
      purchaseOrderReference: '',
      agreed: false,
      password: '',
    },
  });

  // A signed-in student starts from their account's details (name, email,
  // mobile, state, city, PIN code), so the seat or test lands on their
  // account (and in My batches). Fields they have typed are kept.
  const { user } = auth;
  useEffect(() => {
    if (!user || !canViewMyBatches(auth)) return;
    const fill = (field: AccountField, value: string | null | undefined) => {
      if (value && !getValues(field)) {
        setValue(field, value, { shouldValidate: true });
      }
    };
    fill('fullName', user.name);
    fill('email', user.email);
    fill('mobile', user.contact?.mobile);
    fill('state', user.contact?.state);
    fill('city', user.contact?.city);
    fill('pinCode', user.contact?.pinCode);
  }, [auth, user, getValues, setValue]);

  const customerType = watch('customerType');
  const isBusiness = customerType === CUSTOMER_TYPE.business;

  const onSubmit = handleSubmit(
    async ({ agreed: _agreed, password, ...billing }) => {
      clearFormError();
      setPaymentError(null);

      // A visitor's account is created first, with the same details, so the
      // seat or test is theirs and shows under My batches
      if (!isSignedIn) {
        if (!password || password.length < PASSWORD_MIN_LENGTH) {
          setError('password', { message: CHECKOUT_TEXT.passwordTooShort });
          return;
        }
        try {
          auth.login(
            await signUpStudent({
              fullName: billing.fullName,
              email: billing.email,
              password,
              mobile: billing.mobile,
              state: billing.state as IndianState,
              city: billing.city,
              pinCode: billing.pinCode,
            }),
          );
        } catch (error) {
          handleApiError(error);
          return;
        }
      }

      const isBusinessBuyer = billing.customerType === CUSTOMER_TYPE.business;
      const billingPayload: BillingDetails = {
        customerType: billing.customerType,
        fullName: billing.fullName,
        email: billing.email,
        mobile: billing.mobile,
        ...(isBusinessBuyer && billing.addressLine1?.trim()
          ? { addressLine1: billing.addressLine1.trim() }
          : {}),
        ...(isBusinessBuyer && billing.addressLine2?.trim()
          ? { addressLine2: billing.addressLine2.trim() }
          : {}),
        state: billing.state as IndianState,
        city: billing.city,
        pinCode: billing.pinCode,
        ...(isBusinessBuyer
          ? {
              businessLegalName: billing.businessLegalName?.trim(),
              gstin: billing.gstin?.trim().toUpperCase(),
              ...(billing.purchaseOrderReference?.trim()
                ? {
                    purchaseOrderReference:
                      billing.purchaseOrderReference.trim(),
                  }
                : {}),
            }
          : {}),
      };

      try {
        const checkout = await createCheckout(
          isTest
            ? {
                kind: CHECKOUT_KIND.testAttempt,
                topicId: topic.id,
                ...billingPayload,
              }
            : isEnrolment && batch
              ? {
                  kind: CHECKOUT_KIND.enrolment,
                  batchId: batch.id,
                  ...billingPayload,
                }
              : {
                  kind: CHECKOUT_KIND.preRegistration,
                  topicId: topic.id,
                  ...billingPayload,
                },
        );

        if (checkout.provider.name !== PAYMENT_PROVIDER.razorpay) {
          refreshAfterPayment();
          setStage({ name: 'pending', checkout });
          return;
        }

        const result = await payWithRazorpay(checkout, billingPayload).catch(
          () => {
            setPaymentError(CHECKOUT_TEXT.loadFailed);
            return null;
          },
        );

        if (!result || result.status === 'closed') {
          // Closed after a declined attempt: say why, so they can try again
          if (result?.failureReason) {
            setPaymentError(CHECKOUT_TEXT.paymentFailed(result.failureReason));
          }
          return;
        }

        const payment = await verifyPayment(result.verification).catch(() => {
          throw new Error(CHECKOUT_TEXT.verifyFailed);
        });
        refreshAfterPayment();
        // Paid only once Razorpay reports the capture; until then the
        // student is told it is being confirmed, never that the seat is theirs
        setStage(
          payment.status === PAYMENT_STATUS.paid
            ? { name: 'paid', checkout, email: billing.email }
            : { name: 'confirming', checkout, email: billing.email },
        );
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
    },
  );

  if (stage.name !== 'details') {
    const isPaid = stage.name === 'paid';
    const title = isPaid
      ? CHECKOUT_TEXT.paidTitle
      : stage.name === 'confirming'
        ? CHECKOUT_TEXT.confirmingTitle
        : CHECKOUT_TEXT.pendingTitle;
    const message =
      stage.name === 'confirming'
        ? CHECKOUT_TEXT.confirmingMessage(stage.email)
        : !isPaid
          ? CHECKOUT_TEXT.pendingMessage
          : isTest
            ? TEST_CHECKOUT_TEXT.paid
            : stage.checkout.batch
              ? CHECKOUT_TEXT.paidEnrolment(stage.checkout.batch.name)
              : CHECKOUT_TEXT.paidPreRegistration;
    return (
      <div className={cn('result')}>
        <StatusDot color={isPaid ? 'positive' : 'warning'} label={title} />
        <Text as="p">{message}</Text>
        {stage.name === 'paid' ? (
          <Text as="p" variant="small" tone="muted">
            {CHECKOUT_TEXT.emailedTo(stage.email)}
          </Text>
        ) : null}
        <div className={cn('resultActions')}>
          {isTest ? (
            <ButtonRouteLink to={toTopicTest(topic.id)} endIcon="arrowRight">
              {TEST_CHECKOUT_TEXT.startTest}
            </ButtonRouteLink>
          ) : isPaid && stage.checkout.batch && canViewMyBatches(auth) ? (
            <ButtonRouteLink to={APP_ROUTES.MY_BATCHES} endIcon="arrowRight">
              {CHECKOUT_TEXT.seeMyBatches}
            </ButtonRouteLink>
          ) : (
            <ButtonRouteLink to={APP_ROUTES.TOPICS} endIcon="arrowRight">
              {CHECKOUT_TEXT.browseTopics}
            </ButtonRouteLink>
          )}
        </div>
        {/* A visitor who paid can follow the batch by signing up with the
            same email */}
        {isPaid &&
        stage.checkout.batch &&
        !isTest &&
        !canViewMyBatches(auth) ? (
          <div className={cn('resultActions')}>
            <Text as="p" variant="small" tone="muted">
              {CHECKOUT_TEXT.signUpForMyBatches(stage.email)}
            </Text>
            <Button variant="secondary" onClick={() => setIsAccountOpen(true)}>
              {TEST_CHECKOUT_TEXT.signIn}
            </Button>
            <AccountDialog
              open={isAccountOpen}
              onClose={() => setIsAccountOpen(false)}
            />
          </div>
        ) : null}
      </div>
    );
  }

  const payAction = (
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
  );

  return (
    <div className={cn('layout')}>
      <div className={cn('main')}>
        <CheckoutTopicCard
          preview={preview}
          batch={batch}
          isEnrolment={isEnrolment}
          test={
            isTest
              ? { questionCount: testQuestionCount, minutes: testMinutes }
              : undefined
          }
        />

        {isTest ? null : isEnrolment ? (
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
            {isTest ? TEST_CHECKOUT_TEXT.coversTitle : CHECKOUT_TEXT.teachTitle}
          </Heading>
          <RuledList items={preview.subtopics} ordered />
          <Text as="p" variant="small" tone="muted">
            {isTest
              ? TEST_CHECKOUT_TEXT.paymentNote
              : CHECKOUT_TEXT.paymentNote}
          </Text>
        </section>

        <section className={cn('card')}>
          <div className={cn('cardHead')}>
            <Heading level={2} variant="item">
              {CHECKOUT_TEXT.detailsTitle}
            </Heading>
            <Text as="p" variant="small" tone="muted">
              {CHECKOUT_TEXT.detailsNote}
            </Text>
          </div>
          <FieldForm id={FORM_ID} onSubmit={onSubmit}>
            {/* Customer Type Selector */}
            <fieldset className={cn('customerTypes')}>
              <legend className={cn('legend')}>
                <Text as="span" variant="strong">
                  {CHECKOUT_TEXT.customerTypeLegend}
                </Text>
              </legend>
              <div className={cn('customerTypeOptions')}>
                <label
                  className={cn('customerTypeOption', {
                    customerTypeSelected:
                      customerType === CUSTOMER_TYPE.individual,
                  })}
                >
                  <input
                    type="radio"
                    value={CUSTOMER_TYPE.individual}
                    {...register('customerType')}
                  />
                  <div className={cn('customerTypeLabel')}>
                    <Text as="span" variant="small">
                      {CHECKOUT_TEXT.customerTypeIndividual}
                    </Text>
                    <Text as="span" variant="caption" tone="muted">
                      {CHECKOUT_TEXT.customerTypeIndividualDesc}
                    </Text>
                  </div>
                </label>
                <label
                  className={cn('customerTypeOption', {
                    customerTypeSelected:
                      customerType === CUSTOMER_TYPE.business,
                  })}
                >
                  <input
                    type="radio"
                    value={CUSTOMER_TYPE.business}
                    {...register('customerType')}
                  />
                  <div className={cn('customerTypeLabel')}>
                    <Text as="span" variant="small">
                      {CHECKOUT_TEXT.customerTypeBusiness}
                    </Text>
                    <Text as="span" variant="caption" tone="muted">
                      {CHECKOUT_TEXT.customerTypeBusinessDesc}
                    </Text>
                  </div>
                </label>
              </div>
            </fieldset>

            <Input
              label={
                isBusiness
                  ? CHECKOUT_TEXT.fullNameContactLabel
                  : CHECKOUT_TEXT.fullNameLabel
              }
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

            {/* Where the student/business lives, for billing and tax records */}
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
            {/* A visitor chooses a password here: paying also creates
                their account, with these details */}
            <div className={cn({ fieldPair: !isSignedIn })}>
              <Input
                label={CHECKOUT_TEXT.pinCodeLabel}
                placeholder={CHECKOUT_TEXT.pinCodePlaceholder}
                autoComplete="postal-code"
                inputMode="numeric"
                error={errors.pinCode?.message}
                {...register('pinCode')}
              />
              {isSignedIn ? null : (
                <PasswordField
                  label={CHECKOUT_TEXT.createPasswordLabel}
                  autoComplete="new-password"
                  error={errors.password?.message}
                  {...register('password')}
                />
              )}
            </div>
            {isSignedIn ? null : (
              <div className={cn('accountNote')}>
                <Text as="p" variant="small" tone="muted">
                  {CHECKOUT_TEXT.createAccountNote}
                </Text>
                <Button variant="plain" onClick={() => setIsAccountOpen(true)}>
                  {CHECKOUT_TEXT.haveAccount}
                </Button>
                <AccountDialog
                  open={isAccountOpen}
                  onClose={() => setIsAccountOpen(false)}
                  initialMode="signIn"
                />
              </div>
            )}

            {/* Business Details (rendered when customerType is Business) */}
            {isBusiness ? (
              <div className={cn('businessFields')}>
                <div className={cn('cardHead')}>
                  <Heading level={3} variant="item">
                    {CHECKOUT_TEXT.businessSectionTitle}
                  </Heading>
                  <Text as="p" variant="small" tone="muted">
                    {CHECKOUT_TEXT.businessSectionNote}
                  </Text>
                </div>
                <Input
                  label={CHECKOUT_TEXT.addressLine1Label}
                  placeholder={CHECKOUT_TEXT.addressLine1Placeholder}
                  autoComplete="street-address"
                  error={errors.addressLine1?.message}
                  {...register('addressLine1')}
                />
                <Input
                  label={CHECKOUT_TEXT.addressLine2Label}
                  placeholder={CHECKOUT_TEXT.addressLine2Placeholder}
                  error={errors.addressLine2?.message}
                  {...register('addressLine2')}
                />
                <Input
                  label={CHECKOUT_TEXT.businessLegalNameLabel}
                  placeholder={CHECKOUT_TEXT.businessLegalNamePlaceholder}
                  autoComplete="organization"
                  error={errors.businessLegalName?.message}
                  {...register('businessLegalName')}
                />
                <Input
                  label={CHECKOUT_TEXT.gstinLabel}
                  placeholder={CHECKOUT_TEXT.gstinPlaceholder}
                  error={errors.gstin?.message}
                  {...register('gstin')}
                />
                <Input
                  label={CHECKOUT_TEXT.purchaseOrderLabel}
                  placeholder={CHECKOUT_TEXT.purchaseOrderPlaceholder}
                  error={errors.purchaseOrderReference?.message}
                  {...register('purchaseOrderReference')}
                />
              </div>
            ) : null}
          </FieldForm>
        </section>
      </div>

      <aside className={cn('aside')}>
        <PriceSummary
          amount={amount}
          taxLabel={price?.taxLabel ?? null}
          action={payAction}
          feeLabel={isTest ? TEST_CHECKOUT_TEXT.fee : undefined}
        />
      </aside>
    </div>
  );
};

export default CheckoutPage;
