import { APP_ROUTES } from './routes';

// Terms, refund and contact pages. These are public: payment providers and
// students read them before paying. Review with the business before changes.

export const POLICY = {
  terms: 'terms',
  refunds: 'refunds',
  contact: 'contact',
} as const;

export type PolicyKey = (typeof POLICY)[keyof typeof POLICY];

export const SUPPORT_EMAIL = 'sridhaacademy1@gmail.com';

export type PolicySection = {
  heading: string;
  paragraphs?: readonly string[];
  items?: readonly string[];
};

export type PolicyContent = {
  eyebrow: string;
  title: string;
  titleEmphasis: string;
  updated: string;
  intro: string;
  sections: readonly PolicySection[];
};

const UPDATED = 'Last updated 29 October 2026';

export const POLICY_CONTENT: Record<PolicyKey, PolicyContent> = {
  terms: {
    eyebrow: 'SriDha Academy / Terms',
    title: 'Terms and',
    titleEmphasis: 'conditions.',
    updated: UPDATED,
    intro:
      'These terms apply when you create a SriDha Academy student account, enrol in a batch or pre-register for a topic. By using the website you agree to them.',
    sections: [
      {
        heading: 'What we offer',
        paragraphs: [
          'SriDha Academy teaches one topic at a time through live online batches. Each topic page shows its lessons, its batches and their schedule, and the fee before you pay.',
        ],
      },
      {
        heading: 'Your account',
        items: [
          'Give accurate details when you register, and keep them up to date.',
          'An account is for one student. Do not share your sign-in details.',
          'You are responsible for activity on your account. Tell us at once if you think someone else has used it.',
          'Students under 18 should use the website with a parent or guardian’s permission.',
        ],
      },
      {
        heading: 'Fees and payment',
        items: [
          'Fees are shown in Indian rupees on each topic before you pay.',
          'Payments are processed securely by Razorpay. SriDha Academy never sees or stores your card, UPI or bank details.',
          'Your seat in a batch is confirmed only once the payment succeeds.',
          'A pre-registration fee keeps your seat in the first batch of a topic when it opens.',
          'Refunds and cancellations follow our Refund and cancellation policy.',
        ],
      },
      {
        heading: 'Batches and schedules',
        paragraphs: [
          'We may occasionally need to reschedule a session or a batch. We will tell you as early as we can, and if a new time does not suit you, you can move to another batch or ask for a refund as set out in our Refund and cancellation policy.',
        ],
      },
      {
        heading: 'Using the classes and material',
        items: [
          'Class recordings, notes, test papers and other material are for your own learning only.',
          'Do not record, copy, share, sell or publish class material without our written permission.',
          'Be respectful in live classes. We may remove anyone who disrupts a class or behaves abusively.',
        ],
      },
      {
        heading: 'Our responsibility',
        paragraphs: [
          'We work hard to teach well and keep the website available, but we cannot promise particular marks or results, or that the website will never be interrupted. As far as the law allows, our total responsibility to you for any claim is limited to the fees you paid for the topic concerned.',
        ],
      },
      {
        heading: 'Changes and contact',
        paragraphs: [
          'We may update these terms. The date at the top shows the latest version, and continuing to use the website after a change means you accept it. These terms are governed by the laws of India.',
          `Questions about these terms? Email us at ${SUPPORT_EMAIL}.`,
        ],
      },
    ],
  },
  refunds: {
    eyebrow: 'SriDha Academy / Refunds',
    title: 'Refund and',
    titleEmphasis: 'cancellation policy.',
    updated: UPDATED,
    intro:
      'We want every student to be happy with their topic. This policy explains when you can cancel and how refunds work for batch enrolments and pre-registrations.',
    sections: [
      {
        heading: 'Batch enrolments',
        items: [
          'Cancel at least 24 hours before the first session of your batch for a full refund.',
          'Within 24 hours of the first session, or once the batch has started, fees are not refundable, but you may ask to move to a later batch of the same topic once, if seats are available.',
        ],
      },
      {
        heading: 'Pre-registrations',
        items: [
          'You can cancel a pre-registration for a full refund at any time before the first batch of that topic starts.',
          'If no batch for the topic opens within 90 days of your payment, we will refund you in full automatically.',
          'When the first batch opens, your pre-registration becomes your seat in it. The batch enrolment rules above then apply.',
        ],
      },
      {
        heading: 'If we cancel or reschedule',
        paragraphs: [
          'If we cancel a batch, or move it to a time you cannot attend, you can choose a full refund or a free move to another batch of the same topic.',
        ],
      },
      {
        heading: 'Failed or duplicate payments',
        paragraphs: [
          'If money leaves your account but your seat is not confirmed, or you are charged twice for the same seat, contact us with the payment reference and we will refund the extra amount in full.',
        ],
      },
      {
        heading: 'How to ask for a refund',
        items: [
          `Email ${SUPPORT_EMAIL} from the email address on your student account.`,
          'Include the topic, your batch and the payment reference from your confirmation email or Razorpay receipt.',
          'We reply within 2 working days. Approved refunds go back to the original payment method through Razorpay within 5–7 working days; your bank may take a little longer to show it.',
        ],
      },
    ],
  },
  contact: {
    eyebrow: 'SriDha Academy / Contact',
    title: 'Contact',
    titleEmphasis: 'us.',
    updated: UPDATED,
    intro:
      'Questions about a topic, a batch, a payment or your account? Write to us and the SriDha Academy team will help.',
    sections: [
      {
        heading: 'Email',
        paragraphs: [
          SUPPORT_EMAIL,
          'We reply within 2 working days, Monday to Saturday.',
        ],
      },
      {
        heading: 'About a payment',
        paragraphs: [
          'Please include the topic, your batch and the payment reference from your confirmation email or Razorpay receipt, so we can find your payment quickly.',
        ],
      },
      {
        heading: 'About your account',
        paragraphs: [
          'Write from the email address on your student account. For your security we never ask for your password.',
        ],
      },
    ],
  },
};

export const POLICY_ROUTE: Record<PolicyKey, string> = {
  terms: APP_ROUTES.TERMS,
  refunds: APP_ROUTES.REFUNDS,
  contact: APP_ROUTES.CONTACT,
};

// Links to these pages, for the footers
export const POLICY_LINKS_TITLE = 'Help';

export const POLICY_LINKS = [
  { label: 'Contact us', to: APP_ROUTES.CONTACT },
  { label: 'Terms and conditions', to: APP_ROUTES.TERMS },
  { label: 'Refund and cancellation', to: APP_ROUTES.REFUNDS },
] as const;
