import { APP_ROUTES } from './routes';

// Terms and contact pages. These are public: payment providers and
// students read them before paying. Review with the business before changes.

export const POLICY = {
  terms: 'terms',
  contact: 'contact',
} as const;

export type PolicyKey = (typeof POLICY)[keyof typeof POLICY];

export const SUPPORT_EMAIL = 'sridhaacademy1@gmail.com';

export type PolicySection = {
  heading: string;
  paragraphs?: readonly string[];
  items?: readonly string[];
  // Paragraphs that follow the list
  after?: readonly string[];
};

export type PolicyContent = {
  eyebrow: string;
  title: string;
  titleEmphasis: string;
  updated: string;
  intro?: string;
  sections: readonly PolicySection[];
};

const UPDATED = 'Last updated 29 October 2026';

export const POLICY_CONTENT: Record<PolicyKey, PolicyContent> = {
  // The Terms and Conditions as the team wrote them
  // (SriDha_Website_T&C_14112026.docx), word for word
  terms: {
    eyebrow: 'SriDha Academy / Terms',
    title: 'Terms and',
    titleEmphasis: 'conditions.',
    updated: 'Effective date: 13 November 2026',
    sections: [
      {
        heading: '1. Introduction',
        paragraphs: [
          'Welcome to SriDha Academy ("Academy", "we", "us", or "our"). These Terms and Conditions govern your access to and use of our website, educational services, learning resources, and related digital platforms.',
          'By registering, enrolling, purchasing a course, or using our services, you agree to these Terms and Conditions and our Privacy Policy.',
          'If you do not agree, please discontinue using the platform.',
        ],
      },
      {
        heading: '2. Educational Services',
        paragraphs: [
          'SriDha Academy provides educational and academic support services, which may include:',
        ],
        items: [
          'Online and offline educational classes.',
          'Live and recorded lectures.',
          'Academic courses and examination preparation.',
          'Study materials, assignments, and assessments.',
          'Student progress tracking and academic guidance.',
          'Teacher-student communication and learning support.',
          'AI generated test papers and Model Test Paper',
        ],
        after: [
          'The availability and nature of services may vary depending on the selected course, subscription, or academic programme.',
        ],
      },
      {
        heading: '3. User Registration and Accounts',
        paragraphs: ['Users registering on SriDha Academy agree to:'],
        items: [
          'Provide accurate, complete, and current information.',
          'Maintain the confidentiality of account credentials.',
          'Use their accounts only for authorised educational purposes.',
          'Notify the Academy of suspected unauthorised access.',
          'Refrain from impersonating other users or creating fraudulent accounts.',
        ],
        after: [
          'The Academy reserves the right to suspend or terminate accounts involved in fraud, misuse, or material violations of these Terms, subject to applicable law.',
        ],
      },
      {
        heading: '4. Student Responsibilities',
        paragraphs: ['Students are expected to:'],
        items: [
          'Maintain respectful and appropriate conduct.',
          'Attend scheduled classes and complete assigned academic activities.',
          'Avoid academic dishonesty, plagiarism, and examination misconduct.',
          'Refrain from harassing teachers, students, or administrative personnel.',
          'Avoid recording, distributing, or commercially exploiting educational content without authorisation.',
        ],
        after: [
          "Violation of these requirements may result in disciplinary action, including suspension or termination of access, subject to applicable law and the Academy's disciplinary procedures.",
        ],
      },
      {
        heading: '5. Teacher and Faculty Responsibilities',
        paragraphs: [
          'Teachers and faculty members associated with SriDha Academy must:',
        ],
        items: [
          'Maintain professional standards and educational integrity.',
          'Protect confidential student and institutional information.',
          'Use student information solely for authorised academic purposes.',
          'Avoid unauthorised disclosure or commercial use of student contact information.',
          'Comply with applicable child-safety, privacy, and professional conduct requirements.',
        ],
        after: [
          'Teachers shall not use student or parent contact details for personal solicitation, unauthorised private tuition promotion, or disclosure to competitors or unrelated third parties.',
          'Additional contractual obligations may apply under separate faculty agreements.',
        ],
      },
      {
        heading: '6. Fees, Payments and Enrolment',
        paragraphs: ['Where paid services are offered:'],
        items: [
          'Applicable fees, taxes, course duration, and payment terms will be communicated before purchase.',
          'Enrolment may be confirmed after successful payment or completion of the prescribed admission process.',
          'Payments may be processed through authorised third-party payment service providers.',
          'Any instalment arrangements must be expressly approved by the Academy.',
          'Students are responsible for reviewing course details and fees before confirming payment.',
        ],
        after: [
          'The Academy will disclose any additional mandatory charges before completing a transaction.',
        ],
      },
      {
        heading: '7. Cancellation and Refunds',
        paragraphs: [
          'Cancellation and refund eligibility shall be governed by the Refund and Cancellation Policy communicated at the time of enrolment or purchase.',
          'Refund requests will be reviewed according to the applicable policy, the services delivered, and relevant consumer protection laws.',
          'Nothing in these Terms limits statutory rights to refunds or remedies where services are deficient, cancelled, misrepresented, or otherwise subject to mandatory legal protections.',
        ],
      },
      {
        heading: '8. Intellectual Property Rights',
        paragraphs: [
          'All original educational content, including videos, notes, course materials, assessments, graphics, software, logos, and website content, is owned by SriDha Academy or its respective licensors.',
          'Users receive a limited, personal, non-exclusive, non-transferable licence to access purchased or authorised educational materials.',
          'Users may not reproduce, resell, redistribute, publicly upload, or commercially exploit protected materials without prior written permission, except where permitted by law.',
        ],
      },
      {
        heading: '9. Prohibited Activities',
        paragraphs: ['Users must not:'],
        items: [
          'Attempt unauthorised access to accounts, servers, or databases.',
          'Upload malicious software or interfere with platform operations.',
          'Share paid course access without authorisation.',
          'Scrape, harvest, or misuse student or teacher information.',
          'Publish unlawful, abusive, defamatory, or infringing content.',
          'Circumvent technical access controls or security mechanisms.',
        ],
      },
      {
        heading: '10. Course Changes and Availability',
        paragraphs: [
          'SriDha Academy may reasonably update course content, teaching schedules, faculty assignments, and educational delivery methods.',
          'Where a material change adversely affects a paid enrolment, the Academy will provide appropriate notice and any remedy required by applicable law or the relevant enrolment agreement.',
          'Temporary interruptions may occur due to maintenance, technical failures, Internet Issues or circumstances beyond reasonable control.',
        ],
      },
      {
        heading: '11. Academic Results Disclaimer',
        paragraphs: [
          'SriDha Academy aims to provide quality educational support. However, individual academic results depend on factors including attendance, preparation, participation, and examination performance.',
          'Unless expressly agreed otherwise in writing, the Academy does not guarantee particular examination marks, admission outcomes, rankings, employment opportunities, or other academic results.',
        ],
      },
      {
        heading: '12. Limitation of Liability',
        paragraphs: [
          'To the extent permitted by applicable law, SriDha Academy shall not be responsible for indirect or consequential losses arising from misuse of the platform or circumstances outside its reasonable control.',
        ],
      },
      {
        heading: '13. Privacy and Data Protection',
        paragraphs: [
          "The collection, processing, storage, and disclosure of personal information are governed by the Academy's Privacy Policy and applicable Indian data protection laws.",
          'Users should review the Privacy Policy before providing personal information.',
        ],
      },
      {
        heading: '14. Suspension and Termination',
        paragraphs: [
          'SriDha Academy may suspend or restrict access where reasonably necessary to address security threats, fraudulent activity, unlawful conduct, or serious violations of these Terms.',
          'Where appropriate, users will receive notice and an opportunity to resolve the issue.',
          'Termination shall not automatically extinguish any refund, contractual, or statutory rights.',
        ],
      },
      {
        heading: '15. Amendments',
        paragraphs: [
          'SriDha Academy may revise these Terms to reflect changes in services, operational requirements, or applicable laws.',
          'Material changes will be communicated through the website or other appropriate channels. Updated Terms will identify their effective date.',
        ],
      },
      {
        heading: '16. Governing Law and Dispute Resolution',
        paragraphs: [
          'These Terms shall be governed by the laws of India.',
          'Subject to applicable consumer protection laws and mandatory jurisdictional provisions, disputes may be brought before competent courts in Jaipur, Rajasthan.',
          "Nothing in this clause restricts a consumer's right to approach a competent consumer commission or other statutory authority.",
        ],
      },
      {
        heading: '17. Contact and Grievance Redressal',
        paragraphs: [
          'For enquiries, complaints, or disputes relating to these Terms, contact:',
        ],
        items: [
          'SriDha Academy',
          'Website: https://sridhaacademy.com',
          'Legal Entity: LETATEC AI technologies Private Limited',
          'Registered Address: LG-32, Jaipur Electronics Market, Riddhi Siddhi Chowraha, Gopal Pura Bypass, Jaipur, Rajasthan -302019',
          'Support Email: superadmin@letatec.com',
          'Contact Number: + 91 9929397277',
          'Grievance Officer Email: leta.teams5@gmail.com',
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
      'Questions about a topic, a batch or a payment? Write to us and the SriDha Academy team will help.',
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
        heading: 'About your seat',
        paragraphs: [
          'Write from the email address you paid with, so we can find your seat. We never ask for card, UPI or bank details.',
        ],
      },
    ],
  },
};

export const POLICY_ROUTE: Record<PolicyKey, string> = {
  terms: APP_ROUTES.TERMS,
  contact: APP_ROUTES.CONTACT,
};

// Links to these pages, for the footers
export const POLICY_LINKS_TITLE = 'Help';

export const POLICY_LINKS = [
  { label: 'Contact us', to: APP_ROUTES.CONTACT },
  { label: 'Terms and conditions', to: APP_ROUTES.TERMS },
] as const;
