export type DemonstrationItem = {
  label: string;
  value: string;
};

export type JourneyStage = {
  id: string;
  stepNumber: string;
  cyclePhase:
    'Understand' | 'Learn' | 'Practise' | 'Assess' | 'Review' | 'Improve';
  navTitle: string;
  title: string;
  lead: string;
  cardBadge: string;
  cardTitle: string;
  items: readonly DemonstrationItem[];
  actionText: string;
  actionHref: string;
};

export const JOURNEY_STAGES: readonly JourneyStage[] = [
  {
    id: 'understand',
    stepNumber: '01',
    cyclePhase: 'Understand',
    navTitle: '1. Understand concept',
    title: 'Deconstruct the core theory',
    lead: 'Rather than memorizing a 600-page textbook whole, start with the specific statutory definitions, underlying principles, and ledger rules of one topic.',
    cardBadge: 'Foundation Stage',
    cardTitle: 'Concept Anatomy: Sacrificing Ratio & Revaluation',
    items: [
      {
        label: 'Fundamental Principle',
        value:
          'When an incoming partner joins, existing partners surrender a fraction of their future profits. Sacrificing partners must be compensated via premium for goodwill.',
      },
      {
        label: 'Core Formula',
        value: 'Sacrificing Ratio = Old Profit Share − New Profit Share',
      },
      {
        label: 'Key Distinction',
        value:
          'Sacrificing ratio is used exclusively to distribute goodwill premium, while new profit ratio governs all future profit distributions.',
      },
    ],
    actionText: 'Explore Topics',
    actionHref: '#topics',
  },
  {
    id: 'learn',
    stepNumber: '02',
    cyclePhase: 'Learn',
    navTitle: '2. Topic-wise session',
    title: 'Attend the topic-wise session',
    lead: 'Join focused online batches dedicated exclusively to this single topic. With batches capped at 100 students, learners clear doubts directly with the teacher.',
    cardBadge: 'Live Online Cohort',
    cardTitle: 'Topic Batch Structure: 2 Intensive Sessions',
    items: [
      {
        label: 'Session 01 · Concept Rules',
        value:
          'Structured walkthrough of ledger mechanics, journal entries, and revaluation principles with live whiteboard illustrations.',
      },
      {
        label: 'Session 02 · Adjustments',
        value:
          'Step-by-step problem walkthroughs covering comprehensive balance sheet adjustments and common examination traps.',
      },
      {
        label: 'Tutor Interaction',
        value:
          'Strict cap of 100 students per batch ensures direct question-and-answer clearance during live teaching.',
      },
    ],
    actionText: 'View Open Batches',
    actionHref: '#topics',
  },
  {
    id: 'practise',
    stepNumber: '03',
    cyclePhase: 'Practise',
    navTitle: '3. Practise immediately',
    lead: 'Solve targeted numerical problems right after the session to lock in principles before misconceptions can take root.',
    title: 'Practise immediately after class',
    cardBadge: 'Targeted Problem Sets',
    cardTitle: 'Guided Practice: Revaluation Account Entries',
    items: [
      {
        label: 'Representative Problem',
        value:
          'Unrecorded investment worth ₹15,000 discovered upon partner admission. Prepare the revaluation adjustment entry.',
      },
      {
        label: 'Correct Entry',
        value:
          'Dr. Unrecorded Investments A/c ₹15,000 | Cr. Revaluation A/c ₹15,000 (Gain on asset recognition).',
      },
      {
        label: 'Capital Ledger Impact',
        value:
          'Net revaluation surplus transferred to old partners’ capital accounts in their old profit sharing ratio.',
      },
    ],
    actionText: 'Browse Practice Batches',
    actionHref: '#topics',
  },
  {
    id: 'assess',
    stepNumber: '04',
    cyclePhase: 'Assess',
    navTitle: '4. Topic assessment',
    title: 'Take a topic-wise assessment',
    lead: 'Every student receives an independently generated test paper drawn from topic material so rote memorization cannot substitute for genuine understanding.',
    cardBadge: 'In-House AI Test Engine',
    cardTitle: 'Representative Assessment Workflow',
    items: [
      {
        label: 'Dynamic Papers',
        value:
          'Algorithmic paper generation from verified subject blueprints ensures distinct question variations across student cohorts.',
      },
      {
        label: 'Timed Discipline',
        value:
          'Active countdown clock trains pace and exam temperament under realistic conditions.',
      },
      {
        label: 'Diagnostic Feedback',
        value:
          'Immediate question marking, step explanations, and performance percentile upon submission.',
      },
    ],
    actionText: 'Try Live Sample Assessment',
    actionHref: '#ai-test',
  },
  {
    id: 'review',
    stepNumber: '05',
    cyclePhase: 'Review',
    navTitle: '5. Past & model papers',
    title: 'Practise with verified papers & model papers',
    lead: 'Test examination readiness against verified past-year board questions (CBSE & ISC) and teacher-reviewed predictive AI model papers.',
    cardBadge: 'Authentic Archives vs Predictive Papers',
    cardTitle: 'Dual Preparation Architecture',
    items: [
      {
        label: 'Verified PYQs',
        value:
          'Actual board examination questions from the past five years indexed topic-by-topic with official step-marking criteria.',
      },
      {
        label: 'AI Model Papers',
        value:
          'Synthesised from 5-year pattern analysis and textbook weightage, vetted by senior faculty, and released 7 days before exams.',
      },
      {
        label: 'Honest Distinction',
        value:
          'PYQs represent historical truth. AI model papers represent teacher-reviewed forecasts. Neither is fabricated.',
      },
    ],
    actionText: 'Explore Model Papers',
    actionHref: '#model-paper',
  },
  {
    id: 'improve',
    stepNumber: '06',
    cyclePhase: 'Improve',
    navTitle: '6. Review mistakes',
    title: 'Review mistakes & strengthen understanding',
    lead: 'Pinpoint exactly which conceptual rule caused an error, examine step-marking rationale, and complete targeted re-practice before the next chapter.',
    cardBadge: 'Remediation Loop',
    cardTitle: 'Targeted Error Remediation Cycle',
    items: [
      {
        label: 'Error Diagnostic',
        value:
          'Flagged issue: Revaluation profit was credited in the new profit sharing ratio instead of the old ratio.',
      },
      {
        label: 'Conceptual Rule',
        value:
          'Revaluation profit accrued on existing assets belongs exclusively to existing partners in their old sharing ratio.',
      },
      {
        label: 'Recommended Remediation',
        value:
          'Complete 3 targeted revaluation problem sets before moving forward to Partner Retirement.',
      },
    ],
    actionText: 'Begin Your First Topic',
    actionHref: '#topics',
  },
] as const;
