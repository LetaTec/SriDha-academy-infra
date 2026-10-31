import cx from 'classnames/bind';

import { canViewTeamOrders } from '@/access/team';
import { formatTopicPrice } from '@components/catalogue/batchDetails';
import { Button, ButtonRouteLink } from '@components/ui/Button/Button';
import { Card } from '@components/ui/Card/Card';
import { CardGrid } from '@components/ui/CardGrid/CardGrid';
import { EmptyState } from '@components/ui/EmptyState/EmptyState';
import { Heading } from '@components/ui/Heading/Heading';
import { Section } from '@components/ui/Section/Section';
import { Spinner } from '@components/ui/Spinner/Spinner';
import { StatusDot } from '@components/ui/StatusDot/StatusDot';
import { Text } from '@components/ui/Text/Text';
import {
  CATALOGUE_TEXT,
  ENROLMENT_STATUS,
  ENROLMENT_STATUS_COLOR,
  ENROLMENT_STATUS_LABEL,
} from '@constants/catalogue';
import { BOOK_TEXT } from '@constants/home';
import { USER_ROLE, USER_ROLE_LABEL } from '@constants/auth';
import { PAGE_TEXT } from '@constants/pages';
import { PRE_REGISTRATION_STATUS_LABEL } from '@constants/payments';
import { APP_ROUTES } from '@constants/routes';
import { useAuth } from '@context/AuthContext';
import { useCheckout } from '@hooks/useCheckout';
import { useMyLearning } from '@hooks/useMyLearning';
import type { Enrolment } from '@services/enrolments';
import type { PreRegistration } from '@services/payments';
import { formatDateOnly } from '@utils/date';

import styles from './MyLearningPage.module.css';

const cn = cx.bind(styles);

const TITLE_ID = 'my-learning-title';

const describeEnrolment = (enrolment: Enrolment) =>
  [
    `${enrolment.batch.scheduleLabel} · ${enrolment.batch.name}`,
    enrolment.batch.startDate
      ? `${CATALOGUE_TEXT.startsLabel} ${formatDateOnly(enrolment.batch.startDate)}`
      : null,
    CATALOGUE_TEXT.lessonCount(enrolment.topic.lessons.length),
    formatTopicPrice(enrolment.topic.price),
  ]
    .filter(Boolean)
    .join(' · ');

const describePreRegistration = (preRegistration: PreRegistration) =>
  [
    PAGE_TEXT.myLearningPreRegisteredNote,
    formatTopicPrice(preRegistration.topic.price),
  ]
    .filter(Boolean)
    .join(' · ');

// The student's batches and pre-registrations, each with its payment
// status. Anything still waiting for payment can be paid from here.
const MyLearningPage = () => {
  const auth = useAuth();
  const { user } = auth;
  const { openCheckout } = useCheckout();
  const { enrolments, preRegistrations, isLoading, hasError, reload } =
    useMyLearning();

  const isPending = (status: Enrolment['status']) =>
    status === ENROLMENT_STATUS.PENDING_PAYMENT;
  const hasPendingPayment =
    enrolments.some(enrolment => isPending(enrolment.status)) ||
    preRegistrations.some(item => isPending(item.status));
  const isEmpty = enrolments.length === 0 && preRegistrations.length === 0;

  const completePayment = (topicId: string, topicTitle: string) => (
    <Button
      variant="plain"
      endIcon="arrowRight"
      aria-label={`${PAGE_TEXT.myLearningCompletePayment}: ${topicTitle}`}
      onClick={() => openCheckout(topicId)}
    >
      {PAGE_TEXT.myLearningCompletePayment}
    </Button>
  );

  return (
    <Section labelledBy={TITLE_ID} className={cn('page')}>
      <div className={cn('head')}>
        <Text as="div" variant="eyebrow">
          {PAGE_TEXT.myLearningEyebrow}
        </Text>
        <Heading level={1} variant="display" id={TITLE_ID}>
          {PAGE_TEXT.myLearningTitle}{' '}
          <em>{PAGE_TEXT.myLearningTitleEmphasis}</em>
        </Heading>
        {user ? (
          <Text as="p" tone="muted">
            {PAGE_TEXT.myLearningGreeting(
              user.student?.fullName ?? user.email,
              user.role === USER_ROLE.superAdmin
                ? USER_ROLE_LABEL[user.role]
                : undefined,
            )}
          </Text>
        ) : null}
        {canViewTeamOrders(auth) ? (
          <div>
            <ButtonRouteLink
              to={APP_ROUTES.TEAM_ORDERS}
              variant="secondary"
              endIcon="arrowRight"
            >
              {PAGE_TEXT.myLearningTeamOrders}
            </ButtonRouteLink>
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <div className={cn('status')} role="status">
          <Spinner tone="muted" />
          <Text variant="small" tone="muted">
            {PAGE_TEXT.loading}
          </Text>
        </div>
      ) : null}

      {hasError ? (
        <EmptyState
          title={PAGE_TEXT.myLearningLoadError}
          action={
            <Button variant="secondary" onClick={reload}>
              {CATALOGUE_TEXT.retry}
            </Button>
          }
        />
      ) : null}

      {!isLoading && !hasError && isEmpty ? (
        <EmptyState
          title={PAGE_TEXT.myLearningEmptyTitle}
          message={PAGE_TEXT.myLearningEmptyMessage}
          action={
            <ButtonRouteLink to={APP_ROUTES.TOPICS} endIcon="arrowRight">
              {PAGE_TEXT.myLearningBrowse}
            </ButtonRouteLink>
          }
        />
      ) : null}

      {!isLoading && !hasError && enrolments.length > 0 ? (
        <section className={cn('group')} aria-labelledby="my-batches-title">
          <Heading level={2} variant="title" id="my-batches-title">
            {PAGE_TEXT.myLearningSeatsTitle}
          </Heading>
          <CardGrid variant="tiled" columns={2}>
            {enrolments.map(enrolment => (
              <div key={enrolment.id}>
                <Card
                  variant="panel"
                  label={BOOK_TEXT.topicLabel(enrolment.topic.level)}
                  title={enrolment.topic.title}
                  description={describeEnrolment(enrolment)}
                  footer={
                    <div className={cn('footer')}>
                      <StatusDot
                        color={ENROLMENT_STATUS_COLOR[enrolment.status]}
                        label={ENROLMENT_STATUS_LABEL[enrolment.status]}
                      />
                      {isPending(enrolment.status)
                        ? completePayment(
                            enrolment.topic.id,
                            enrolment.topic.title,
                          )
                        : null}
                    </div>
                  }
                />
              </div>
            ))}
          </CardGrid>
        </section>
      ) : null}

      {!isLoading && !hasError && preRegistrations.length > 0 ? (
        <section
          className={cn('group')}
          aria-labelledby="my-pre-registrations-title"
        >
          <Heading level={2} variant="title" id="my-pre-registrations-title">
            {PAGE_TEXT.myLearningPreRegisteredTitle}
          </Heading>
          <CardGrid variant="tiled" columns={2}>
            {preRegistrations.map(preRegistration => (
              <div key={preRegistration.id}>
                <Card
                  variant="panel"
                  label={BOOK_TEXT.topicLabel(preRegistration.topic.level)}
                  title={preRegistration.topic.title}
                  description={describePreRegistration(preRegistration)}
                  footer={
                    <div className={cn('footer')}>
                      <StatusDot
                        color={ENROLMENT_STATUS_COLOR[preRegistration.status]}
                        label={
                          PRE_REGISTRATION_STATUS_LABEL[preRegistration.status]
                        }
                      />
                      {isPending(preRegistration.status)
                        ? completePayment(
                            preRegistration.topic.id,
                            preRegistration.topic.title,
                          )
                        : null}
                    </div>
                  }
                />
              </div>
            ))}
          </CardGrid>
        </section>
      ) : null}

      {!isLoading && !hasError && hasPendingPayment ? (
        <Text as="p" variant="small" tone="muted" className={cn('note')}>
          {PAGE_TEXT.myLearningPaymentNote}
        </Text>
      ) : null}
    </Section>
  );
};

export default MyLearningPage;
