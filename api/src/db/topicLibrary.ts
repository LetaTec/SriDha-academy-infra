// Every topic on the website: the topics on the team's roster
// (sessionOneRoster.ts), whose batches are the only classes, and the topics
// that have a topic test (web/src/constants/topicTestPapers.ts), which have
// no batches. This list is the only copy: the seed writes it to the
// database and the website reads it from GET /api/catalogue. Add a topic
// here when the roster adds one, then run `npm run db:seed` against each
// database.

export type LibrarySubject =
  | 'accountancy'
  | 'businessStudies'
  | 'economics'
  | 'physics'
  | 'chemistry'
  | 'mathematics'
  | 'biology';

export type LibraryTopic = {
  id: string;
  subject: LibrarySubject;
  level: string;
  // The name on topic cards, e.g. "GST"; the catalogue title is the
  // longer "Learn GST for Class 11"
  title: string;
  lessons: readonly string[];
  // A name from the website's icon set; topics without one use their
  // subject's icon
  icon?: string;
  // Featured topics lead every short list (the homepage shows eight, the
  // sign-in page four, the footer six), in this order. Only topics with
  // live roster batches are featured, soonest first.
  featuredRank?: number;
};

export const TOPIC_LIBRARY: readonly LibraryTopic[] = [
  {
    id: 'topic_mathematics_alphabet_test_class_8',
    subject: 'mathematics',
    level: 'Class 8',
    title: 'Alphabet test',
    lessons: [
      'Alphabetical order',
      'Letter positions',
      'Letter series',
      'Forming words from letters',
    ],
    featuredRank: 2,
  },
  {
    id: 'topic_mathematics_coding_and_decoding_class_8',
    subject: 'mathematics',
    level: 'Class 8',
    title: 'Coding and decoding',
    lessons: [
      'Letter coding',
      'Number coding',
      'Substitution coding',
      'Mixed coding',
    ],
  },
  {
    id: 'topic_accountancy_rectification_of_errors_class_11',
    subject: 'accountancy',
    level: 'Class 11',
    title: 'Rectification of errors',
    lessons: [
      'Types of errors',
      'Errors that affect the trial balance',
      'Suspense account',
      'Rectifying errors before and after',
    ],
    featuredRank: 7,
  },
  {
    id: 'topic_accountancy_bank_reconciliation_statement_class_11',
    subject: 'accountancy',
    level: 'Class 11',
    title: 'Bank reconciliation statement',
    lessons: [
      'Why the cash book and passbook differ',
      'Cheques not yet presented or cleared',
      'Preparing a BRS',
      'Overdraft balances',
    ],
  },
  {
    id: 'topic_mathematics_time_and_work_ca_cpt',
    subject: 'mathematics',
    level: 'CA-CPT',
    title: 'Time and work',
    lessons: [
      'Work and efficiency',
      'Working together',
      'Pipes and cisterns',
      'Wages for shared work',
    ],
    featuredRank: 5,
  },
  {
    id: 'topic_mathematics_quadratic_equations_class_10',
    subject: 'mathematics',
    level: 'Class 10',
    title: 'Quadratic equations',
    lessons: [
      'Standard form',
      'Solving by factorisation',
      'The quadratic formula',
      'Nature of roots',
    ],
  },
  {
    id: 'topic_mathematics_polynomials_class_9',
    subject: 'mathematics',
    level: 'Class 9',
    title: 'Polynomials',
    lessons: [
      'Polynomials and their degree',
      'Zeroes of a polynomial',
      'Remainder and factor theorems',
      'Algebraic identities',
    ],
  },
  {
    id: 'topic_mathematics_sets_class_11',
    subject: 'mathematics',
    level: 'Class 11',
    title: 'Sets',
    lessons: [
      'Types of sets',
      'Venn diagrams',
      'Operations on sets',
      'Complement of a set',
    ],
  },
  {
    id: 'topic_economics_demand_class_11',
    subject: 'economics',
    level: 'Class 11',
    title: 'Demand',
    lessons: [
      'The law of demand',
      'Determinants of demand',
      'Movement along and shifts of the curve',
      'Price elasticity of demand',
    ],
    featuredRank: 8,
  },
  {
    id: 'topic_economics_production_class_11',
    subject: 'economics',
    level: 'Class 11',
    title: 'Production',
    lessons: [
      'The production function',
      'Total, average and marginal product',
      'The law of variable proportions',
      'Returns to scale',
    ],
  },
  {
    id: 'topic_economics_market_class_11',
    subject: 'economics',
    level: 'Class 11',
    title: 'Market',
    lessons: [
      'Forms of market',
      'Perfect competition',
      'Price determination',
      'Shifts in demand and supply',
    ],
  },
  {
    id: 'topic_mathematics_logarithms_ca_cpt',
    subject: 'mathematics',
    level: 'CA-CPT',
    title: 'Logarithms',
    lessons: [
      'Laws of logarithms',
      'Change of base',
      'Antilogarithms',
      'Solving logarithmic equations',
    ],
    featuredRank: 3,
  },
  {
    id: 'topic_mathematics_trigonometry_class_10',
    subject: 'mathematics',
    level: 'Class 10',
    title: 'Trigonometry',
    lessons: [
      'Trigonometric ratios',
      'Ratios of standard angles',
      'Trigonometric identities',
      'Heights and distances',
    ],
    featuredRank: 4,
  },
  {
    id: 'topic_economics_business_cycles_ca_cpt',
    subject: 'economics',
    level: 'CA-CPT',
    title: 'Business cycles',
    lessons: [
      'Phases of a business cycle',
      'Features of business cycles',
      'Causes of business cycles',
      'Indicators of the cycle',
    ],
    featuredRank: 1,
  },
  {
    id: 'topic_economics_balance_of_payments_class_12',
    subject: 'economics',
    level: 'Class 12',
    title: 'Balance of payments',
    lessons: [
      'Current account',
      'Capital account',
      'Foreign exchange rate',
      'Fixed and flexible rates',
    ],
    featuredRank: 6,
  },
  {
    id: 'topic_accountancy_admission_of_a_partner_class_12',
    subject: 'accountancy',
    level: 'Class 12',
    title: 'Admission of a partner',
    lessons: [
      'New profit-sharing ratio',
      'Sacrificing ratio',
      'Goodwill on admission',
      'Revaluation and capital adjustment',
    ],
  },
  {
    id: 'topic_accounts_gst_class_11',
    subject: 'accountancy',
    level: 'Class 11',
    title: 'GST',
    lessons: [
      'What is GST',
      'GST entries',
      'Input tax credit',
      'Journal entries of GST',
    ],
    icon: 'topicGst',
  },
  {
    id: 'topic_chemistry_bonding_class_11',
    subject: 'chemistry',
    level: 'Class 11',
    title: 'Chemical bonding',
    lessons: [
      'Ionic and covalent bonds',
      'VSEPR theory and molecular shapes',
      'Hybridisation',
      'Molecular orbital theory',
    ],
    icon: 'topicBonding',
  },
  {
    id: 'topic_physics_ray_optics_class_12',
    subject: 'physics',
    level: 'Class 12',
    title: 'Ray optics',
    lessons: [
      'Reflection by spherical mirrors',
      'Refraction and lenses',
      'Total internal reflection',
      'Microscopes and telescopes',
    ],
    icon: 'topicOptics',
  },
  {
    id: 'topic_maths_integrals_class_12',
    subject: 'mathematics',
    level: 'Class 12',
    title: 'Integrals',
    lessons: [
      'Indefinite integrals',
      'Integration by parts',
      'Definite integrals',
      'Area under curves',
    ],
    icon: 'topicIntegrals',
  },
  {
    id: 'topic_chemistry_mole_concept_class_11',
    subject: 'chemistry',
    level: 'Class 11',
    title: 'Mole concept',
    lessons: [
      'Mole and molar mass',
      'Empirical and molecular formula',
      'Stoichiometry',
      'Limiting reagent',
    ],
    icon: 'topicMole',
  },
  {
    id: 'topic_physics_current_electricity_class_12',
    subject: 'physics',
    level: 'Class 12',
    title: 'Current electricity',
    lessons: [
      "Ohm's law and resistivity",
      'Cells, EMF and internal resistance',
      "Kirchhoff's laws",
      'Wheatstone bridge',
    ],
    icon: 'topicCurrent',
  },
  {
    id: 'topic_physics_laws_of_motion_class_11',
    subject: 'physics',
    level: 'Class 11',
    title: 'Laws of motion',
    lessons: [
      "Newton's three laws",
      'Conservation of momentum',
      'Friction',
      'Circular motion',
    ],
    icon: 'topicMotion',
  },
  {
    id: 'topic_accounts_partnership_class_12',
    subject: 'accountancy',
    level: 'Class 12',
    title: 'Partnership accounts',
    lessons: [
      'Fundamentals of partnership',
      'Valuation of goodwill',
      'Admission of a partner',
      'Retirement and death of a partner',
    ],
    icon: 'topicPartnership',
  },
];
