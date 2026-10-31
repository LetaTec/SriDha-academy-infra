import { formatClassLevel } from '@utils/classLevel';

import type { IconName } from './icons';

// The topics SriDha Academy teaches, across classes and subjects. A topic
// shows as open once its catalogue topic has published batches.

export const SUBJECT = {
  accountancy: 'accountancy',
  businessStudies: 'businessStudies',
  economics: 'economics',
  physics: 'physics',
  chemistry: 'chemistry',
  mathematics: 'mathematics',
  biology: 'biology',
} as const;

export type SubjectKey = (typeof SUBJECT)[keyof typeof SUBJECT];

export const SUBJECT_LABEL: Record<SubjectKey, string> = {
  accountancy: 'Accountancy',
  businessStudies: 'Business Studies',
  economics: 'Economics',
  physics: 'Physics',
  chemistry: 'Chemistry',
  mathematics: 'Mathematics',
  biology: 'Biology',
};

// Extra words students search with, beyond the subject's label
export const SUBJECT_KEYWORDS: Record<SubjectKey, readonly string[]> = {
  accountancy: ['Accounts', 'Commerce'],
  businessStudies: ['Business', 'BST', 'Commerce'],
  economics: ['Eco', 'Commerce'],
  physics: ['Science'],
  chemistry: ['Science'],
  mathematics: ['Maths', 'Math'],
  biology: ['Bio', 'Science'],
};

export const SUBJECT_ICON: Record<SubjectKey, IconName> = {
  accountancy: 'subjectAccountancy',
  businessStudies: 'subjectBusiness',
  economics: 'subjectEconomics',
  physics: 'subjectPhysics',
  chemistry: 'subjectChemistry',
  mathematics: 'subjectMathematics',
  biology: 'subjectBiology',
};

export const STREAM = {
  commerce: 'commerce',
  science: 'science',
} as const;

export type StreamKey = (typeof STREAM)[keyof typeof STREAM];

export const STREAM_LABEL: Record<StreamKey, string> = {
  commerce: 'Commerce',
  science: 'Science',
};

// Mathematics is taught in both streams
export const SUBJECT_STREAMS: Record<SubjectKey, readonly StreamKey[]> = {
  accountancy: [STREAM.commerce],
  businessStudies: [STREAM.commerce],
  economics: [STREAM.commerce],
  physics: [STREAM.science],
  chemistry: [STREAM.science],
  mathematics: [STREAM.commerce, STREAM.science],
  biology: [STREAM.science],
};

export type TopicPreview = {
  title: string;
  level: string;
  subject: SubjectKey;
  icon: IconName;
  // What the topic's batches teach, shown on the card's hover overlay
  subtopics: readonly string[];
  // The catalogue topic behind this preview, which holds its price and
  // batches. The API seed is generated from this list (npm run topics:export).
  catalogueTopicId: string;
};

type TopicExtras = Partial<Pick<TopicPreview, 'icon' | 'catalogueTopicId'>>;

const toSlug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

// e.g. topic_physics_wave_optics_class_12
const toCatalogueTopicId = (
  subject: SubjectKey,
  classNumber: number,
  title: string,
) =>
  `topic_${toSlug(SUBJECT_LABEL[subject])}_${toSlug(title)}_class_${classNumber}`;

const topic = (
  subject: SubjectKey,
  classNumber: 11 | 12,
  title: string,
  subtopics: readonly string[],
  { icon, catalogueTopicId }: TopicExtras = {},
): TopicPreview => ({
  title,
  level: formatClassLevel(classNumber),
  subject,
  icon: icon ?? SUBJECT_ICON[subject],
  subtopics,
  catalogueTopicId:
    catalogueTopicId ?? toCatalogueTopicId(subject, classNumber, title),
});

const { accountancy, businessStudies, economics, physics, chemistry } = SUBJECT;
const { mathematics, biology } = SUBJECT;

// The topics with batches come first: the sign-in page shows the first four
// and the homepage the first eight.
const FEATURED_TOPICS: readonly TopicPreview[] = [
  topic(
    accountancy,
    11,
    'GST',
    [
      'What is GST',
      'GST entries',
      'Input tax credit',
      'Journal entries of GST',
    ],
    { icon: 'topicGst', catalogueTopicId: 'topic_accounts_gst_class_11' },
  ),
  topic(
    chemistry,
    11,
    'Chemical bonding',
    [
      'Ionic and covalent bonds',
      'VSEPR theory and molecular shapes',
      'Hybridisation',
      'Molecular orbital theory',
    ],
    {
      icon: 'topicBonding',
      catalogueTopicId: 'topic_chemistry_bonding_class_11',
    },
  ),
  topic(
    physics,
    12,
    'Ray optics',
    [
      'Reflection by spherical mirrors',
      'Refraction and lenses',
      'Total internal reflection',
      'Microscopes and telescopes',
    ],
    {
      icon: 'topicOptics',
      catalogueTopicId: 'topic_physics_ray_optics_class_12',
    },
  ),
  topic(
    mathematics,
    12,
    'Integrals',
    [
      'Indefinite integrals',
      'Integration by parts',
      'Definite integrals',
      'Area under curves',
    ],
    {
      icon: 'topicIntegrals',
      catalogueTopicId: 'topic_maths_integrals_class_12',
    },
  ),
  topic(
    chemistry,
    11,
    'Mole concept',
    [
      'Mole and molar mass',
      'Empirical and molecular formula',
      'Stoichiometry',
      'Limiting reagent',
    ],
    {
      icon: 'topicMole',
      catalogueTopicId: 'topic_chemistry_mole_concept_class_11',
    },
  ),
  topic(
    physics,
    12,
    'Current electricity',
    [
      "Ohm's law and resistivity",
      'Cells, EMF and internal resistance',
      "Kirchhoff's laws",
      'Wheatstone bridge',
    ],
    {
      icon: 'topicCurrent',
      catalogueTopicId: 'topic_physics_current_electricity_class_12',
    },
  ),
  topic(
    physics,
    11,
    'Laws of motion',
    [
      "Newton's three laws",
      'Conservation of momentum',
      'Friction',
      'Circular motion',
    ],
    {
      icon: 'topicMotion',
      catalogueTopicId: 'topic_physics_laws_of_motion_class_11',
    },
  ),
  topic(
    accountancy,
    12,
    'Partnership accounts',
    [
      'Fundamentals of partnership',
      'Valuation of goodwill',
      'Admission of a partner',
      'Retirement and death of a partner',
    ],
    {
      icon: 'topicPartnership',
      catalogueTopicId: 'topic_accounts_partnership_class_12',
    },
  ),
];

const ACCOUNTANCY_TOPICS: readonly TopicPreview[] = [
  topic(accountancy, 11, 'Introduction to accounting', [
    'Meaning and objectives of accounting',
    'Users of accounting information',
    'Basic accounting terms',
    'Qualitative characteristics',
  ]),
  topic(accountancy, 11, 'Theory base of accounting', [
    'Accounting concepts',
    'Accounting conventions',
    'Accounting standards',
    'Bases of accounting',
  ]),
  topic(accountancy, 11, 'Accounting equation', [
    'Assets, liabilities and capital',
    'Effect of transactions',
    'Preparing the equation',
    'Rules of debit and credit',
  ]),
  topic(accountancy, 11, 'Journal and ledger', [
    'Source documents and vouchers',
    'Journalising transactions',
    'Posting to the ledger',
    'Balancing accounts',
  ]),
  topic(accountancy, 11, 'Special purpose books', [
    'Cash book',
    'Purchases and sales books',
    'Returns books',
    'Journal proper',
  ]),
  topic(accountancy, 11, 'Bank reconciliation statement', [
    'Why the cash book and passbook differ',
    'Cheques not yet presented or cleared',
    'Preparing a BRS',
    'Overdraft balances',
  ]),
  topic(accountancy, 11, 'Trial balance', [
    'Meaning and objectives',
    'Preparing it from ledger balances',
    'Totals and balances methods',
    'Locating errors when it does not agree',
  ]),
  topic(accountancy, 11, 'Rectification of errors', [
    'Types of errors',
    'Errors that affect the trial balance',
    'Suspense account',
    'Rectifying errors before and after',
  ]),
  topic(accountancy, 11, 'Depreciation', [
    'Meaning and causes',
    'Straight line method',
    'Written down value method',
    'Disposal of assets',
  ]),
  topic(accountancy, 11, 'Provisions and reserves', [
    'Provisions and reserves compared',
    'Types of reserves',
    'Secret reserves',
    'Creating provisions',
  ]),
  topic(accountancy, 11, 'Bills of exchange', [
    'Bills and promissory notes',
    'Dishonour of a bill',
    'Renewal of a bill',
    'Retiring a bill',
  ]),
  topic(accountancy, 11, 'Financial statements', [
    'Trading account',
    'Profit and loss account',
    'Balance sheet',
    'Adjustments',
  ]),
  topic(accountancy, 11, 'Incomplete records', [
    'Statement of affairs',
    'Profit by capital comparison',
    'Converting to double entry',
    'Finding missing figures',
  ]),
  topic(accountancy, 12, 'Goodwill', [
    'Nature and factors',
    'Average profit method',
    'Super profit method',
    'Capitalisation method',
  ]),
  topic(accountancy, 12, 'Dissolution of a partnership firm', [
    'Modes of dissolution',
    'Realisation account',
    'Settlement of accounts',
    'Loss on realisation',
  ]),
  topic(accountancy, 12, 'Accounting for share capital', [
    'Kinds of shares',
    'Issue of shares',
    'Forfeiture of shares',
    'Reissue of forfeited shares',
  ]),
  topic(accountancy, 12, 'Issue of debentures', [
    'Types of debentures',
    'Issue at par, premium and discount',
    'Debentures as collateral',
    'Interest on debentures',
  ]),
  topic(accountancy, 12, 'Financial statements of a company', [
    'Form of balance sheet',
    'Statement of profit and loss',
    'Notes to accounts',
    'Schedule III',
  ]),
  topic(accountancy, 12, 'Analysis of financial statements', [
    'Comparative statements',
    'Common size statements',
    'Tools of analysis',
    'Limitations of analysis',
  ]),
  topic(accountancy, 12, 'Accounting ratios', [
    'Liquidity ratios',
    'Solvency ratios',
    'Activity ratios',
    'Profitability ratios',
  ]),
  topic(accountancy, 12, 'Cash flow statement', [
    'Operating activities',
    'Investing activities',
    'Financing activities',
    'Indirect method',
  ]),
  topic(accountancy, 12, 'Not-for-profit organisations', [
    'Receipts and payments account',
    'Income and expenditure account',
    'Balance sheet',
    'Subscriptions and special funds',
  ]),
];

const BUSINESS_STUDIES_TOPICS: readonly TopicPreview[] = [
  topic(businessStudies, 11, 'Nature and purpose of business', [
    'Concept and characteristics',
    'Business, profession and employment',
    'Objectives of business',
    'Business risks',
  ]),
  topic(businessStudies, 11, 'Forms of business organisation', [
    'Sole proprietorship',
    'Partnership',
    'Cooperative society',
    'Joint stock company',
  ]),
  topic(businessStudies, 11, 'Public, private and global enterprises', [
    'Private and public sectors',
    'Departmental undertakings',
    'Statutory corporations',
    'Global enterprises and joint ventures',
  ]),
  topic(businessStudies, 11, 'Business services', [
    'Banking',
    'Insurance',
    'Communication services',
    'Warehousing',
  ]),
  topic(businessStudies, 11, 'Emerging modes of business', [
    'E-business',
    'Online transactions',
    'Security and safety',
    'Outsourcing',
  ]),
  topic(businessStudies, 11, 'Social responsibility of business', [
    'Concept of social responsibility',
    'Responsibility to stakeholders',
    'Business ethics',
    'Environment protection',
  ]),
  topic(businessStudies, 11, 'Sources of business finance', [
    "Owners' funds and borrowed funds",
    'Shares and debentures',
    'Loans from banks',
    'International sources',
  ]),
  topic(businessStudies, 11, 'Small business and entrepreneurship', [
    'Role of small business',
    'Problems of small business',
    'Government assistance',
    'Entrepreneurship development',
  ]),
  topic(businessStudies, 11, 'Internal trade', [
    'Wholesale trade',
    'Retail trade',
    'Types of retailers',
    'GST and internal trade',
  ]),
  topic(businessStudies, 11, 'International business', [
    'Modes of entry',
    'Exports and imports',
    'Export procedure',
    'World Trade Organisation',
  ]),
  topic(businessStudies, 12, 'Nature and significance of management', [
    'Concept and objectives',
    'Management as science, art and profession',
    'Levels of management',
    'Coordination',
  ]),
  topic(businessStudies, 12, 'Principles of management', [
    'Nature of principles',
    "Fayol's principles",
    "Taylor's scientific management",
    'Techniques of scientific management',
  ]),
  topic(businessStudies, 12, 'Business environment', [
    'Dimensions of the environment',
    'Economic environment in India',
    'Liberalisation',
    'Impact of government policy',
  ]),
  topic(businessStudies, 12, 'Planning', [
    'Features of planning',
    'Planning process',
    'Types of plans',
    'Limitations of planning',
  ]),
  topic(businessStudies, 12, 'Organising', [
    'Organising process',
    'Functional and divisional structures',
    'Formal and informal organisation',
    'Delegation and decentralisation',
  ]),
  topic(businessStudies, 12, 'Staffing', [
    'Staffing process',
    'Recruitment',
    'Selection',
    'Training and development',
  ]),
  topic(businessStudies, 12, 'Directing', [
    'Supervision',
    'Motivation',
    'Leadership',
    'Communication',
  ]),
  topic(businessStudies, 12, 'Controlling', [
    'Controlling process',
    'Relation with planning',
    'Techniques of control',
    'Management by exception',
  ]),
  topic(businessStudies, 12, 'Financial management', [
    'Financial decisions',
    'Financial planning',
    'Capital structure',
    'Working capital',
  ]),
  topic(businessStudies, 12, 'Financial markets', [
    'Money market',
    'Capital market',
    'Stock exchange',
    'SEBI',
  ]),
  topic(businessStudies, 12, 'Marketing management', [
    'Marketing mix',
    'Product and branding',
    'Pricing',
    'Promotion and distribution',
  ]),
  topic(businessStudies, 12, 'Consumer protection', [
    'Consumer rights',
    'Consumer responsibilities',
    'Consumer Protection Act 2019',
    'Redressal agencies',
  ]),
];

const ECONOMICS_TOPICS: readonly TopicPreview[] = [
  topic(economics, 11, 'Collection of data', [
    'Primary and secondary data',
    'Census and sample surveys',
    'Sampling methods',
    'Sampling errors',
  ]),
  topic(economics, 11, 'Organisation and presentation of data', [
    'Classification of data',
    'Frequency distribution',
    'Tables',
    'Diagrams and graphs',
  ]),
  topic(economics, 11, 'Measures of central tendency', [
    'Arithmetic mean',
    'Median',
    'Mode',
    'Choosing the right measure',
  ]),
  topic(economics, 11, 'Correlation', [
    'Scatter diagrams',
    "Karl Pearson's coefficient",
    "Spearman's rank correlation",
    'Interpreting correlation',
  ]),
  topic(economics, 11, 'Index numbers', [
    'Constructing an index',
    'Consumer price index',
    'Wholesale price index',
    'Uses of index numbers',
  ]),
  topic(economics, 11, 'Indian economy 1950–1990', [
    'Five year plans',
    'Agriculture and land reforms',
    'Industrial policy',
    'Trade policy',
  ]),
  topic(economics, 11, 'Liberalisation, privatisation and globalisation', [
    'The 1991 reforms',
    'Liberalisation',
    'Privatisation',
    'Globalisation and the WTO',
  ]),
  topic(economics, 11, 'Human capital formation', [
    'Sources of human capital',
    'Education in India',
    'Health',
    'On-the-job training',
  ]),
  topic(economics, 11, 'Rural development', [
    'Rural credit',
    'Agricultural marketing',
    'Diversification',
    'Organic farming',
  ]),
  topic(economics, 11, 'Employment', [
    'Workers and employment',
    'Formal and informal sectors',
    'Unemployment',
    'Jobless growth',
  ]),
  topic(economics, 12, 'Theory of consumer behaviour', [
    'Utility',
    'Indifference curves',
    'Budget line',
    'Consumer equilibrium',
  ]),
  topic(economics, 12, 'Production and costs', [
    'Production function',
    'Returns to a factor',
    'Short run costs',
    'Long run costs',
  ]),
  topic(economics, 12, 'Perfect competition', [
    'Features of perfect competition',
    'Profit maximisation',
    'Supply curve of a firm',
    'Market equilibrium',
  ]),
  topic(economics, 12, 'National income accounting', [
    'Circular flow of income',
    'Methods of measuring national income',
    'GDP and welfare',
    'Real and nominal GDP',
  ]),
  topic(economics, 12, 'Money and banking', [
    'Functions of money',
    'Money supply',
    'Credit creation',
    'Role of the RBI',
  ]),
  topic(economics, 12, 'Income determination', [
    'Aggregate demand and supply',
    'Consumption function',
    'Investment multiplier',
    'Excess and deficient demand',
  ]),
  topic(economics, 12, 'Government budget', [
    'Components of the budget',
    'Revenue and capital receipts',
    'Budget deficits',
    'Fiscal policy',
  ]),
  topic(economics, 12, 'Balance of payments', [
    'Current account',
    'Capital account',
    'Foreign exchange rate',
    'Fixed and flexible rates',
  ]),
];

const PHYSICS_TOPICS: readonly TopicPreview[] = [
  topic(physics, 11, 'Units and measurements', [
    'SI units',
    'Significant figures',
    'Dimensional analysis',
    'Errors in measurement',
  ]),
  topic(physics, 11, 'Motion in a straight line', [
    'Position and displacement',
    'Velocity and acceleration',
    'Equations of motion',
    'Relative velocity',
  ]),
  topic(physics, 11, 'Motion in a plane', [
    'Vectors',
    'Projectile motion',
    'Uniform circular motion',
    'Relative velocity in two dimensions',
  ]),
  topic(physics, 11, 'Work, energy and power', [
    'Work-energy theorem',
    'Potential energy',
    'Conservation of energy',
    'Collisions',
  ]),
  topic(physics, 11, 'Rotational motion', [
    'Centre of mass',
    'Torque and angular momentum',
    'Moment of inertia',
    'Rolling motion',
  ]),
  topic(physics, 11, 'Gravitation', [
    'Universal law of gravitation',
    'Acceleration due to gravity',
    'Gravitational potential energy',
    'Escape speed and satellites',
  ]),
  topic(physics, 11, 'Mechanical properties of solids', [
    'Stress and strain',
    "Hooke's law",
    'Elastic moduli',
    'Applications of elasticity',
  ]),
  topic(physics, 11, 'Mechanical properties of fluids', [
    'Pressure',
    "Pascal's law",
    "Bernoulli's principle",
    'Viscosity and surface tension',
  ]),
  topic(physics, 11, 'Thermal properties of matter', [
    'Temperature and heat',
    'Thermal expansion',
    'Specific heat capacity',
    'Heat transfer',
  ]),
  topic(physics, 11, 'Thermodynamics', [
    'Zeroth and first laws',
    'Thermodynamic processes',
    'Heat engines',
    'Second law',
  ]),
  topic(physics, 11, 'Kinetic theory', [
    'Behaviour of gases',
    'Kinetic theory of an ideal gas',
    'Law of equipartition',
    'Mean free path',
  ]),
  topic(physics, 11, 'Oscillations', [
    'Periodic motion',
    'Simple harmonic motion',
    'Energy in SHM',
    'Simple pendulum',
  ]),
  topic(physics, 11, 'Waves', [
    'Transverse and longitudinal waves',
    'Speed of a wave',
    'Superposition',
    'Standing waves and beats',
  ]),
  topic(physics, 12, 'Electric charges and fields', [
    "Coulomb's law",
    'Electric field',
    'Electric dipole',
    "Gauss's law",
  ]),
  topic(physics, 12, 'Electrostatic potential and capacitance', [
    'Electric potential',
    'Equipotential surfaces',
    'Capacitors',
    'Combining capacitors',
  ]),
  topic(physics, 12, 'Moving charges and magnetism', [
    'Magnetic force',
    'Biot-Savart law',
    "Ampere's circuital law",
    'Moving coil galvanometer',
  ]),
  topic(physics, 12, 'Magnetism and matter', [
    'Bar magnet',
    "Earth's magnetism",
    'Magnetisation',
    'Magnetic materials',
  ]),
  topic(physics, 12, 'Electromagnetic induction', [
    "Faraday's laws",
    "Lenz's law",
    'Motional EMF',
    'Inductance',
  ]),
  topic(physics, 12, 'Alternating current', [
    'AC voltage and current',
    'Reactance and impedance',
    'LCR circuits',
    'Transformers',
  ]),
  topic(physics, 12, 'Electromagnetic waves', [
    'Displacement current',
    'Nature of EM waves',
    'Electromagnetic spectrum',
    'Uses of EM waves',
  ]),
  topic(physics, 12, 'Wave optics', [
    "Huygens' principle",
    'Interference',
    "Young's double slit experiment",
    'Diffraction and polarisation',
  ]),
  topic(physics, 12, 'Dual nature of radiation and matter', [
    'Photoelectric effect',
    "Einstein's equation",
    'Matter waves',
    'Davisson-Germer experiment',
  ]),
  topic(physics, 12, 'Atoms', [
    "Rutherford's model",
    "Bohr's model",
    'Energy levels',
    'Hydrogen spectrum',
  ]),
  topic(physics, 12, 'Nuclei', [
    'Nuclear size and density',
    'Mass defect and binding energy',
    'Nuclear fission',
    'Nuclear fusion',
  ]),
  topic(physics, 12, 'Semiconductor electronics', [
    'Intrinsic and extrinsic semiconductors',
    'p-n junction',
    'Diode as a rectifier',
    'Special purpose diodes',
  ]),
];

const CHEMISTRY_TOPICS: readonly TopicPreview[] = [
  topic(chemistry, 11, 'Structure of atom', [
    'Atomic models',
    'Quantum numbers',
    'Orbitals',
    'Electronic configuration',
  ]),
  topic(chemistry, 11, 'Classification of elements and periodicity', [
    'Modern periodic law',
    's, p, d and f blocks',
    'Periodic trends',
    'Ionisation enthalpy',
  ]),
  topic(chemistry, 11, 'Chemical thermodynamics', [
    'Internal energy and enthalpy',
    "Hess's law",
    'Entropy',
    'Gibbs energy',
  ]),
  topic(chemistry, 11, 'Equilibrium', [
    'Law of mass action',
    "Le Chatelier's principle",
    'Ionic equilibrium',
    'pH and buffers',
  ]),
  topic(chemistry, 11, 'Redox reactions', [
    'Oxidation and reduction',
    'Oxidation number',
    'Balancing redox equations',
    'Redox and electrode processes',
  ]),
  topic(chemistry, 11, 'Organic chemistry basics', [
    'IUPAC nomenclature',
    'Isomerism',
    'Electronic effects',
    'Reaction intermediates',
  ]),
  topic(chemistry, 11, 'Hydrocarbons', [
    'Alkanes',
    'Alkenes',
    'Alkynes',
    'Aromatic hydrocarbons',
  ]),
  topic(chemistry, 12, 'Solutions', [
    'Concentration terms',
    "Raoult's law",
    'Colligative properties',
    'Abnormal molar mass',
  ]),
  topic(chemistry, 12, 'Electrochemistry', [
    'Electrochemical cells',
    'Nernst equation',
    'Conductance',
    'Batteries and corrosion',
  ]),
  topic(chemistry, 12, 'Chemical kinetics', [
    'Rate of reaction',
    'Order and molecularity',
    'Integrated rate equations',
    'Arrhenius equation',
  ]),
  topic(chemistry, 12, 'd- and f-block elements', [
    'Properties of transition elements',
    'Lanthanoids',
    'Actinoids',
    'Important compounds',
  ]),
  topic(chemistry, 12, 'Coordination compounds', [
    "Werner's theory",
    'Nomenclature',
    'Isomerism in complexes',
    'Bonding theories',
  ]),
  topic(chemistry, 12, 'Haloalkanes and haloarenes', [
    'Nomenclature',
    'SN1 and SN2 reactions',
    'Elimination reactions',
    'Uses and environmental effects',
  ]),
  topic(chemistry, 12, 'Alcohols, phenols and ethers', [
    'Preparation',
    'Physical properties',
    'Chemical reactions',
    'Uses',
  ]),
  topic(chemistry, 12, 'Aldehydes, ketones and carboxylic acids', [
    'Preparation',
    'Nucleophilic addition',
    'Named reactions',
    'Acidity of carboxylic acids',
  ]),
  topic(chemistry, 12, 'Amines', [
    'Classification',
    'Preparation',
    'Basic character',
    'Diazonium salts',
  ]),
  topic(chemistry, 12, 'Biomolecules', [
    'Carbohydrates',
    'Proteins',
    'Enzymes',
    'Nucleic acids',
  ]),
];

const MATHEMATICS_TOPICS: readonly TopicPreview[] = [
  topic(mathematics, 11, 'Sets', [
    'Types of sets',
    'Venn diagrams',
    'Operations on sets',
    'Complement of a set',
  ]),
  topic(mathematics, 11, 'Relations and functions', [
    'Cartesian product',
    'Relations',
    'Functions',
    'Graphs of functions',
  ]),
  topic(mathematics, 11, 'Trigonometric functions', [
    'Angles and radian measure',
    'Trigonometric ratios',
    'Compound angles',
    'Trigonometric equations',
  ]),
  topic(mathematics, 11, 'Complex numbers', [
    'Algebra of complex numbers',
    'Modulus and conjugate',
    'Argand plane',
    'Quadratic equations',
  ]),
  topic(mathematics, 11, 'Linear inequalities', [
    'Inequalities in one variable',
    'Graphical solutions',
    'Systems of inequalities',
    'Word problems',
  ]),
  topic(mathematics, 11, 'Permutations and combinations', [
    'Fundamental principle of counting',
    'Permutations',
    'Combinations',
    'Applications',
  ]),
  topic(mathematics, 11, 'Binomial theorem', [
    'Binomial expansion',
    'General term',
    'Middle term',
    "Pascal's triangle",
  ]),
  topic(mathematics, 11, 'Sequences and series', [
    'Arithmetic progression',
    'Geometric progression',
    'Relation between AM and GM',
    'Special series',
  ]),
  topic(mathematics, 11, 'Straight lines', [
    'Slope of a line',
    'Forms of a line',
    'Distance of a point from a line',
    'Angle between lines',
  ]),
  topic(mathematics, 11, 'Conic sections', [
    'Circle',
    'Parabola',
    'Ellipse',
    'Hyperbola',
  ]),
  topic(mathematics, 11, 'Limits and derivatives', [
    'Intuitive idea of limits',
    'Standard limits',
    'Derivatives from first principles',
    'Rules of differentiation',
  ]),
  topic(mathematics, 11, 'Probability', [
    'Random experiments',
    'Events',
    'Axiomatic probability',
    'Addition rule',
  ]),
  topic(mathematics, 12, 'Inverse trigonometric functions', [
    'Domains and ranges',
    'Principal values',
    'Graphs',
    'Properties',
  ]),
  topic(mathematics, 12, 'Matrices', [
    'Types of matrices',
    'Matrix operations',
    'Transpose',
    'Invertible matrices',
  ]),
  topic(mathematics, 12, 'Determinants', [
    'Properties of determinants',
    'Area of a triangle',
    'Adjoint and inverse',
    'Solving linear equations',
  ]),
  topic(mathematics, 12, 'Continuity and differentiability', [
    'Continuity',
    'Chain rule',
    'Implicit and logarithmic differentiation',
    'Second order derivatives',
  ]),
  topic(mathematics, 12, 'Applications of derivatives', [
    'Rate of change',
    'Increasing and decreasing functions',
    'Maxima and minima',
    'Approximations',
  ]),
  topic(mathematics, 12, 'Differential equations', [
    'Order and degree',
    'Variable separable method',
    'Homogeneous equations',
    'Linear differential equations',
  ]),
  topic(mathematics, 12, 'Vector algebra', [
    'Types of vectors',
    'Addition of vectors',
    'Dot product',
    'Cross product',
  ]),
  topic(mathematics, 12, 'Three-dimensional geometry', [
    'Direction cosines',
    'Equation of a line',
    'Angle between lines',
    'Shortest distance',
  ]),
  topic(mathematics, 12, 'Linear programming', [
    'Formulating problems',
    'Feasible region',
    'Graphical method',
    'Optimal solutions',
  ]),
  topic(mathematics, 12, 'Conditional probability', [
    'Conditional probability',
    'Multiplication theorem',
    "Bayes' theorem",
    'Random variables',
  ]),
];

const BIOLOGY_TOPICS: readonly TopicPreview[] = [
  topic(biology, 11, 'Cell: the unit of life', [
    'Cell theory',
    'Prokaryotic and eukaryotic cells',
    'Cell organelles',
    'Nucleus',
  ]),
  topic(biology, 11, 'Biomolecules in living cells', [
    'Carbohydrates and lipids',
    'Proteins',
    'Nucleic acids',
    'Enzymes',
  ]),
  topic(biology, 11, 'Cell cycle and cell division', [
    'Phases of the cell cycle',
    'Mitosis',
    'Meiosis',
    'Significance of division',
  ]),
  topic(biology, 11, 'Plant kingdom', [
    'Algae',
    'Bryophytes',
    'Pteridophytes',
    'Gymnosperms and angiosperms',
  ]),
  topic(biology, 11, 'Animal kingdom', [
    'Basis of classification',
    'Non-chordates',
    'Chordates',
    'Vertebrate classes',
  ]),
  topic(biology, 11, 'Morphology of flowering plants', [
    'Root, stem and leaf',
    'Inflorescence',
    'Flower',
    'Fruit and seed',
  ]),
  topic(biology, 11, 'Photosynthesis in higher plants', [
    'Light reactions',
    'Calvin cycle',
    'C4 pathway',
    'Photorespiration',
  ]),
  topic(biology, 11, 'Respiration in plants', [
    'Glycolysis',
    'Krebs cycle',
    'Electron transport',
    'Respiratory quotient',
  ]),
  topic(biology, 11, 'Breathing and exchange of gases', [
    'Respiratory organs',
    'Mechanism of breathing',
    'Transport of gases',
    'Respiratory disorders',
  ]),
  topic(biology, 11, 'Body fluids and circulation', [
    'Blood and lymph',
    'Human heart',
    'Cardiac cycle',
    'Disorders of circulation',
  ]),
  topic(biology, 11, 'Neural control and coordination', [
    'Neurons',
    'Nerve impulse',
    'Central nervous system',
    'Reflex action',
  ]),
  topic(biology, 12, 'Sexual reproduction in flowering plants', [
    'Flower structure',
    'Pollination',
    'Double fertilisation',
    'Seed and fruit',
  ]),
  topic(biology, 12, 'Human reproduction', [
    'Male reproductive system',
    'Female reproductive system',
    'Gametogenesis',
    'Menstrual cycle',
  ]),
  topic(biology, 12, 'Principles of inheritance and variation', [
    "Mendel's laws",
    'Incomplete dominance',
    'Sex determination',
    'Genetic disorders',
  ]),
  topic(biology, 12, 'Molecular basis of inheritance', [
    'DNA structure',
    'Replication',
    'Transcription and translation',
    'Human genome project',
  ]),
  topic(biology, 12, 'Evolution', [
    'Origin of life',
    'Evidence for evolution',
    'Natural selection',
    'Human evolution',
  ]),
  topic(biology, 12, 'Human health and disease', [
    'Common diseases',
    'Immunity',
    'AIDS and cancer',
    'Drug and alcohol abuse',
  ]),
  topic(biology, 12, 'Microbes in human welfare', [
    'Household products',
    'Industrial products',
    'Sewage treatment',
    'Biofertilisers',
  ]),
  topic(biology, 12, 'Biotechnology: principles and processes', [
    'Genetic engineering',
    'Tools of recombinant DNA',
    'Cloning vectors',
    'Bioreactors',
  ]),
  topic(biology, 12, 'Organisms and populations', [
    'Population attributes',
    'Population growth',
    'Population interactions',
    'Adaptations',
  ]),
  topic(biology, 12, 'Ecosystem', [
    'Structure and function',
    'Productivity',
    'Energy flow',
    'Ecological pyramids',
  ]),
  topic(biology, 12, 'Biodiversity and conservation', [
    'Patterns of biodiversity',
    'Loss of biodiversity',
    'In-situ conservation',
    'Ex-situ conservation',
  ]),
];

export const TOPIC_PREVIEWS: readonly TopicPreview[] = [
  ...FEATURED_TOPICS,
  ...ACCOUNTANCY_TOPICS,
  ...BUSINESS_STUDIES_TOPICS,
  ...ECONOMICS_TOPICS,
  ...PHYSICS_TOPICS,
  ...CHEMISTRY_TOPICS,
  ...MATHEMATICS_TOPICS,
  ...BIOLOGY_TOPICS,
];

// Topics with published batches, shown as "Topics ready"
export const READY_TOPIC_COUNT = String(
  TOPIC_PREVIEWS.filter(preview => preview.catalogueTopicId).length,
).padStart(2, '0');

// How many topics each surface shows before linking to the Topics page
export const SIGN_IN_TOPIC_COUNT = 4;
export const HOME_TOPIC_COUNT = 8;
export const FOOTER_TOPIC_COUNT = 6;

// Availability of a topic's batches, used by the Topics page filter
export const TOPIC_AVAILABILITY = {
  open: 'open',
  soon: 'soon',
} as const;

export type TopicAvailability =
  (typeof TOPIC_AVAILABILITY)[keyof typeof TOPIC_AVAILABILITY];

export const TOPIC_AVAILABILITY_LABEL: Record<TopicAvailability, string> = {
  open: 'Batches open',
  soon: 'Batches opening soon',
};

// Topics page filters live in the URL, so a filtered list can be shared
export const TOPIC_FILTER_PARAM = {
  query: 'q',
  classNumber: 'class',
  subject: 'subject',
  stream: 'stream',
  availability: 'availability',
} as const;
