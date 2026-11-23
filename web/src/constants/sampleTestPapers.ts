import type { SampleTestFigure, SampleTestQuestion } from './assessment';
import { type PaperRow as Row, toPaper } from './paperRows';

// The sample test papers: 20 questions for each subject of each class or
// exam, written as rows (see paperRows.ts).

// Class 11

const CLASS_11_ACCOUNTANCY: readonly Row[] = [
  [
    'Depreciation is charged on',
    'Fixed assets',
    'Closing stock',
    'Debtors',
    'Cash at bank',
  ],
  [
    'A trial balance checks the',
    'Arithmetical accuracy of the ledger',
    'Profit for the year',
    'Cash in hand',
    'Tax payable',
  ],
  [
    'The accounting equation is',
    'Assets = Liabilities + Capital',
    'Assets = Capital − Liabilities',
    'Capital = Assets + Liabilities',
    'Liabilities = Assets + Capital',
  ],
  [
    'Under the straight line method, the depreciation charged each year is',
    'The same every year',
    'Higher every year',
    'Lower every year',
    'Charged only in the first year',
  ],
  [
    'Goods taken by the owner for personal use are debited to',
    'Drawings account',
    'Purchases account',
    'Sales account',
    'Capital account',
  ],
  [
    'A suspense account is opened when',
    'The trial balance does not agree',
    'Profit is high',
    'Assets are sold',
    'Capital is introduced',
  ],
  [
    'Which of these is a nominal account?',
    'Rent account',
    'Cash account',
    'Machinery account',
    "A debtor's account",
  ],
  [
    'Under the rule for real accounts, you debit',
    'What comes in',
    'The giver',
    'All incomes',
    'What goes out',
  ],
  [
    'A bank reconciliation statement is prepared by the',
    'Account holder',
    'Bank',
    'Auditor',
    'Tax department',
  ],
  [
    'Provision for doubtful debts follows the principle of',
    'Prudence',
    'Consistency',
    'Materiality',
    'Going concern',
  ],
  [
    'Purchase of furniture on credit is recorded in the',
    'Journal proper',
    'Purchases book',
    'Sales book',
    'Cash book',
  ],
  [
    'Outstanding salary is a',
    'Current liability',
    'Current asset',
    'Fixed asset',
    'Revenue',
  ],
  [
    'The written down value method charges depreciation on the',
    'Reducing book value',
    'Original cost every year',
    'Market value',
    'Scrap value only',
  ],
  ['Bills receivable is', 'An asset', 'A liability', 'An expense', 'An income'],
  [
    'Capital expenditure benefits the business for',
    'More than one year',
    'Only the current year',
    'Only one month',
    'No period at all',
  ],
  [
    'Which error does not affect the agreement of the trial balance?',
    'Complete omission of a transaction',
    'Wrong totalling of a ledger',
    'Posting to the wrong side',
    'Wrong balancing of an account',
  ],
  [
    'Which discount is not recorded in the books of account?',
    'Trade discount',
    'Cash discount',
    'Discount on bills',
    'Discount allowed to debtors',
  ],
  [
    'The going concern concept assumes the business will',
    'Continue for the foreseeable future',
    'Close next year',
    'Be sold soon',
    'Always earn a profit',
  ],
  [
    'Sales returns are also called',
    'Returns inward',
    'Returns outward',
    'Purchase returns',
    'Drawings',
  ],
  [
    'The cash column of a cash book always shows',
    'A debit balance or nil',
    'A credit balance',
    'An overdraft',
    'A loss',
  ],
];

const CLASS_11_BUSINESS_STUDIES: readonly Row[] = [
  [
    'Which is an economic activity?',
    'Teaching for a salary',
    'Praying at a temple',
    'Cooking for the family',
    'Helping a friend',
  ],
  [
    "A sole proprietor's liability is",
    'Unlimited',
    'Limited',
    'Shared with the state',
    'Fixed by law',
  ],
  [
    'The maximum number of members in a private company is',
    '200',
    '50',
    '100',
    '500',
  ],
  [
    'The head of a Hindu Undivided Family business is called the',
    'Karta',
    'Partner',
    'Director',
    'Proprietor',
  ],
  [
    'E-business mainly means doing business',
    'Over the internet',
    'Only in a market',
    'Only by barter',
    'Only abroad',
  ],
  [
    'The central bank of India is the',
    'Reserve Bank of India',
    'State Bank of India',
    'Punjab National Bank',
    'Bank of Baroda',
  ],
  [
    'Warehousing creates which utility?',
    'Time utility',
    'Place utility',
    'Form utility',
    'Knowledge utility',
  ],
  [
    'Transport creates which utility?',
    'Place utility',
    'Time utility',
    'Form utility',
    'Possession utility',
  ],
  [
    'A public enterprise is owned by the',
    'Government',
    'Shareholders only',
    'Partners',
    'Foreign firms',
  ],
  [
    'Social responsibility of business is its duty towards',
    'Society',
    'Only its owners',
    'Only the government',
    'Only its competitors',
  ],
  [
    'Outsourcing means',
    'Contracting work out to other firms',
    'Doing everything in-house',
    'Exporting goods',
    'Closing a branch',
  ],
  [
    'A retailer sells mainly to',
    'Final consumers',
    'Wholesalers',
    'Manufacturers',
    'Exporters',
  ],
  [
    "The document inviting the public to buy a company's shares is the",
    'Prospectus',
    'Memorandum of association',
    'Articles of association',
    'Certificate of incorporation',
  ],
  [
    'Debentures are',
    'Borrowed capital',
    'Ownership capital',
    'Retained earnings',
    'Reserves',
  ],
  [
    'Which is a source of short-term finance?',
    'Trade credit',
    'Equity shares',
    'Debentures',
    'Retained earnings',
  ],
  [
    'MSME stands for',
    'Micro, Small and Medium Enterprises',
    'Major State Manufacturing Enterprises',
    'Multiple Small Market Exporters',
    'Medium Scale Manufacturing Enterprises',
  ],
  [
    'A partner who does not take part in running the business is a',
    'Sleeping partner',
    'Active partner',
    'Managing partner',
    'Working partner',
  ],
  [
    'Business risk arises mainly from',
    'Uncertainty',
    'Certainty',
    'Government ownership',
    'Fixed prices',
  ],
  [
    'Importing goods in order to export them again is called',
    'Entrepot trade',
    'Retail trade',
    'Internal trade',
    'Barter',
  ],
  [
    'Insurance works on the principle of',
    'Utmost good faith',
    'Let the buyer beware',
    'Profit sharing',
    'Barter',
  ],
];

const CLASS_11_ECONOMICS: readonly Row[] = [
  [
    'The basic economic problem arises because of',
    'Scarcity of resources',
    'Unlimited resources',
    'Too much money',
    'Low prices',
  ],
  ['The mean of 2, 4, 6, 8 and 10 is', '6', '5', '7', '8'],
  ['The median of 3, 7, 9, 12 and 15 is', '9', '7', '12', '9.2'],
  [
    'The mode is the value that',
    'Occurs most often',
    'Is in the middle',
    'Is the average',
    'Is the largest',
  ],
  [
    'A production possibility curve is usually',
    'Concave to the origin',
    'Upward sloping',
    'A vertical line',
    'Convex to the origin',
  ],
  [
    'Opportunity cost is the value of the',
    'Next best alternative given up',
    'Money spent',
    'Total cost',
    'Fixed cost',
  ],
  [
    'By the law of demand, when price rises, quantity demanded',
    'Falls',
    'Rises',
    'Stays the same',
    'Doubles',
  ],
  [
    'Total utility is at its maximum when marginal utility is',
    'Zero',
    'At its maximum',
    'Negative',
    'Equal to price',
  ],
  [
    'Data collected first-hand by the investigator is',
    'Primary data',
    'Secondary data',
    'Published data',
    'Estimated data',
  ],
  [
    'A market with a single seller is',
    'Monopoly',
    'Perfect competition',
    'Oligopoly',
    'Monopolistic competition',
  ],
  [
    'Under perfect competition, a firm is a',
    'Price taker',
    'Price maker',
    'Monopolist',
    'Price leader',
  ],
  ['The range of 5, 12, 20 and 9 is', '15', '20', '12', '25'],
  [
    'Marginal cost is the change in total cost from',
    'Producing one more unit',
    'Producing all units',
    'Fixed costs',
    'A price change',
  ],
  [
    'Goods whose demand rises as income rises are',
    'Normal goods',
    'Inferior goods',
    'Giffen goods',
    'Free goods',
  ],
  [
    "A firm's short-run supply curve is its MC curve above",
    'Minimum average variable cost',
    'Minimum average total cost',
    'Zero output',
    'Maximum average fixed cost',
  ],
  [
    'Price elasticity of demand equal to 1 means demand is',
    'Unitary elastic',
    'Perfectly elastic',
    'Perfectly inelastic',
    'Highly inelastic',
  ],
  [
    'A graph of cumulative frequency is called',
    'An ogive',
    'A pie chart',
    'A bar chart',
    'A histogram',
  ],
  [
    'The coefficient of correlation lies between',
    '−1 and +1',
    '0 and 1',
    '−10 and +10',
    '0 and 100',
  ],
  [
    'The price at which demand equals supply is the',
    'Equilibrium price',
    'Ceiling price',
    'Floor price',
    'Support price',
  ],
  [
    'In the short run, fixed costs',
    'Do not change with output',
    'Rise with output',
    'Fall with output',
    'Are always zero',
  ],
];

const CLASS_11_PHYSICS: readonly Row[] = [
  ['The SI unit of force is the', 'Newton', 'Joule', 'Watt', 'Pascal'],
  [
    'The dimensional formula of velocity is',
    '[LT⁻¹]',
    '[LT⁻²]',
    '[ML]',
    '[MLT⁻¹]',
  ],
  [
    "Newton's first law is also called the law of",
    'Inertia',
    'Gravitation',
    'Action and reaction',
    'Momentum',
  ],
  [
    "Acceleration due to gravity near Earth's surface is about",
    '9.8 m/s²',
    '1.6 m/s²',
    '98 m/s²',
    '0.98 m/s²',
  ],
  [
    'Work done is zero when force and displacement are',
    'Perpendicular',
    'Parallel',
    'Opposite',
    'Equal in size',
  ],
  [
    'The kinetic energy of a body of mass m and speed v is',
    '½mv²',
    'mv',
    'mv²',
    '½mv',
  ],
  ['The SI unit of power is the', 'Watt', 'Joule', 'Newton', 'Volt'],
  [
    'Momentum is the product of',
    'Mass and velocity',
    'Mass and acceleration',
    'Force and time',
    'Force and distance',
  ],
  [
    'The slope of a velocity–time graph gives',
    'Acceleration',
    'Displacement',
    'Speed',
    'Distance',
  ],
  [
    'The area under a velocity–time graph gives',
    'Displacement',
    'Acceleration',
    'Force',
    'Power',
  ],
  [
    'On level ground, a projectile has its maximum range at',
    '45°',
    '30°',
    '60°',
    '90°',
  ],
  [
    "The escape velocity from Earth's surface is about",
    '11.2 km/s',
    '7.9 km/s',
    '3 km/s',
    '25 km/s',
  ],
  [
    "Hooke's law relates stress to",
    'Strain',
    'Temperature',
    'Density',
    'Volume',
  ],
  ['The SI unit of pressure is the', 'Pascal', 'Newton', 'Joule', 'Hertz'],
  [
    'Angular momentum is conserved when the external torque is',
    'Zero',
    'Maximum',
    'Increasing',
    'Equal to the force',
  ],
  [
    'The time period of a simple pendulum depends on',
    'Its length and g',
    'The mass of the bob',
    'The colour of the bob',
    'Only the amplitude',
  ],
  [
    'The first law of thermodynamics is a statement of conservation of',
    'Energy',
    'Mass',
    'Momentum',
    'Charge',
  ],
  ['Sound travels fastest in', 'Steel', 'Air', 'Water', 'A vacuum'],
  ['Absolute zero is', '−273.15 °C', '0 °C', '−100 °C', '273 °C'],
  [
    "Bernoulli's principle follows from conservation of",
    'Energy',
    'Mass only',
    'Charge',
    'Angular momentum',
  ],
];

const CLASS_11_CHEMISTRY: readonly Row[] = [
  ['The number of moles in 18 g of water is', '1', '2', '0.5', '18'],
  [
    "Avogadro's number is about",
    '6.022 × 10²³',
    '3 × 10⁸',
    '1.6 × 10⁻¹⁹',
    '9.1 × 10⁻³¹',
  ],
  ['The hybridisation of carbon in methane is', 'sp³', 'sp', 'sp²', 'dsp²'],
  [
    'The shape of a water molecule is',
    'Bent',
    'Linear',
    'Tetrahedral',
    'Trigonal planar',
  ],
  [
    'The most electronegative element is',
    'Fluorine',
    'Oxygen',
    'Chlorine',
    'Nitrogen',
  ],
  [
    'The bond in sodium chloride is',
    'Ionic',
    'Covalent',
    'Metallic',
    'A hydrogen bond',
  ],
  [
    'The maximum number of electrons in the second shell (n = 2) is',
    '8',
    '2',
    '18',
    '32',
  ],
  ['The pH of a neutral solution at 25 °C is', '7', '0', '14', '1'],
  [
    'The shape of an orbital is described by the',
    'Azimuthal quantum number',
    'Principal quantum number',
    'Magnetic quantum number',
    'Spin quantum number',
  ],
  [
    'Oxidation is the',
    'Loss of electrons',
    'Gain of electrons',
    'Gain of protons',
    'Loss of neutrons',
  ],
  ['The ideal gas equation is', 'PV = nRT', 'P = nRT', 'PV = RT/n', 'PT = nRV'],
  ['The bond angle in methane (CH₄) is', '109.5°', '90°', '120°', '180°'],
  [
    'Group 1 elements are called',
    'Alkali metals',
    'Halogens',
    'Noble gases',
    'Alkaline earth metals',
  ],
  ['The number of sigma bonds in ethene (C₂H₄) is', '5', '4', '6', '3'],
  [
    "Le Chatelier's principle applies to systems in",
    'Equilibrium',
    'Free fall',
    'A vacuum',
    'Uniform motion',
  ],
  [
    'The enthalpy change is negative for',
    'An exothermic reaction',
    'An endothermic reaction',
    'Melting ice',
    'Boiling water',
  ],
  [
    'The IUPAC name of CH₃CH₂OH is',
    'Ethanol',
    'Methanol',
    'Propanol',
    'Ethanal',
  ],
  ['The molar mass of CO₂ is', '44 g/mol', '28 g/mol', '32 g/mol', '12 g/mol'],
  ['Hydrogen bonding is strongest in', 'HF', 'HCl', 'HBr', 'HI'],
  [
    'Which is an isotope of hydrogen?',
    'Deuterium',
    'Helium',
    'Ozone',
    'Diamond',
  ],
];

const CLASS_11_MATHEMATICS: readonly Row[] = [
  ['sin²θ + cos²θ =', '1', '0', '2', 'tan θ'],
  ['The number of subsets of a set with 3 elements is', '8', '3', '6', '9'],
  ['If i = √−1, then i² =', '−1', '1', 'i', '0'],
  ['The slope of the line y = 3x + 2 is', '3', '2', '1/3', '−3'],
  ['⁵C₂ =', '10', '20', '5', '25'],
  [
    'The number of ways to arrange 4 different books in a row is',
    '24',
    '4',
    '12',
    '16',
  ],
  [
    'The sum of the first n natural numbers is',
    'n(n + 1)/2',
    'n²',
    'n(n − 1)/2',
    '2n',
  ],
  [
    'The nth term of an AP with first term a and common difference d is',
    'a + (n − 1)d',
    'a + nd',
    'an + d',
    'a(n − 1)',
  ],
  ['lim (x → 0) sin x / x =', '1', '0', '∞', 'It does not exist'],
  ['The derivative of x³ is', '3x²', 'x²', '3x', 'x⁴/4'],
  ['The radius of the circle x² + y² = 25 is', '5', '25', '10', '√5'],
  ['sin 30° =', '1/2', '√3/2', '1', '0'],
  [
    'The probability of a head when tossing a fair coin is',
    '1/2',
    '0',
    '1',
    '1/4',
  ],
  [
    'If A = {1, 2} and B = {2, 3}, then A ∩ B =',
    '{2}',
    '{1}',
    '{1, 2, 3}',
    'The empty set',
  ],
  ['The modulus of 3 + 4i is', '5', '7', '25', '1'],
  ['The distance between (0, 0) and (3, 4) is', '5', '7', '12', '25'],
  ['The common ratio of the GP 2, 6, 18, … is', '3', '2', '4', '6'],
  ['The number of terms in the expansion of (a + b)⁶ is', '7', '6', '8', '12'],
  ['The derivative of sin x is', 'cos x', '−cos x', 'sin x', '−sin x'],
  [
    'The eccentricity of a circle is',
    '0',
    '1',
    'Between 0 and 1',
    'Greater than 1',
  ],
];

const CLASS_11_BIOLOGY: readonly Row[] = [
  ['The basic unit of life is the', 'Cell', 'Tissue', 'Organ', 'Atom'],
  [
    'The powerhouse of the cell is the',
    'Mitochondrion',
    'Nucleus',
    'Ribosome',
    'Golgi body',
  ],
  [
    'Proteins are made in the',
    'Ribosomes',
    'Lysosomes',
    'Vacuoles',
    'Centrioles',
  ],
  [
    'The five-kingdom classification was proposed by',
    'R. H. Whittaker',
    'Charles Darwin',
    'Carolus Linnaeus',
    'Gregor Mendel',
  ],
  [
    'Binomial nomenclature was introduced by',
    'Carolus Linnaeus',
    'R. H. Whittaker',
    'Gregor Mendel',
    'Robert Hooke',
  ],
  [
    'Photosynthesis takes place in the',
    'Chloroplasts',
    'Mitochondria',
    'Ribosomes',
    'Nucleus',
  ],
  [
    'The cell division that halves the chromosome number is',
    'Meiosis',
    'Mitosis',
    'Binary fission',
    'Budding',
  ],
  ['Bacteria belong to the kingdom', 'Monera', 'Protista', 'Fungi', 'Plantae'],
  [
    'The functional unit of the kidney is the',
    'Nephron',
    'Neuron',
    'Alveolus',
    'Villus',
  ],
  ['Most enzymes are', 'Proteins', 'Carbohydrates', 'Lipids', 'Vitamins'],
  [
    'The gas released in photosynthesis is',
    'Oxygen',
    'Carbon dioxide',
    'Nitrogen',
    'Hydrogen',
  ],
  [
    'The pacemaker of the human heart is the',
    'SA node',
    'AV node',
    'Bundle of His',
    'Purkinje fibres',
  ],
  [
    'Insulin is secreted by the',
    'Pancreas',
    'Liver',
    'Thyroid',
    'Adrenal gland',
  ],
  [
    'Xylem carries',
    'Water and minerals',
    'Food',
    'Only hormones',
    'Only oxygen',
  ],
  [
    'The cell wall of fungi is made of',
    'Chitin',
    'Cellulose',
    'Peptidoglycan',
    'Lignin',
  ],
  [
    'The human heart has',
    '4 chambers',
    '2 chambers',
    '3 chambers',
    '5 chambers',
  ],
  ['Haemoglobin mainly carries', 'Oxygen', 'Nitrogen', 'Glucose', 'Urea'],
  [
    'The largest gland in the human body is the',
    'Liver',
    'Pancreas',
    'Thyroid',
    'Pituitary',
  ],
  [
    'Stomata mainly help in',
    'Gas exchange and transpiration',
    'Absorbing water',
    'Storing food',
    'Reproduction',
  ],
  [
    'The cell that carries nerve impulses is the',
    'Neuron',
    'Nephron',
    'Red blood cell',
    'Platelet',
  ],
];

// Class 12

// Class 12 questions come from CBSE board papers, which carry no answer
// key: these answers were worked out by us and need a tutor's check.

const ACCOUNTANCY_ABHA_BABITA =
  'Abha and Babita were partners in a clay toy making firm sharing profits in the ratio of 2 : 1. On 1st April, 2023, their capital accounts showed balances of ₹ 5,00,000 and ₹ 10,00,000 respectively. The partnership deed provides for interest on capital @ 10% p.a. The firm earned a profit of ₹ 90,000 during the year.';

const CLASS_12_ACCOUNTANCY: readonly Row[] = [
  // CBSE 2023-24 (67/1/1), Q1(b)
  [
    'Rushil and Abheer were partners in a firm sharing profits and losses in the ratio of 4 : 3. They admitted Sunil as a new partner for 3/7th share in the profits of the firm, which he acquired 2/7th share from Rushil and 1/7th share from Abheer. The new profit sharing ratio of Rushil, Abheer and Sunil will be',
    '2 : 2 : 3',
    '4 : 3 : 3',
    '2 : 1 : 3',
    '4 : 3 : 1',
  ],
  // CBSE 2023-24 (67/1/1), Q2
  [
    'Abhay, Boris and Chetan were partners in a firm sharing profits in the ratio of 5 : 3 : 2. Boris was guaranteed a profit of ₹ 95,000. Any deficiency on account of this was to be borne by Abhay and Chetan equally. The firm earned a profit of ₹ 2,00,000 for the year ended 31st March, 2023. The amount given by Abhay to Boris as guaranteed amount will be',
    '₹ 17,500',
    '₹ 35,000',
    '₹ 25,000',
    '₹ 10,000',
  ],
  // CBSE 2023-24 (67/1/1), Q3
  [
    'Aavya, Mitansh and Praveen were partners in a firm. On 31st March, 2023, the firm was dissolved. Creditors took over furniture of book value of ₹ 50,000 at ₹ 45,000 in part settlement of their amount of ₹ 60,000. The balance amount was paid to them through cheque. The amount paid through cheque will be',
    '₹ 15,000',
    '₹ 10,000',
    '₹ 50,000',
    '₹ 45,000',
  ],
  // CBSE 2023-24 (67/1/1), Q4
  [
    'Piyush, Rajesh and Avinash were partners in a firm sharing profits and losses equally. Shiva was admitted as a new partner for an equal share. Shiva brought his share of capital and premium for goodwill in cash. The premium for goodwill amount will be divided among',
    'Old partners in sacrificing ratio',
    'Old partners in old ratio',
    'New partners in new ratio',
    'New partners in sacrificing ratio',
  ],
  // CBSE 2023-24 (67/1/1), Q5
  [
    'Alex, Benn and Cole were partners in a firm sharing profits and losses in the ratio of 5 : 3 : 2. They admitted Dona as a new partner for 1/5th share in the future profits. Dona agreed to contribute proportionate capital. On the date of admission, capitals of Alex, Benn and Cole after all adjustments were ₹ 1,20,000; ₹ 80,000 and ₹ 1,00,000 respectively. The amount of capital brought in by Dona will be',
    '₹ 75,000',
    '₹ 60,000',
    '₹ 65,000',
    '₹ 70,000',
  ],
  // CBSE 2023-24 (67/1/1), Q7
  [
    `${ACCOUNTANCY_ABHA_BABITA} The amount of interest on capital allowed to Abha will be`,
    '₹ 30,000',
    '₹ 50,000',
    '₹ 1,00,000',
    '₹ 60,000',
  ],
  // CBSE 2023-24 (67/1/1), Q8
  [
    `${ACCOUNTANCY_ABHA_BABITA} Babita’s share in profit will be`,
    'Nil',
    '₹ 60,000',
    '₹ 30,000',
    '₹ 1,00,000',
  ],
  // CBSE 2023-24 (67/1/1), Q9
  [
    'Alfa Ltd. invited applications for 50,000 equity shares of ₹ 10 each at a premium of 30%. The whole amount was payable on application. Applications were received for 2,50,000 shares. The company decided to allot the shares on a pro-rata basis to all the applicants. The amount refunded by the company was',
    '₹ 26,00,000',
    '₹ 32,50,000',
    '₹ 15,60,000',
    '₹ 39,00,000',
  ],
  // CBSE 2023-24 (67/1/1), Q10
  [
    'Reserve capital is that part of ______ capital which cannot be called except at the time of winding up of the company',
    'Uncalled',
    'Issued',
    'Called up',
    'Nominal',
  ],
  // CBSE 2023-24 (67/1/1), Q11
  [
    'Xeno Ltd. issued 25,000 equity shares of ₹ 10 each, payable ₹ 4 per share on application, ₹ 5 per share on allotment and the balance on first and final call. All the shares offered were applied for and allotted. All the money due on allotment was received except on 1,500 shares. These shares were forfeited immediately after allotment. First and final call was not yet made. At the time of forfeiture, Share Capital Account will be debited by',
    '₹ 13,500',
    '₹ 15,000',
    '₹ 24,000',
    '₹ 18,000',
  ],
  // CBSE 2023-24 (67/1/1), Q13(a)
  [
    'Money received in advance from shareholders before it is actually called up by the directors is',
    'credited to calls in advance account',
    'debited to calls in advance account',
    'debited to share capital account',
    'credited to share capital account',
  ],
  // CBSE 2023-24 (67/1/1), Q14(a)
  [
    'A share of ₹ 100 on which ₹ 80 is received is forfeited for non-payment of final call of ₹ 20. The minimum price at which this share can be reissued is',
    '₹ 20',
    '₹ 120',
    '₹ 100',
    '₹ 80',
  ],
  // CBSE 2023-24 (67/1/1), Q14(b)
  [
    'Shiv Ltd. forfeited 500 shares of ₹ 10 each on which ₹ 7 per share was paid. These shares were reissued for ₹ 9 per share fully paid. Amount transferred to Capital Reserve Account will be',
    '₹ 3,000',
    '₹ 5,000',
    '₹ 4,500',
    '₹ 3,500',
  ],
  // CBSE 2023-24 (67/1/1), Q16(a)
  [
    'Anju, Divya and Bobby were partners in a firm sharing profits and losses in the ratio of 3 : 2 : 1. Bobby retired. The new profit sharing ratio between Anju and Divya after Bobby’s retirement was 5 : 3. The gaining ratio of remaining partners will be',
    '3 : 1',
    '3 : 2',
    '5 : 3',
    '2 : 3',
  ],
  // CBSE 2023-24 (67/1/1), Q16(b)
  [
    'Mita, Veena and Atul were partners in a firm sharing profits and losses in the ratio of 3 : 2 : 1. Atul retired and his share was taken over by Mita and Veena in the ratio of 1 : 4. The new profit sharing ratio between Mita and Veena after Atul’s retirement will be',
    '8 : 7',
    '3 : 2',
    '7 : 3',
    '2 : 3',
  ],
  // CBSE 2023-24 (67/1/1), Q27
  [
    'The Quick Ratio of a company is 1 : 2. Which of the following transactions will result in an increase in this ratio?',
    'Sold goods on credit',
    'Cash received from debtors',
    'Purchased goods on credit',
    'Purchased goods on cash',
  ],
  // CBSE 2023-24 (67/1/1), Q28
  [
    'Identify which of the following transactions will result in ‘Cash Inflow From Operating Activities’',
    'Amount received from debtors',
    'Payment to creditors',
    'Interest received by a non-finance company',
    'Dividend received by a non-finance company',
  ],
  // CBSE 2023-24 (67/1/1), Q29(a)
  [
    'Analysis of Financial Statements is useful and significant to different users. Which of the following users is particularly interested in the firm’s ability to meet their claims over a very short period of time?',
    'Trade Payables',
    'Labour Unions',
    'Top Management',
    'Finance Manager',
  ],
  // CBSE 2023-24 (67/1/1), Q29(b)
  [
    '______ ratios are calculated to determine the ability of the business to service its debt in the long run',
    'Solvency',
    'Liquidity',
    'Turnover',
    'Profitability',
  ],
  // CBSE 2023-24 (67/1/1), Q30(a)
  [
    'The transaction ‘Acquisition of machinery by issue of equity shares of ₹ 5,00,00,000’ will result in',
    'No flow of cash',
    'Cash inflow of ₹ 5,00,00,000 from financing activities',
    'Cash outflow of ₹ 5,00,00,000 from financing activities',
    'Cash outflow of ₹ 5,00,00,000 from investing activities',
  ],
];

const CLASS_12_BUSINESS_STUDIES: readonly Row[] = [
  // CBSE 2025-26 (66/1/1), Q2
  [
    'The workers in Alpha manufacturing company were using traditional methods for production of metal parts. Since no standard procedure existed, workers relied on personal experience and guess work, and productivity began to decline. A consultant specialising in scientific management carefully investigated the traditional methods through work-study and, by unifying the best practices, developed a standard method to be followed by everyone. Productivity increased three fold within six months. The principle of scientific management which helped the company in increasing the productivity was',
    'Science, not Rule of Thumb',
    'Harmony, Not Discord',
    'Cooperation, Not Individualism',
    'Development of Each and Every Person to His or Her Greatest Efficiency and Prosperity',
  ],
  // CBSE 2025-26 (66/1/1), Q3
  [
    'Statement I: Consumers should get together and form themselves into consumer associations for protection and promotion of their interests. Statement II: The Consumer Protection Act provides for setting up a two-tier enforcement machinery for the redressal of consumer grievances. Choose the correct alternative',
    'Statement I is true, Statement II is false',
    'Both the statements are true',
    'Both the statements are false',
    'Statement I is false, Statement II is true',
  ],
  // CBSE 2025-26 (66/1/1), Q6
  [
    'Sudha purchased ‘NATURO’ hair colour. After reading essential details such as shade, its ingredients, usage instructions and expiry date mentioned on the box, she opened the box, took out the colour tube and developer bottle, and threw away the box. The level of packaging of the box thrown away by Sudha was',
    'Secondary packaging',
    'Primary packaging',
    'Transportation packaging',
    'General packaging',
  ],
  // CBSE 2025-26 (66/1/1), Q7
  [
    'Assertion (A): Money market instruments have a higher degree of liquidity as compared to capital market securities. Reason (R): Money market instruments are traded on the stock exchanges.',
    'Assertion (A) is true and Reason (R) is false',
    'Both Assertion (A) and Reason (R) are true and Reason (R) is the correct explanation of Assertion (A)',
    'Both Assertion (A) and Reason (R) are true, but Reason (R) is not the correct explanation of Assertion (A)',
    'Assertion (A) is false and Reason (R) is true',
  ],
  // CBSE 2025-26 (66/1/1), Q8
  [
    'Ravi purchased gold jewellery from a reputed jewellery store. He ensured that the jewellery had a hallmark which confirms its purity and authenticity. To avoid paying goods and services tax (GST) he asked the salesperson to write the gold weight and making charges on a slip of paper and hand it over to him. Which of the following responsibilities of a consumer was not fulfilled by Ravi?',
    'Ask for a cash memo on purchase of goods and services',
    'Be aware about various goods and services available in the market so that an intelligent and wise choice can be made',
    'Buy only standardized goods as they provide quality assurance',
    'Assert yourself to ensure that you get a fair deal',
  ],
  // CBSE 2025-26 (66/1/1), Q9
  [
    '‘CARO Tech Solutions’ aimed at development of a software system for the company’s growing operations. The project was to be completed within six months with a budget of ₹ 12,00,000. The software development team successfully completed its project on time by outsourcing a part of the project, leading to an additional expense of ₹ 2,00,000. The software development team is',
    'Effective but not efficient',
    'Efficient and Effective',
    'Efficient but not effective',
    'Neither efficient nor effective',
  ],
  // CBSE 2025-26 (66/1/1), Q10
  [
    '‘Green India Electronics’ planned to launch a new eco-friendly heater for the short winter season. Top level managers were asked to work in coordination with their subordinates, the production manager co-ordinated with the operational level managers, and operational level managers co-ordinated the activities of the workers so that work proceeded according to plans. The feature of co-ordination discussed here is',
    'Co-ordination is the responsibility of all managers',
    'Co-ordination is a deliberate function',
    'Co-ordination is a continuous process',
    'Co-ordination ensures unity of action',
  ],
  // CBSE 2025-26 (66/1/1), Q11
  [
    '‘Business environment keeps on changing whether in terms of technological improvement, shifts in consumer preferences or entry of new competitors in the market.’ The feature of business environment highlighted in the above statement is',
    'Dynamic nature',
    'Totality of external forces',
    'Complexity',
    'Relativity',
  ],
  // CBSE 2025-26 (66/1/1), Q12
  [
    'A position when a company is unable to meet its fixed financial charges like interest payment, dividend on preference shares and repayment obligations is referred to as ______',
    'Financial risk',
    'Trading on equity',
    'Business risk',
    'Operating risk',
  ],
  // CBSE 2025-26 (66/1/1), Q13
  [
    'Identify the incorrect statement with respect to the importance of planning function of management',
    'Planning eliminates uncertainty by looking ahead and anticipating changes',
    'Planning provides directions by stating in advance how work is to be done',
    'Planning facilitates decision making by making a choice among various alternative courses of action',
    'Planning promotes innovative ideas as new ideas can take the shape of concrete plans',
  ],
  // CBSE 2025-26 (66/1/1), Q14
  [
    'Arrange the steps of the process of organising in the correct order',
    'Identification and Division of work, Departmentalisation, Assignment of duties, Establishing authority and reporting relationships',
    'Identification and Division of work, Assignment of duties, Departmentalisation, Establishing authority and reporting relationships',
    'Identification and Division of work, Assignment of duties, Establishing authority and reporting relationships, Departmentalisation',
    'Departmentalisation, Identification and Division of work, Establishing authority and reporting relationships, Assignment of duties',
  ],
  // CBSE 2025-26 (66/1/1), Q15
  [
    'Identify the feature of planning which states that the purpose of planning is to meet future events effectively to the best advantage of an organisation',
    'Planning is futuristic',
    'Planning involves decision making',
    'Planning is a mental exercise',
    'Planning focuses on achieving objectives',
  ],
  // CBSE 2025-26 (66/1/1), Q16
  [
    'Match each principle of management in Column I with its explanation in Column II',
    '(a)–(iii), (b)–(iv), (c)–(ii), (d)–(i)',
    '(a)–(iii), (b)–(iv), (c)–(i), (d)–(ii)',
    '(a)–(iv), (b)–(iii), (c)–(ii), (d)–(i)',
    '(a)–(iv), (b)–(iii), (c)–(i), (d)–(ii)',
    {
      kind: 'table',
      head: ['Column I', 'Column II'],
      rows: [
        [
          '(a) Discipline',
          '(i) There should be one and only one boss for every individual employee in the organisation',
        ],
        [
          '(b) Unity of direction',
          '(ii) There should be a place for everything (everyone) and everything (everyone) should be in its (his/her) place',
        ],
        [
          '(c) Order',
          '(iii) There should be obedience to organisational rules and employment agreement which is necessary for the working of the organisation',
        ],
        [
          '(d) Unity of command',
          '(iv) Each group of activities having the same objective must have one head and one plan',
        ],
      ],
    },
  ],
  // CBSE 2025-26 (66/1/1), Q17
  [
    'The step of controlling process which reveals the deviation between actual performance and desired results is',
    'Comparing actual performance with the standards',
    'Setting performance standards',
    'Analysing deviations',
    'Taking corrective action',
  ],
  // CBSE 2025-26 (66/1/1), Q18
  [
    '‘Certain provisions of the Companies Act place restrictions on payouts as dividend. Such provisions must be adhered to while declaring the dividend.’ The factor affecting dividend decision discussed above is',
    'Legal constraints',
    'Access to capital market',
    'Contractual constraints',
    'Stock market reaction',
  ],
  // CBSE 2025-26 (66/1/1), Q19
  [
    'Statement I: Control should focus on key result areas which are critical to the success of an organization. Statement II: Only significant deviations which go beyond the permissible limit should be brought to the notice of management. Choose the correct alternative',
    'Both the statements are true',
    'Both the statements are false',
    'Statement I is true and Statement II is false',
    'Statement I is false and Statement II is true',
  ],
  // CBSE 2025-26 (66/1/1), Q20
  [
    'Which of the following is NOT an organisational barrier to communication?',
    'Lack of proper incentives',
    'Status',
    'Organisational facilities',
    'Rules and regulations',
  ],
  // CBSE 2023-24 (66/1/1), Q2
  [
    'Which of the following is an element of ‘Social Environment’?',
    'Expectations from the workforce',
    'Rates of saving and investment',
    'The nature of relationship of our country with foreign countries',
    'Planned outlay in public and private sectors',
  ],
  // CBSE 2023-24 (66/1/1), Q4
  [
    '______ refers to doing the task correctly and with minimum cost',
    'Efficiency',
    'Effectiveness',
    'Coordination',
    'Process',
  ],
  // CBSE 2023-24 (66/1/1), Q9
  [
    'The process of estimating fund requirements of a business and specifying the sources of funds is called',
    'Financial planning',
    'Capital structure',
    'Financial management',
    'Capital budgeting',
  ],
];

const STATEMENTS = {
  firstOnly: 'Statement 1 is true and Statement 2 is false',
  secondOnly: 'Statement 1 is false and Statement 2 is true',
  both: 'Both Statements 1 and 2 are true',
  neither: 'Both Statements 1 and 2 are false',
} as const;

const ASSERTION = {
  explains:
    'Both Assertion (A) and Reason (R) are true and Reason (R) is the correct explanation of Assertion (A)',
  doesNotExplain:
    'Both Assertion (A) and Reason (R) are true, but Reason (R) is not the correct explanation of Assertion (A)',
  reasonFalse: 'Assertion (A) is true, but Reason (R) is false',
  assertionFalse: 'Assertion (A) is false, but Reason (R) is true',
} as const;

const CLASS_12_ECONOMICS: readonly Row[] = [
  // CBSE 2023-24 (58/1/1), Q1
  [
    'Statement 1: If in an economy the level of income increases (ΔY), it will always proportionately increase the level of consumption (ΔC). Statement 2: Marginal Propensity to Consume (MPC) and Marginal Propensity to Save (MPS) are always equal to each other. Choose the correct alternative',
    STATEMENTS.neither,
    STATEMENTS.firstOnly,
    STATEMENTS.secondOnly,
    STATEMENTS.both,
  ],
  // CBSE 2023-24 (58/1/1), Q2
  [
    'Identify the correct equation from the following',
    'GNP(MP) = GDP(MP) + Net Factor Income from Abroad',
    'GDP(MP) = NNP(FC) + Depreciation',
    'NDP(FC) = NNP(FC) + Net Indirect Taxes',
    'NNP(FC) = NDP(MP) + Depreciation',
  ],
  // CBSE 2023-24 (58/1/1), Q3
  [
    'Assertion (A): Full employment situation refers to absence of involuntary unemployment. Reason (R): Under full employment situation, all the willing and able bodied people get employment at the prevailing wage rate.',
    ASSERTION.explains,
    ASSERTION.doesNotExplain,
    ASSERTION.reasonFalse,
    ASSERTION.assertionFalse,
  ],
  // CBSE 2023-24 (58/1/1), Q4
  [
    '“As per the National Stock Exchange (NSE) data, dated 9th June, 2023, there was a net selling off worth ₹ 309 crore by Foreign Institutional Investors (FIIs) over the period of one month i.e., 9th May, 2023 – 9th June, 2023.” The above mentioned transactions will be recorded on ______ side of ______ account of Balance of Payments of India',
    'Debit, Capital',
    'Debit, Current',
    'Credit, Capital',
    'Credit, Current',
  ],
  // CBSE 2023-24 (58/1/1), Q5
  [
    'Identify the incorrect feature(s) of money supply (M1) from the following: (i) It is measured at a point of time. (ii) It does not include stock of money held by the government. (iii) It is always the currency in the hands of the Central Bank of a nation.',
    '(iii) only',
    '(i) and (ii)',
    '(ii) and (iii)',
    '(ii) only',
  ],
  // CBSE 2023-24 (58/1/1), Q6
  [
    'Total consumption expenditure by households under Keynesian Economics is a combination of ______ and ______',
    'Autonomous Consumption, Induced Consumption',
    'Autonomous Consumption, Autonomous Investments',
    'Autonomous Investments, Induced Consumption',
    'Induced Investments, Autonomous Investments',
  ],
  // CBSE 2023-24 (58/1/1), Q8
  [
    'Surplus in Balance of Payments (BOP) refers to the excess of ______',
    'Autonomous receipts over Autonomous payments',
    'Autonomous payments over Autonomous receipts',
    'Current Account payments over Autonomous receipts',
    'Capital Account receipts over Capital Account payments',
  ],
  // CBSE 2023-24 (58/1/1), Q9
  [
    'Suppose for a hypothetical economy: C = 100 + 0.75Y (where C = Consumption and Y = Income) and I₀ = 400 (I₀ = Autonomous Investment). Value of Investment Multiplier (K) would be ______',
    '4',
    '5',
    '6',
    '3',
  ],
  // CBSE 2023-24 (58/1/1), Q10
  [
    'Suppose, the Balance of Trade of an imaginary economy shows a favourable balance of ₹ 500 crore. The values of merchandise exports are ₹ 1200 crore and transfer payments are ₹ 400 crore. The value of merchandise imports would be ₹ ______ crore',
    '700',
    '1700',
    '750',
    '900',
  ],
  // CBSE 2023-24 (58/1/1), Q19
  [
    'In the decade of the 1970s, Pakistan nationalized its ______ industries',
    'Capital goods',
    'Medical infrastructure',
    'Consumer goods',
    'Foreign trade',
  ],
  // CBSE 2023-24 (58/1/1), Q20
  [
    'Statement 1: Under the colonial rule, basic infrastructure (like railways, post and telegraph etc.) was developed. Statement 2: The real motive behind the infrastructural development in India was to strengthen the British interests. Choose the correct alternative',
    STATEMENTS.both,
    STATEMENTS.firstOnly,
    STATEMENTS.secondOnly,
    STATEMENTS.neither,
  ],
  // CBSE 2023-24 (58/1/1), Q21
  [
    'Identify which of the following alternatives indicate the incorrect components combination of Agriculture Marketing System',
    'Production, Assembling, Processing, Grading',
    'Assembling, Storage, Processing, Packaging',
    'Assembling, Processing, Packaging, Transportation',
    'Processing, Packaging, Grading, Distribution',
  ],
  // CBSE 2023-24 (58/1/1), Q24
  [
    'Identify the incorrect objectives of regulated agriculture market: (i) To make the marketing system efficient and effective for farmers to get best price of their products. (ii) To discourage improvement of marketing infrastructure for farmers. (iii) To prevent exploitation of farmers. (iv) To discourage farmers from improving quality and quantity of their produce.',
    '(ii) and (iv)',
    '(i) and (ii)',
    '(i) and (iii)',
    '(iii) and (iv)',
  ],
  // CBSE 2023-24 (58/1/1), Q25
  [
    'Economic reforms were introduced in India and Pakistan in the years ______ and ______, respectively',
    '1991, 1988',
    '1988, 1978',
    '1991, 1978',
    '1981, 1991',
  ],
  // CBSE 2023-24 (58/1/1), Q26
  [
    'Statement 1: As per the National Sample Survey Organization (NSSO), unemployment is a situation in which all those who, owing to lack of work, are not working, but are seeking work from prospective employers. They express their willingness/availability to work under the prevailing conditions of work and remuneration. Statement 2: Disguised Unemployment is generally a massive problem in a highly populated country like India. Choose the correct alternative',
    STATEMENTS.both,
    STATEMENTS.firstOnly,
    STATEMENTS.secondOnly,
    STATEMENTS.neither,
  ],
  // CBSE 2023-24 (58/1/1), Q27
  [
    'Identify which of the following is not a member nation of G20',
    'Bangladesh',
    'Brazil',
    'Australia',
    'Argentina',
  ],
  // CBSE 2025-26 (58/1/1), Q1
  [
    'In a two sector economy, the flow of factor payments moves from ______ to ______',
    'firms, households',
    'firms, government',
    'banks, households',
    'households, firms',
  ],
  // CBSE 2025-26 (58/1/1), Q4
  [
    'In an economy, when ______ is insufficient to achieve the level of output corresponding to the full employment, the difference is termed a deflationary gap',
    'ex-ante Aggregate Demand',
    'ex-post Aggregate Demand',
    'ex-ante Aggregate Supply',
    'ex-post Aggregate Supply',
  ],
  // CBSE 2025-26 (58/1/1), Q9
  [
    '“In the Indian Banking System, the Statutory Liquidity Ratio (SLR) plays a vital role in controlling the credit creation capacity of the Commercial Banks, as it ______.”',
    'requires banks to maintain a percentage of deposits in the form of liquid assets',
    'ensures that all the deposits are converted into liquid assets',
    'sets the maximum interest rate which the banks can charge on loans',
    'promote banks from lending beyond a specific proportion of their total reserves',
  ],
  // CBSE 2025-26 (58/1/1), Q10
  [
    'In an economy, the currency held by the public, Net Demand Deposits with Commercial Banks and Net Time Deposits with Commercial Banks stand at ₹ 1,42,000 crore, ₹ 22,000 crore and ₹ 86,000 crore respectively. The value of Money Supply (M1) would be ₹ ______ crore',
    '1,64,000',
    '2,50,000',
    '86,000',
    '1,42,000',
  ],
];

const CLASS_12_PHYSICS: readonly Row[] = [
  // CBSE 2023-24 (55/1/1), Q1
  [
    'A thin plastic rod is bent into a circular ring of radius R. It is uniformly charged with charge density λ. The magnitude of the electric field at its centre is',
    'Zero',
    'λ/(2ε₀R)',
    'λ/(4πε₀R)',
    'λ/(4ε₀R)',
  ],
  // CBSE 2023-24 (55/1/1), Q2
  [
    'Ten capacitors, each of capacitance 1 µF, are connected in parallel to a source of 100 V. The total energy stored in the system is equal to',
    '5.0 × 10⁻² J',
    '10⁻² J',
    '10⁻³ J',
    '0.5 × 10⁻³ J',
  ],
  // CBSE 2023-24 (55/1/1), Q5
  [
    'A 10 cm long wire lies along y-axis. It carries a current of 1.0 A in positive y-direction. A magnetic field B = (5 mT) ĵ − (8 mT) k̂ exists in the region. The force on the wire is',
    '−(0.8 mN) î',
    '(0.8 mN) î',
    '(80 mN) î',
    '−(80 mN) î',
  ],
  // CBSE 2023-24 (55/1/1), Q6
  [
    'A galvanometer of resistance G Ω is converted into an ammeter of range 0 to I A. If the current through the galvanometer is 0.1% of I A, the resistance of the ammeter is',
    'G/1000 Ω',
    'G/999 Ω',
    'G/1001 Ω',
    'G/100.1 Ω',
  ],
  // CBSE 2023-24 (55/1/1), Q7
  [
    'The reactance of a capacitor of capacitance C connected to an ac source of frequency ω is ‘X’. If the capacitance of the capacitor is doubled and the frequency of the source is tripled, the reactance will become',
    'X/6',
    '6X',
    '(2/3)X',
    '(3/2)X',
  ],
  // CBSE 2023-24 (55/1/1), Q8
  [
    'In the four regions, I, II, III and IV, the electric fields are described as: Region I: Eₓ = E₀ sin (kz − ωt); Region II: Eₓ = E₀; Region III: Eₓ = E₀ sin kz; Region IV: Eₓ = E₀ cos kz. The displacement current will exist in the region',
    'I',
    'II',
    'III',
    'IV',
  ],
  // CBSE 2023-24 (55/1/1), Q9
  [
    'The transition of electron that gives rise to the formation of the second spectral line of the Balmer series in the spectrum of hydrogen atom corresponds to',
    'n_f = 2 and n_i = 4',
    'n_f = 2 and n_i = 3',
    'n_f = 3 and n_i = 4',
    'n_f = 2 and n_i = ∞',
  ],
  // CBSE 2023-24 (55/1/1), Q10
  [
    'Ge is doped with As. Due to doping,',
    'the number of conduction electrons increases',
    'the structure of Ge lattice is distorted',
    'the number of holes increases',
    'the number of conduction electrons decreases',
  ],
  // CBSE 2023-24 (55/1/1), Q11
  [
    'Two beams, A and B whose photon energies are 3.3 eV and 11.3 eV respectively, illuminate a metallic surface (work function 2.3 eV) successively. The ratio of maximum speed of electrons emitted due to beam A to that due to beam B is',
    '1/3',
    '3',
    '9',
    '1/9',
  ],
  // CBSE 2023-24 (55/1/1), Q12
  [
    'The waves associated with a moving electron and a moving proton have the same wavelength λ. It implies that they have the same',
    'momentum',
    'angular momentum',
    'speed',
    'energy',
  ],
  // CBSE 2023-24 (55/1/1), Q13
  [
    'Assertion (A): In photoelectric effect, the kinetic energy of the emitted photoelectrons increases with increase in the intensity of the incident light. Reason (R): Photoelectric current depends on the wavelength of the incident light.',
    'Assertion (A) is false and Reason (R) is also false',
    'Both Assertion (A) and Reason (R) are true and Reason (R) is the correct explanation of the Assertion (A)',
    'Both Assertion (A) and Reason (R) are true, but Reason (R) is not the correct explanation of the Assertion (A)',
    'Assertion (A) is true, but Reason (R) is false',
  ],
  // CBSE 2023-24 (55/1/1), Q14
  [
    'Assertion (A): The mutual inductance between two coils is maximum when the coils are wound on each other. Reason (R): The flux linkage between two coils is maximum when they are wound on each other.',
    'Both Assertion (A) and Reason (R) are true and Reason (R) is the correct explanation of the Assertion (A)',
    'Both Assertion (A) and Reason (R) are true, but Reason (R) is not the correct explanation of the Assertion (A)',
    'Assertion (A) is true, but Reason (R) is false',
    'Assertion (A) is false and Reason (R) is also false',
  ],
  // CBSE 2023-24 (55/1/1), Q15
  [
    'Assertion (A): Two long parallel wires, freely suspended and connected in series to a battery, move apart. Reason (R): Two wires carrying current in opposite directions repel each other.',
    'Both Assertion (A) and Reason (R) are true and Reason (R) is the correct explanation of the Assertion (A)',
    'Both Assertion (A) and Reason (R) are true, but Reason (R) is not the correct explanation of the Assertion (A)',
    'Assertion (A) is true, but Reason (R) is false',
    'Assertion (A) is false and Reason (R) is also false',
  ],
  // CBSE 2023-24 (55/1/1), Q16
  [
    'Assertion (A): Plane and convex mirrors cannot produce real images under any circumstance. Reason (R): A virtual image cannot serve as an object to produce a real image.',
    'Assertion (A) is false and Reason (R) is also false',
    'Both Assertion (A) and Reason (R) are true and Reason (R) is the correct explanation of the Assertion (A)',
    'Both Assertion (A) and Reason (R) are true, but Reason (R) is not the correct explanation of the Assertion (A)',
    'Assertion (A) is true, but Reason (R) is false',
  ],
  // CBSE 2025-26 (55/1/1), Q1
  [
    'In a region, the electric potential varies as V = 10 − 50x, where V is in volts and x in meters. The electric field in the region is',
    '50 N/C along +x',
    '10 N/C along +x',
    '10 N/C along −x',
    '50 N/C along −x',
  ],
  // CBSE 2025-26 (55/1/1), Q2
  [
    'A conducting wire connects two charged metallic spheres A and B of radii r₁ and r₂ respectively. The distance between the spheres is very large compared to their radii. The ratio of electric fields (E_A/E_B) at the surfaces of spheres A and B will be',
    'r₂/r₁',
    'r₁/r₂',
    'r₁²/r₂²',
    'r₂²/r₁²',
  ],
  // CBSE 2025-26 (55/1/1), Q3
  [
    'A long straight wire of circular cross-section (radius a) carries a steady current I. The current is uniformly distributed across this cross-section. The magnitude of the magnetic field produced at a point at a distance (a/2) from the axis of the wire will be',
    'μ₀I/(4πa)',
    'Zero',
    'μ₀I/(2πa)',
    'μ₀I/(6πa)',
  ],
  // CBSE 2025-26 (55/1/1), Q5
  [
    'An electromagnetic wave passes from vacuum into a dielectric medium with relative electrical permittivity (3/2) and relative magnetic permeability (8/3). Then, its',
    'wavelength is halved and frequency remains unchanged',
    'wavelength is doubled and frequency remains unchanged',
    'wavelength is doubled and frequency is halved',
    'wavelength and frequency both will remain unchanged',
  ],
  // CBSE 2025-26 (55/1/1), Q6
  [
    'In a series LCR circuit, the voltage across the resistor, capacitor and inductor is 10 V each. If the capacitor is short circuited, the voltage across the inductor will be',
    '5√2 V',
    '10 V',
    '5/√2 V',
    '10√2 V',
  ],
  // CBSE 2025-26 (55/1/1), Q8
  [
    'The ‘distance of closest approach’ of an alpha-particle is ‘d’ when it moves with a velocity v head-on towards the target nucleus. If the velocity of alpha particle is halved, the new ‘distance of closest approach’ will be',
    '4d',
    'd/2',
    '2d',
    'd/4',
  ],
];

const CLASS_12_CHEMISTRY: readonly Row[] = [
  // CBSE 2025-26 (56/1/1), Q2
  [
    'Which of the following solutions will have the lowest freezing point in water?',
    '0.1 M CaCl₂',
    '0.1 M Glucose',
    '0.1 M KCl',
    '0.1 M Urea',
  ],
  // CBSE 2025-26 (56/1/1), Q3
  ['Which of the following is not a transition metal?', 'Hg', 'Sc', 'Ag', 'Cu'],
  // CBSE 2025-26 (56/1/1), Q4
  [
    'Which of the following represents the fraction of molecules with energies equal to or greater than Eₐ?',
    'e^(−Eₐ/RT)',
    '+Eₐ/RT',
    '−Eₐ/RT',
    'e^(+Eₐ/RT)',
  ],
  // CBSE 2025-26 (56/1/1), Q5
  [
    'What will happen during the electrolysis of aqueous solution of CuCl₂ by using platinum electrodes?',
    'Cl₂ gas will be released at anode',
    'Cu will deposit at Anode',
    'H₂ gas will be released at cathode',
    'O₂ gas will be released at anode',
  ],
  // CBSE 2025-26 (56/1/1), Q6
  [
    'Aspirin is obtained by acetylation of',
    '2-Hydroxybenzoic acid',
    'Phenol',
    'Salicylaldehyde',
    'Benzoic acid',
  ],
  // CBSE 2025-26 (56/1/1), Q7
  [
    'The secondary valency of Co in the complex [Co(NH₃)₅(NO₂)]²⁺ is',
    '6',
    '5',
    '1',
    '4',
  ],
  // CBSE 2025-26 (56/1/1), Q8
  [
    'At low temperature, phenol reacts with dil. HNO₃ to yield',
    'ortho- and para-nitrophenol',
    '2, 4, 6-Trinitrophenol',
    'o-Nitrophenol only',
    'p-Nitrophenol only',
  ],
  // CBSE 2025-26 (56/1/1), Q9
  [
    'Which of the following is ‘not’ true about enantiomers?',
    'They have the same specific rotation',
    'They have the same chemical reactivity',
    'They have the same melting or boiling point',
    'They have the same refractive index',
  ],
  // CBSE 2025-26 (56/1/1), Q10
  [
    'Aniline on direct nitration yields',
    '51%-para, 47%-meta, 2%-ortho derivatives',
    '51%-ortho, 47%-para, 2%-meta derivatives',
    '51%-meta, 47%-ortho, 2%-para derivatives',
    '51%-ortho, 47%-meta, 2%-para derivatives',
  ],
  // CBSE 2025-26 (56/1/1), Q11
  [
    'Which of the following amines has lowest pK_b value?',
    'C₆H₅–N(CH₃)₂',
    'C₆H₅–NH(CH₃)',
    'C₆H₅–NH₂',
    'p-O₂N–C₆H₄–NH₂',
  ],
  // CBSE 2025-26 (56/1/1), Q12
  [
    'The deficiency of which of the following vitamins causes increased fragility of red blood cells and muscular weakness?',
    'Vitamin E',
    'Vitamin A',
    'Vitamin K',
    'Vitamin D',
  ],
  // CBSE 2025-26 (56/1/1), Q13
  [
    'Assertion (A): It is not possible to separate the components of an azeotrope by fractional distillation. Reason (R): Components of an azeotrope have the same composition in liquid and vapour phase and boil at a constant temperature.',
    'Both Assertion (A) and Reason (R) are true and Reason (R) is the correct explanation of the Assertion (A)',
    'Both Assertion (A) and Reason (R) are true, but Reason (R) is not the correct explanation of the Assertion (A)',
    'Assertion (A) is true, but Reason (R) is false',
    'Assertion (A) is false, but Reason (R) is true',
  ],
  // CBSE 2025-26 (56/1/1), Q14
  [
    'Assertion (A): The presence of –OH group in phenols directs the incoming group to meta position in the ring. Reason (R): –OH group in phenols activates the aromatic ring towards electrophilic substitution reaction.',
    'Assertion (A) is false, but Reason (R) is true',
    'Both Assertion (A) and Reason (R) are true and Reason (R) is the correct explanation of the Assertion (A)',
    'Both Assertion (A) and Reason (R) are true, but Reason (R) is not the correct explanation of the Assertion (A)',
    'Assertion (A) is true, but Reason (R) is false',
  ],
  // CBSE 2025-26 (56/1/1), Q15
  [
    'Assertion (A): Actinoids show wide range of oxidation states. Reason (R): Actinoids are radioactive in nature.',
    'Both Assertion (A) and Reason (R) are true, but Reason (R) is not the correct explanation of the Assertion (A)',
    'Both Assertion (A) and Reason (R) are true and Reason (R) is the correct explanation of the Assertion (A)',
    'Assertion (A) is true, but Reason (R) is false',
    'Assertion (A) is false, but Reason (R) is true',
  ],
  // CBSE 2025-26 (56/1/1), Q16
  [
    'Assertion (A): The pentaacetate of glucose does not react with H₂N–OH. Reason (R): It indicates the presence of free –CHO group in glucose.',
    'Assertion (A) is true, but Reason (R) is false',
    'Both Assertion (A) and Reason (R) are true and Reason (R) is the correct explanation of the Assertion (A)',
    'Both Assertion (A) and Reason (R) are true, but Reason (R) is not the correct explanation of the Assertion (A)',
    'Assertion (A) is false, but Reason (R) is true',
  ],
  // CBSE 2023-24 (56/1/1), Q3
  [
    'Two among the three components of DNA are β-D-2-deoxyribose and a heterocyclic base. The third component is',
    'Phosphoric acid',
    'Adenine',
    'Sulphuric acid',
    'Uracil',
  ],
  // CBSE 2023-24 (56/1/1), Q4
  [
    'For an electrolyte undergoing association in a solvent, the van’t Hoff factor',
    'is always less than one',
    'is always greater than one',
    'has negative value',
    'has zero value',
  ],
  // CBSE 2023-24 (56/1/1), Q7
  [
    'Acetic acid reacts with PCl₅ to give',
    'CH₃–COCl',
    'Cl–CH₂–COCl',
    'Cl–CH₂–COOH',
    'CCl₃–COOH',
  ],
  // CBSE 2023-24 (56/1/1), Q8
  [
    'The formation of cyanohydrin from an aldehyde is an example of',
    'nucleophilic addition',
    'electrophilic addition',
    'nucleophilic substitution',
    'electrophilic substitution',
  ],
  // CBSE 2023-24 (56/1/1), Q10
  [
    'The reaction of an alkyl halide with sodium alkoxide forming ether is known as',
    'Williamson synthesis',
    'Wurtz reaction',
    'Reimer-Tiemann reaction',
    'Kolbe reaction',
  ],
];

const CLASS_12_MATHEMATICS: readonly Row[] = [
  // CBSE 2025-26 (65/1/1), Q1
  [
    'If 2 cos⁻¹x = y, then',
    '0 ≤ y ≤ 2π',
    '0 ≤ y ≤ π',
    '−π ≤ y ≤ π',
    '−π ≤ y ≤ 0',
  ],
  // CBSE 2025-26 (65/1/1), Q2
  [
    'Which of the following cannot be the order of a row-matrix?',
    '2 × 1',
    '1 × 2',
    '1 × 1',
    '1 × n',
  ],
  // CBSE 2025-26 (65/1/1), Q3
  [
    'Which of the following properties is/are true for two matrices of suitable orders? (i) (A + B)′ = A′ + B′ (ii) (A − B)′ = B′ − A′ (iii) (AB)′ = A′B′ (iv) (kAB)′ = kB′A′ (k is a scalar)',
    '(i) and (iv)',
    '(i) only',
    '(i), (ii) and (iii)',
    '(i) and (ii)',
  ],
  // CBSE 2025-26 (65/1/1), Q4
  [
    'If Δ₁ and Δ₂ are the determinants shown, then',
    'Δ₂ = −2Δ₁',
    'Δ₁ = 2Δ₂',
    'Δ₁ = Δ₂',
    'Δ₂ = −Δ₁',
    {
      kind: 'matrices',
      items: [
        {
          name: 'Δ₁',
          determinant: true,
          rows: [
            ['1', '0', '0'],
            ['0', '2', '0'],
            ['0', '0', '3'],
          ],
        },
        {
          name: 'Δ₂',
          determinant: true,
          rows: [
            ['0', '2', '0'],
            ['1', '0', '0'],
            ['0', '0', '6'],
          ],
        },
      ],
    },
  ],
  // CBSE 2025-26 (65/1/1), Q5
  [
    'One of the values of x for which the determinant shown equals 1 is',
    'π/4',
    '0',
    'π/3',
    'π/2',
    {
      kind: 'matrices',
      items: [
        {
          name: 'Δ',
          determinant: true,
          rows: [
            ['cos x', 'sin x'],
            ['−cos x', 'sin x'],
          ],
        },
      ],
    },
  ],
  // CBSE 2025-26 (65/1/1), Q6
  [
    'If A and B are skew symmetric matrices of same order, then which of the following matrices is also skew symmetric?',
    'A − B',
    'AB',
    'AB + BA',
    '(A + B)²',
  ],
  // CBSE 2025-26 (65/1/1), Q7
  ['The least value of f(x) = x³ − 12x, x ∈ [0, 3] is', '−16', '−9', '0', '16'],
  // CBSE 2025-26 (65/1/1), Q8
  [
    'If ∫ 3ax/(b² + c²x²) dx = A log|b² + c²x²| + K, then the value of A is',
    '3a/(2c²)',
    '3a',
    '3a/(2b²)',
    '3a/(b²c²)',
  ],
  // CBSE 2025-26 (65/1/1), Q9
  [
    'The value of the integral of x³/(x² + 2|x| + 1) dx from x = −1 to x = 1 is',
    '0',
    'log 2',
    '2 log 2',
    '(1/2) log 2',
  ],
  // CBSE 2025-26 (65/1/1), Q10
  [
    'The area bounded by the curve y = x|x|, x-axis and the ordinates x = −1 and x = 1 is given by',
    '2/3',
    '0',
    '1/3',
    '4/3',
  ],
  // CBSE 2025-26 (65/1/1), Q11
  [
    'The integrating factor of differential equation R(dx/dy) + Px = Q, where P, Q, R are functions of y, is',
    'e^(∫(P/R) dy)',
    'e^(∫(P/Q) dy)',
    'e^(∫P dy)',
    'e^(∫(P/R) dx)',
  ],
  // CBSE 2025-26 (65/1/1), Q12
  [
    'The order and degree of the differential equation d/dx(eʸ) = 0 respectively are',
    '1, 1',
    '0, 1',
    '2, 1',
    '1, not defined',
  ],
  // CBSE 2025-26 (65/1/1), Q13
  [
    'The value of p for which vectors î + 2ĵ + 3k̂ and 2î − pĵ + k̂ are perpendicular to each other is',
    '5/2',
    '0',
    '1',
    '−5/2',
  ],
  // CBSE 2025-26 (65/1/1), Q14
  [
    'The value of m for which the points with position vectors −î − ĵ + 2k̂, 2î + mĵ + 5k̂ and 3î + 11ĵ + 6k̂ are collinear, is',
    '8',
    '−8',
    '2',
    '5/2',
  ],
  // CBSE 2025-26 (65/1/1), Q15
  [
    'If |a| = 8, |b| = 3 and |a × b| = 12, then the value of |a · b| is',
    '12√3',
    '6√3',
    '8√3',
    '3√12',
  ],
  // CBSE 2025-26 (65/1/1), Q16
  [
    'The length of perpendicular drawn from point (2, 5, 7) on line x/1 = y/0 = z/0 is',
    '√74',
    '2',
    '5',
    '√78',
  ],
  // CBSE 2025-26 (65/1/1), Q17
  [
    'The feasible region of a linear programming problem with objective function Z = 5x + 7y is shown. The maximum value of Z − minimum value of Z is',
    '43',
    '8',
    '29',
    '35',
    {
      kind: 'region',
      corners: [
        [0, 0],
        [0, 2],
        [3, 4],
        [7, 0],
      ],
      xMax: 8,
      yMax: 5,
    },
  ],
  // CBSE 2025-26 (65/1/1), Q18
  [
    'The degree of an objective function of a linear programming problem is',
    '1',
    '0',
    '2',
    'Any natural number',
  ],
  // CBSE 2025-26 (65/1/1), Q19
  [
    'Assertion (A): In an experiment of throwing an unbiased die, the probability of getting a prime number given that number appearing on the die being odd is 2/3. Reason (R): For any two events A and B, P(A|B) = P(A ∪ B)/P(B).',
    'Assertion (A) is true and Reason (R) is false',
    'Both Assertion (A) and Reason (R) are true and the Reason (R) is the correct explanation of the Assertion (A)',
    'Both Assertion (A) and Reason (R) are true, but Reason (R) is not the correct explanation of the Assertion (A)',
    'Assertion (A) is false and Reason (R) is true',
  ],
  // CBSE 2025-26 (65/1/1), Q20
  [
    'Assertion (A): Lines given by x = py + q, z = ry + s and x = p′y + q′, z = r′y + s′ are perpendicular to each other when pp′ + rr′ = 1. Reason (R): Two lines r = a₁ + λb₁ and r = a₂ + μb₂ are perpendicular to each other if b₁ · b₂ = 0.',
    'Assertion (A) is false and Reason (R) is true',
    'Both Assertion (A) and Reason (R) are true and the Reason (R) is the correct explanation of the Assertion (A)',
    'Both Assertion (A) and Reason (R) are true, but Reason (R) is not the correct explanation of the Assertion (A)',
    'Assertion (A) is true and Reason (R) is false',
  ],
];

const CLASS_12_BIOLOGY: readonly Row[] = [
  // CBSE 2025-26 (57/1/1), Q1
  [
    'Identify the plant in which emasculation is not required for artificial hybridization',
    'Papaya',
    'Rice',
    'Wheat',
    'Pea',
  ],
  // CBSE 2025-26 (57/1/1), Q2
  [
    'Which of the following is not a component of immune system?',
    'Red Blood Cells',
    'Lymphocytes',
    'Plasma Proteins',
    'Bone Marrow',
  ],
  // CBSE 2025-26 (57/1/1), Q3
  [
    'Select the option that shows correct statements: (i) Corpus luteum secretes progesterone. (ii) Only FSH attains a peak level in middle of cycle. (iii) LH surge induces rupture of graafian follicle. (iv) Luteal phase of menstrual cycle is also called proliferative phase.',
    '(i) and (iii) are correct',
    'Only (ii) is correct',
    'Only (iv) is correct',
    '(ii) and (iv) are correct',
  ],
  // CBSE 2025-26 (57/1/1), Q4
  [
    'Select the mismatched pair',
    'Genetically different strains of rice in India – Less than 1000',
    'Mega diversity countries in the world – 12',
    'Robert May’s estimation on global species diversity – 7 million species worldwide',
    'Zoological parks – Ex-situ conservation',
  ],
  // CBSE 2025-26 (57/1/1), Q5
  [
    'Pomato was produced by fusing protoplasts of',
    'Tomato and Potato',
    'Pomegranate and Tomato',
    'Pomegranate and Potato',
    'Pomegranate, Potato and Tomato',
  ],
  // CBSE 2025-26 (57/1/1), Q6
  [
    'In an ecosystem, different species occupy different levels and vertical distribution of species is found. This is called ______',
    'Stratification',
    'Layering',
    'Fragmentation',
    'Population',
  ],
  // CBSE 2025-26 (57/1/1), Q7
  [
    'Which of the following sacred groves is found in Meghalaya?',
    'Jaintia hills',
    'Bastar',
    'Chanda',
    'Sarguja',
  ],
  // CBSE 2025-26 (57/1/1), Q8
  [
    'The figure shows two ways in which two homologous pairs of chromosomes can line up at Metaphase I. Which of the following phenomena is expressed?',
    'Independent assortment of genes',
    'Linkage of genes',
    'Multiple alleles',
    'Incomplete dominance',
    { kind: 'diagram', name: 'metaphase' },
  ],
  // CBSE 2025-26 (57/1/1), Q9
  [
    'Match Column-I with Column-II and choose the correct option',
    'a–v, b–iv, c–ii, d–i',
    'a–i, b–ii, c–iii, d–iv',
    'a–ii, b–v, c–i, d–iii',
    'a–v, b–i, c–iv, d–ii',
    {
      kind: 'table',
      head: ['Column-I', 'Column-II'],
      rows: [
        ['a. Biolistic gun', 'i. Bacterial cell'],
        ['b. Chitinase', 'ii. Tumour inducing'],
        ['c. Ti', 'iii. Animal cell'],
        ['d. Ca⁺⁺', 'iv. Fungal cell'],
        ['', 'v. Plant cell'],
      ],
    },
  ],
  // CBSE 2025-26 (57/1/1), Q10
  [
    'The idea of use and disuse of organs for evolution of organism was proposed by',
    'Lamarck',
    'Charles Darwin',
    'Thomas Malthus',
    'Hugo De Vries',
  ],
  // CBSE 2025-26 (57/1/1), Q11
  [
    'Which of the following statements about plasmids is incorrect?',
    'Their replication is controlled by chromosomal DNA',
    'Plasmids have the ability to replicate within the bacterial cell',
    'They are autonomously replicating circular extra-chromosomal DNA',
    'They often carry antibiotic resistant genes',
  ],
  // CBSE 2025-26 (57/1/1), Q12
  [
    'Which connective tissue connects ovary to pelvic wall and uterus?',
    'Ligaments',
    'Tendons',
    'Cartilage',
    'Bone',
  ],
  // CBSE 2025-26 (57/1/1), Q13
  [
    'Assertion (A): The population of melanized moths increased in industrial areas after Industrial Revolution. Reason (R): In Industrial environment lichen covered trees were replaced by soot-covered trees offering better camouflage to dark coloured moths.',
    'Both Assertion (A) and Reason (R) are true and Reason (R) is the correct explanation for Assertion (A)',
    'Both Assertion (A) and Reason (R) are true, but Reason (R) is not the correct explanation for Assertion (A)',
    'Assertion (A) is true, but Reason (R) is false',
    'Assertion (A) is false, but Reason (R) is true',
  ],
  // CBSE 2025-26 (57/1/1), Q15
  [
    'Assertion (A): Flocs are masses of bacteria associated with fungal filaments in secondary treatment of sewage. Reason (R): Flocs help in digestion of solid waste by anaerobic respiration.',
    'Assertion (A) is true, but Reason (R) is false',
    'Both Assertion (A) and Reason (R) are true and Reason (R) is the correct explanation for Assertion (A)',
    'Both Assertion (A) and Reason (R) are true, but Reason (R) is not the correct explanation for Assertion (A)',
    'Assertion (A) is false, but Reason (R) is true',
  ],
  // CBSE 2025-26 (57/1/1), Q16
  [
    'Assertion (A): In terrestrial ecosystem much larger fraction of energy flows through grazing food chain. Reason (R): Grazing food chain may be connected to Detritus food chain at some levels.',
    'Assertion (A) is false, but Reason (R) is true',
    'Both Assertion (A) and Reason (R) are true and Reason (R) is the correct explanation for Assertion (A)',
    'Both Assertion (A) and Reason (R) are true, but Reason (R) is not the correct explanation for Assertion (A)',
    'Assertion (A) is true, but Reason (R) is false',
  ],
  // CBSE 2023-24 (57/1/1), Q1
  [
    'In which of the following plants are both male and female flowers borne on the same plant and the mode of pollination can be geitonogamy or xenogamy?',
    'Maize',
    'Papaya',
    'Date Palm',
    'Spinach',
  ],
  // CBSE 2023-24 (57/1/1), Q3
  [
    'The periodic abstinence by a couple for family planning should be from',
    'Day 10 to 17 of menstrual cycle',
    'Day 5 to 10 of menstrual cycle',
    'Day 13 to 15 of menstrual cycle',
    'Day 16 to 20 of menstrual cycle',
  ],
  // CBSE 2023-24 (57/1/1), Q7
  [
    'In which of the following conditions/diseases is there a substantial increase in the activity of mast cells observed in the human body?',
    'Allergy',
    'Typhoid',
    'Ascariasis',
    'AIDS',
  ],
  // CBSE 2023-24 (57/1/1), Q9
  [
    'Which one of the following transgenic animals is being used to test the safety of the polio vaccine?',
    'Mice',
    'Sheep',
    'Goat',
    'Pig',
  ],
  // CBSE 2023-24 (57/1/1), Q11
  [
    'The improved trait that is found in the genetically modified transgenic crop – Golden rice is',
    'High vitamin-A content',
    'High lysine content',
    'Insect resistant',
    'High protein content',
  ],
];

// JEE

const JEE_PHYSICS: readonly Row[] = [
  // JEE (Advanced) 2016 Paper 1, Q1
  [
    'In a historical experiment to determine Planck’s constant, a metal surface was irradiated with light of different wavelengths. The emitted photoelectron energies were measured by applying a stopping potential. The relevant data for the wavelength (λ) of incident light and the corresponding stopping potential (V₀) are given in the table. Given that c = 3 × 10⁸ m s⁻¹ and e = 1.6 × 10⁻¹⁹ C, Planck’s constant (in units of J s) found from such an experiment is',
    '6.4 × 10⁻³⁴',
    '6.0 × 10⁻³⁴',
    '6.6 × 10⁻³⁴',
    '6.8 × 10⁻³⁴',
    {
      kind: 'table',
      head: ['λ (μm)', 'V₀ (volt)'],
      rows: [
        ['0.3', '2.0'],
        ['0.4', '1.0'],
        ['0.5', '0.4'],
      ],
    },
  ],
  // JEE (Advanced) 2016 Paper 1, Q3
  [
    'A water cooler of storage capacity 120 litres can cool water at a constant rate of P watts. In a closed circulation system (as shown in the figure), the water from the cooler is used to cool an external device that generates constantly 3 kW of heat (thermal load). The temperature of water fed into the device cannot exceed 30 °C and the entire stored 120 litres of water is initially cooled to 10 °C. The entire system is thermally insulated. The minimum value of P (in watts) for which the device can be operated for 3 hours is (specific heat of water is 4.2 kJ kg⁻¹ K⁻¹ and the density of water is 1000 kg m⁻³)',
    '2067',
    '1600',
    '2533',
    '3933',
    { kind: 'diagram', name: 'waterCooler' },
  ],
  // JEE (Advanced) 2016 Paper 2, Q1
  [
    'The electrostatic energy of Z protons uniformly distributed throughout a spherical nucleus of radius R is given by E = (3/5) Z(Z − 1)e² / (4πε₀R). The measured masses of the neutron, ¹H, ¹⁵N and ¹⁵O are 1.008665 u, 1.007825 u, 15.000109 u and 15.003065 u, respectively. Given that the radii of both the ¹⁵N and ¹⁵O nuclei are the same, 1 u = 931.5 MeV/c² and e²/(4πε₀) = 1.44 MeV fm. Assuming that the difference between the binding energies of ¹⁵N and ¹⁵O is purely due to the electrostatic energy, the radius of either of the nuclei is (1 fm = 10⁻¹⁵ m)',
    '3.42 fm',
    '2.85 fm',
    '3.03 fm',
    '3.80 fm',
  ],
  // JEE (Advanced) 2016 Paper 2, Q2
  [
    'An accident in a nuclear laboratory resulted in deposition of a certain amount of radioactive material of half-life 18 days inside the laboratory. Tests revealed that the radiation was 64 times more than the permissible level required for safe operation of the laboratory. What is the minimum number of days after which the laboratory can be considered safe for use?',
    '108',
    '64',
    '90',
    '120',
  ],
  // JEE (Advanced) 2016 Paper 2, Q3
  [
    'A gas is enclosed in a cylinder with a movable frictionless piston. Its initial thermodynamic state at pressure Pᵢ = 10⁵ Pa and volume Vᵢ = 10⁻³ m³ changes to a final state at P_f = (1/32) × 10⁵ Pa and V_f = 8 × 10⁻³ m³ in an adiabatic quasi-static process, such that P³V⁵ = constant. Consider another thermodynamic process that brings the system from the same initial state to the same final state in two steps: an isobaric expansion at Pᵢ followed by an isochoric (isovolumetric) process at volume V_f. The amount of heat supplied to the system in the two-step process is approximately',
    '588 J',
    '112 J',
    '294 J',
    '813 J',
  ],
  // JEE (Advanced) 2016 Paper 2, Q4
  [
    'The ends Q and R of two thin wires, PQ and RS, are soldered (joined) together. Initially each of the wires has a length of 1 m at 10 °C. Now the end P is maintained at 10 °C, while the end S is heated and maintained at 400 °C. The system is thermally insulated from its surroundings. If the thermal conductivity of wire PQ is twice that of the wire RS and the coefficient of linear thermal expansion of PQ is 1.2 × 10⁻⁵ K⁻¹, the change in length of the wire PQ is',
    '0.78 mm',
    '0.90 mm',
    '1.56 mm',
    '2.34 mm',
  ],
  // JEE (Advanced) 2016 Paper 2, Q8
  [
    'Light of wavelength λₚₕ falls on a cathode plate inside a vacuum tube as shown in the figure. The work function of the cathode surface is φ and the anode is a wire mesh of conducting material kept at a distance d from the cathode. A potential difference V is maintained between the electrodes. If the minimum de Broglie wavelength of the electrons passing through the anode is λₑ, which of the following statements is true?',
    'For large potential difference (V ≫ φ/e), λₑ is approximately halved if V is made four times',
    'λₑ decreases with increase in φ and λₚₕ',
    'λₑ is approximately halved, if d is doubled',
    'λₑ increases at the same rate as λₚₕ for λₚₕ < hc/φ',
    { kind: 'diagram', name: 'photocell' },
  ],
  // JEE (Advanced) 2016 Paper 2, Q17 (Paragraph 2)
  [
    'Consider an evacuated cylindrical chamber of height h having rigid conducting plates at the ends and an insulating curved surface as shown in the figure. A number of spherical balls made of a light weight and soft material and coated with a conducting material are placed on the bottom plate. The balls have a radius r ≪ h. Now a high voltage source (HV) is connected across the conducting plates such that the bottom plate is at +V₀ and the top plate at −V₀. Due to their conducting surface, the balls will get charged, will become equipotential with the plate and are repelled by it. The balls will eventually collide with the top plate, where the coefficient of restitution can be taken to be zero due to the soft nature of the material of the balls. The electric field in the chamber can be considered to be that of a parallel plate capacitor. Assume that there are no collisions between the balls and the interaction between them is negligible (ignore gravity). Which one of the following statements is correct?',
    'The balls will bounce back to the bottom plate carrying the opposite charge they went up with',
    'The balls will stick to the top plate and remain there',
    'The balls will bounce back to the bottom plate carrying the same charge they went up with',
    'The balls will execute simple harmonic motion between the two plates',
    { kind: 'diagram', name: 'chargedBalls' },
  ],
  // JEE (Advanced) 2016 Paper 2, Q18 (Paragraph 2)
  [
    'In the evacuated cylindrical chamber shown, light conducting balls of radius r ≪ h rest on the bottom plate. The bottom plate is held at +V₀ and the top plate at −V₀, so the balls pick up charge, are repelled to the top plate (where the collision is perfectly inelastic), and keep carrying charge between the plates. Treating the field as that of a parallel plate capacitor and ignoring gravity, the average current in the steady state registered by the ammeter in the circuit will be',
    'proportional to V₀²',
    'zero',
    'proportional to the potential V₀',
    'proportional to V₀^(1/2)',
    { kind: 'diagram', name: 'chargedBalls' },
  ],
  // JEE (Advanced) 2017 Paper 2, Q1
  [
    'Consider an expanding sphere of instantaneous radius R whose total mass remains constant. The expansion is such that the instantaneous density ρ remains uniform throughout the volume. The rate of fractional change in density (1/ρ)(dρ/dt) is constant. The velocity v of any point on the surface of the expanding sphere is proportional to',
    'R',
    'R³',
    '1/R',
    'R^(2/3)',
  ],
  // JEE (Advanced) 2017 Paper 2, Q3
  [
    'A photoelectric material having work-function φ₀ is illuminated with light of wavelength λ (λ < hc/φ₀). The fastest photoelectron has a de Broglie wavelength λ_d. A change in wavelength of the incident light by Δλ results in a change Δλ_d in λ_d. Then the ratio Δλ_d/Δλ is proportional to',
    'λ_d³/λ²',
    'λ_d/λ',
    'λ_d²/λ²',
    'λ_d³/λ',
  ],
  // JEE (Advanced) 2017 Paper 2, Q6
  [
    'A rocket is launched normal to the surface of the Earth, away from the Sun, along the line joining the Sun and the Earth. The Sun is 3 × 10⁵ times heavier than the Earth and is at a distance 2.5 × 10⁴ times larger than the radius of the Earth. The escape velocity from Earth’s gravitational field is vₑ = 11.2 km s⁻¹. The minimum initial velocity (v_s) required for the rocket to be able to leave the Sun-Earth system is closest to (ignore the rotation and revolution of the Earth and the presence of any other planet)',
    'v_s = 42 km s⁻¹',
    'v_s = 22 km s⁻¹',
    'v_s = 62 km s⁻¹',
    'v_s = 72 km s⁻¹',
  ],
  // JEE (Advanced) 2017 Paper 2, Q7
  [
    'A person measures the depth of a well by measuring the time interval between dropping a stone and receiving the sound of impact with the bottom of the well. The error in his measurement of time is δT = 0.01 seconds and he measures the depth of the well to be L = 20 meters. Take the acceleration due to gravity g = 10 m s⁻² and the velocity of sound is 300 m s⁻¹. Then the fractional error in the measurement, δL/L, is closest to',
    '1%',
    '0.2%',
    '3%',
    '5%',
  ],
  // JEE (Advanced) 2018 Paper 1, Q15 (Paragraph X)
  [
    'In electromagnetic theory, the electric and magnetic phenomena are related to each other, so the dimensions of electric and magnetic quantities must also be related. If [E] and [B] stand for the dimensions of electric and magnetic fields, and [L] and [T] for the dimensions of length and time (all in SI units), the relation between [E] and [B] is',
    '[E] = [B][L][T]⁻¹',
    '[E] = [B][L][T]',
    '[E] = [B][L]⁻¹[T]',
    '[E] = [B][L]⁻¹[T]⁻¹',
  ],
  // JEE (Advanced) 2018 Paper 1, Q16 (Paragraph X)
  [
    'In electromagnetic theory, the electric and magnetic phenomena are related to each other, so the dimensions of electric and magnetic quantities must also be related. If [ε₀] and [μ₀] stand for the dimensions of the permittivity and permeability of free space, and [L] and [T] for the dimensions of length and time (all in SI units), the relation between [ε₀] and [μ₀] is',
    '[μ₀] = [ε₀]⁻¹[L]⁻²[T]²',
    '[μ₀] = [ε₀][L]²[T]⁻²',
    '[μ₀] = [ε₀][L]⁻²[T]²',
    '[μ₀] = [ε₀]⁻¹[L]²[T]⁻²',
  ],
  // JEE (Advanced) 2018 Paper 1, Q17 (Paragraph A)
  [
    'Consider the ratio r = (1 − a)/(1 + a) to be determined by measuring a dimensionless quantity a. If the error in the measurement of a is Δa (Δa/a ≪ 1), then what is the error Δr in determining r?',
    '2Δa/(1 + a)²',
    'Δa/(1 + a)²',
    '2Δa/(1 − a²)',
    '2aΔa/(1 − a²)',
  ],
  // JEE (Advanced) 2018 Paper 1, Q18 (Paragraph A)
  [
    'In an experiment the initial number of radioactive nuclei is 3000. It is found that 1000 ± 40 nuclei decayed in the first 1.0 s. For |x| ≪ 1, ln(1 + x) = x up to first power in x. The error Δλ, in the determination of the decay constant λ, in s⁻¹, is',
    '0.02',
    '0.04',
    '0.03',
    '0.01',
  ],
  // JEE (Advanced) 2018 Paper 2, Q15
  [
    'The electric field E is measured at a point P(0, 0, d) generated due to various charge distributions, and the dependence of E on d is found to be different for different charge distributions. List-I contains different relations between E and d. List-II describes different electric charge distributions, along with their locations. Match the functions in List-I with the related charge distributions in List-II',
    'P → 5; Q → 3; R → 1, 4; S → 2',
    'P → 5; Q → 3, 4; R → 1; S → 2',
    'P → 5; Q → 3; R → 1, 2; S → 4',
    'P → 4; Q → 2, 3; R → 1; S → 5',
    {
      kind: 'table',
      head: ['List-I', 'List-II'],
      rows: [
        ['P. E is independent of d', '1. A point charge Q at the origin'],
        [
          'Q. E ∝ 1/d',
          '2. A small dipole with point charges Q at (0, 0, l) and −Q at (0, 0, −l). Take 2l ≪ d',
        ],
        [
          'R. E ∝ 1/d²',
          '3. An infinite line charge coincident with the x-axis, with uniform linear charge density λ',
        ],
        [
          'S. E ∝ 1/d³',
          '4. Two infinite wires carrying uniform linear charge density parallel to the x-axis. The one along (y = 0, z = l) has a charge density +λ and the one along (y = 0, z = −l) has a charge density −λ. Take 2l ≪ d',
        ],
        [
          '',
          '5. Infinite plane charge coincident with the xy-plane with uniform surface charge density',
        ],
      ],
    },
  ],
  // JEE (Advanced) 2018 Paper 2, Q16
  [
    'A planet of mass M has two natural satellites with masses m₁ and m₂. The radii of their circular orbits are R₁ and R₂ respectively. Ignore the gravitational force between the satellites. Define v₁, L₁, K₁ and T₁ to be, respectively, the orbital speed, angular momentum, kinetic energy and time period of revolution of satellite 1; and v₂, L₂, K₂ and T₂ to be the corresponding quantities of satellite 2. Given m₁/m₂ = 2 and R₁/R₂ = 1/4, match the ratios in List-I to the numbers in List-II',
    'P → 3; Q → 2; R → 4; S → 1',
    'P → 4; Q → 2; R → 1; S → 3',
    'P → 2; Q → 3; R → 1; S → 4',
    'P → 2; Q → 3; R → 4; S → 1',
    {
      kind: 'table',
      head: ['List-I', 'List-II'],
      rows: [
        ['P. v₁/v₂', '1. 1/8'],
        ['Q. L₁/L₂', '2. 1'],
        ['R. K₁/K₂', '3. 2'],
        ['S. T₁/T₂', '4. 8'],
      ],
    },
  ],
  // JEE (Advanced) 2018 Paper 2, Q18
  [
    'In List-I, four different paths of a particle are given as functions of time. In these functions, α and β are positive constants of appropriate dimensions and α ≠ β. In each case, the force acting on the particle is either zero or conservative. In List-II, five physical quantities of the particle are mentioned. Match each path in List-I with those quantities in List-II, which are conserved for that path',
    'P → 1, 2, 3, 4, 5; Q → 2, 5; R → 2, 3, 4, 5; S → 5',
    'P → 1, 2, 3, 4, 5; Q → 3, 5; R → 2, 3, 4, 5; S → 2, 5',
    'P → 2, 3, 4; Q → 5; R → 1, 2, 4; S → 2, 5',
    'P → 1, 2, 3, 5; Q → 2, 5; R → 2, 3, 4, 5; S → 2, 5',
    {
      kind: 'table',
      head: ['List-I', 'List-II'],
      rows: [
        ['P. r(t) = αt î + βt ĵ', '1. linear momentum p'],
        [
          'Q. r(t) = α cos ωt î + β sin ωt ĵ',
          '2. angular momentum L about the origin',
        ],
        ['R. r(t) = α(cos ωt î + sin ωt ĵ)', '3. kinetic energy K'],
        ['S. r(t) = αt î + (β/2)t² ĵ', '4. potential energy U'],
        ['', '5. total energy E'],
      ],
    },
  ],
];

const JEE_CHEMISTRY_TABLE =
  'Columns 1, 2 and 3 of the table contain starting materials, reaction conditions and type of reactions, respectively.';

const JEE_CHEMISTRY_TABLE_FIGURE: SampleTestFigure = {
  kind: 'table',
  head: ['Column 1', 'Column 2', 'Column 3'],
  rows: [
    ['(I) Toluene', '(i) NaOH/Br₂', '(P) Condensation'],
    ['(II) Acetophenone', '(ii) Br₂/hν', '(Q) Carboxylation'],
    ['(III) Benzaldehyde', '(iii) (CH₃CO)₂O/CH₃COOK', '(R) Substitution'],
    ['(IV) Phenol', '(iv) NaOH/CO₂', '(S) Haloform'],
  ],
};

const JEE_CHEMISTRY_KCLO3 =
  'Upon heating KClO₃ in the presence of catalytic amount of MnO₂, a gas W is formed. Excess amount of W reacts with white phosphorus to give X. The reaction of X with pure HNO₃ gives Y and Z.';

const JEE_CHEMISTRY_CALORIMETER =
  'When 100 mL of 1.0 M HCl was mixed with 100 mL of 1.0 M NaOH in an insulated beaker at constant pressure, a temperature increase of 5.7 °C was measured for the beaker and its contents (Expt. 1). Because the enthalpy of neutralization of a strong acid with a strong base is a constant (−57.0 kJ mol⁻¹), this experiment could be used to measure the calorimeter constant. In a second experiment (Expt. 2), 100 mL of 2.0 M acetic acid (Ka = 2.0 × 10⁻⁵) was mixed with 100 mL of 1.0 M NaOH (under identical conditions to Expt. 1) where a temperature rise of 5.6 °C was measured. (Consider heat capacity of all solutions as 4.2 J g⁻¹ K⁻¹ and density of all solutions as 1.0 g mL⁻¹.)';

const JEE_CHEMISTRY: readonly Row[] = [
  // JEE (Advanced) 2015 Paper 1, Q38
  [
    'If the unit cell of a mineral has cubic close packed (ccp) array of oxygen atoms with m fraction of octahedral holes occupied by aluminium ions and n fraction of tetrahedral holes occupied by magnesium ions, m and n, respectively, are',
    '1/2, 1/8',
    '1, 1/4',
    '1/2, 1/2',
    '1/4, 1/8',
  ],
  // JEE (Advanced) 2015 Paper 2, Q39 (Paragraph 2)
  [
    `${JEE_CHEMISTRY_CALORIMETER} Enthalpy of dissociation (in kJ mol⁻¹) of acetic acid obtained from Expt. 2 is`,
    '1.0',
    '10.0',
    '24.5',
    '51.4',
  ],
  // JEE (Advanced) 2015 Paper 2, Q40 (Paragraph 2)
  [
    `${JEE_CHEMISTRY_CALORIMETER} The pH of the solution after Expt. 2 is`,
    '4.7',
    '2.8',
    '5.0',
    '7.0',
  ],
  // JEE (Advanced) 2016 Paper 1, Q20
  [
    'One mole of an ideal gas at 300 K in thermal contact with surroundings expands isothermally from 1.0 L to 2.0 L against a constant pressure of 3.0 atm. In this process, the change in entropy of surroundings (ΔS_surr) in J K⁻¹ is (1 L atm = 101.3 J)',
    '−1.013',
    '5.763',
    '1.013',
    '−5.763',
  ],
  // JEE (Advanced) 2016 Paper 1, Q21
  [
    'The increasing order of atomic radii of the following Group 13 elements is',
    'Ga < Al < In < Tl',
    'Al < Ga < In < Tl',
    'Al < In < Ga < Tl',
    'Al < Ga < Tl < In',
  ],
  // JEE (Advanced) 2016 Paper 1, Q22
  [
    'Among [Ni(CO)₄], [NiCl₄]²⁻, [Co(NH₃)₄Cl₂]Cl, Na₃[CoF₆], Na₂O₂ and CsO₂, the total number of paramagnetic compounds is',
    '3',
    '2',
    '4',
    '5',
  ],
  // JEE (Advanced) 2016 Paper 1, Q23
  [
    'On complete hydrogenation, natural rubber produces',
    'ethylene-propylene copolymer',
    'vulcanised rubber',
    'polypropylene',
    'polybutylene',
  ],
  // JEE (Advanced) 2016 Paper 2, Q19
  [
    'For the electrochemical cell at 298 K, Pt(s) | H₂(g, 1 bar) | H⁺(aq, 1 M) || M⁴⁺(aq), M²⁺(aq) | Pt(s), E_cell = 0.092 V when [M²⁺(aq)]/[M⁴⁺(aq)] = 10ˣ. Given: E°(M⁴⁺/M²⁺) = 0.151 V; 2.303 RT/F = 0.059 V. The value of x is',
    '2',
    '−2',
    '−1',
    '1',
  ],
  // JEE (Advanced) 2016 Paper 2, Q21
  [
    'In aqueous solution, S₂O₃²⁻ reacts with Ag⁺ to give X (a clear solution); X with more Ag⁺ gives Y (a white precipitate), which with time gives Z (a black precipitate). The species X, Y and Z, respectively, are',
    '[Ag(S₂O₃)₂]³⁻, Ag₂S₂O₃, Ag₂S',
    '[Ag(S₂O₃)₃]⁵⁻, Ag₂SO₃, Ag₂S',
    '[Ag(SO₃)₂]³⁻, Ag₂S₂O₃, Ag',
    '[Ag(SO₃)₃]³⁻, Ag₂SO₄, Ag',
  ],
  // JEE (Advanced) 2016 Paper 2, Q22
  [
    'The geometries of the ammonia complexes of Ni²⁺, Pt²⁺ and Zn²⁺, respectively, are',
    'octahedral, square planar and tetrahedral',
    'square planar, octahedral and tetrahedral',
    'tetrahedral, square planar and octahedral',
    'octahedral, tetrahedral and square planar',
  ],
  // JEE (Advanced) 2017 Paper 1, Q34
  [
    `${JEE_CHEMISTRY_TABLE} For the synthesis of benzoic acid, the only correct combination is`,
    '(II) (i) (S)',
    '(IV) (ii) (P)',
    '(I) (iv) (Q)',
    '(III) (iv) (R)',
    JEE_CHEMISTRY_TABLE_FIGURE,
  ],
  // JEE (Advanced) 2017 Paper 1, Q35
  [
    `${JEE_CHEMISTRY_TABLE} The only correct combination that gives two different carboxylic acids is`,
    '(III) (iii) (P)',
    '(II) (iv) (R)',
    '(IV) (iii) (Q)',
    '(I) (i) (S)',
    JEE_CHEMISTRY_TABLE_FIGURE,
  ],
  // JEE (Advanced) 2017 Paper 1, Q36
  [
    `${JEE_CHEMISTRY_TABLE} The only correct combination in which the reaction proceeds through radical mechanism is`,
    '(I) (ii) (R)',
    '(III) (ii) (P)',
    '(IV) (i) (Q)',
    '(II) (iii) (R)',
    JEE_CHEMISTRY_TABLE_FIGURE,
  ],
  // JEE (Advanced) 2017 Paper 2, Q20
  [
    'For the cell Zn(s) | ZnSO₄(aq) || CuSO₄(aq) | Cu(s), when the concentration of Zn²⁺ is 10 times the concentration of Cu²⁺, the expression for ΔG (in J mol⁻¹) is [F is Faraday constant; R is gas constant; T is temperature; E°(cell) = 1.1 V]',
    '2.303RT − 2.2F',
    '1.1F',
    '2.303RT + 1.1F',
    '−2.2F',
  ],
  // JEE (Advanced) 2017 Paper 2, Q21
  [
    'The standard state Gibbs free energies of formation of C(graphite) and C(diamond) at T = 298 K are ΔfG°[C(graphite)] = 0 kJ mol⁻¹ and ΔfG°[C(diamond)] = 2.9 kJ mol⁻¹. The standard state means that the pressure should be 1 bar, and substance should be pure at a given temperature. The conversion of graphite [C(graphite)] to diamond [C(diamond)] reduces its volume by 2 × 10⁻⁶ m³ mol⁻¹. If C(graphite) is converted to C(diamond) isothermally at T = 298 K, the pressure at which C(graphite) is in equilibrium with C(diamond), is [1 J = 1 kg m² s⁻²; 1 Pa = 1 kg m⁻¹ s⁻²; 1 bar = 10⁵ Pa]',
    '14501 bar',
    '58001 bar',
    '1450 bar',
    '29001 bar',
  ],
  // JEE (Advanced) 2017 Paper 2, Q22
  [
    'Which of the following combination will produce H₂ gas?',
    'Zn metal and NaOH(aq)',
    'Fe metal and conc. HNO₃',
    'Cu metal and conc. HNO₃',
    'Au metal and NaCN(aq) in the presence of air',
  ],
  // JEE (Advanced) 2017 Paper 2, Q23
  [
    'The order of the oxidation state of the phosphorus atom in H₃PO₂, H₃PO₄, H₃PO₃ and H₄P₂O₆ is',
    'H₃PO₄ > H₄P₂O₆ > H₃PO₃ > H₃PO₂',
    'H₃PO₃ > H₃PO₂ > H₃PO₄ > H₄P₂O₆',
    'H₃PO₄ > H₃PO₂ > H₃PO₃ > H₄P₂O₆',
    'H₃PO₂ > H₃PO₃ > H₄P₂O₆ > H₃PO₄',
  ],
  // JEE (Advanced) 2017 Paper 2, Q33 (Paragraph 1)
  [
    `${JEE_CHEMISTRY_KCLO3} W and X are, respectively`,
    'O₂ and P₄O₁₀',
    'O₃ and P₄O₆',
    'O₂ and P₄O₆',
    'O₃ and P₄O₁₀',
  ],
  // JEE (Advanced) 2017 Paper 2, Q34 (Paragraph 1)
  [
    `${JEE_CHEMISTRY_KCLO3} Y and Z are, respectively`,
    'N₂O₅ and HPO₃',
    'N₂O₃ and H₃PO₄',
    'N₂O₄ and HPO₃',
    'N₂O₄ and H₃PO₃',
  ],
  // JEE (Advanced) 2018 Paper 2, Q15
  [
    'Match each set of hybrid orbitals from List-I with complex(es) given in List-II',
    'P → 6; Q → 4, 5; R → 1; S → 2, 3',
    'P → 5; Q → 4, 6; R → 2, 3; S → 1',
    'P → 5, 6; Q → 4; R → 3; S → 1, 2',
    'P → 4, 6; Q → 5, 6; R → 1, 2; S → 3',
    {
      kind: 'table',
      head: ['List-I', 'List-II'],
      rows: [
        ['P. dsp²', '1. [FeF₆]⁴⁻'],
        ['Q. sp³', '2. [Ti(H₂O)₃Cl₃]'],
        ['R. sp³d²', '3. [Cr(NH₃)₆]³⁺'],
        ['S. d²sp³', '4. [FeCl₄]²⁻'],
        ['', '5. Ni(CO)₄'],
        ['', '6. [Ni(CN)₄]²⁻'],
      ],
    },
  ],
];

const JEE_MATHEMATICS_SEQUENCE =
  'Let p, q be integers and let α, β be the roots of the equation x² − x − 1 = 0, where α ≠ β. For n = 0, 1, 2, …, let aₙ = pαⁿ + qβⁿ. (Fact: if a and b are rational numbers and a + b√5 = 0, then a = 0 = b.)';

const JEE_MATHEMATICS: readonly Row[] = [
  // JEE (Advanced) 2016 Paper 2, Q37
  [
    'Let P be the matrix shown and let I be the identity matrix of order 3. If Q = [qᵢⱼ] is a matrix such that P⁵⁰ − Q = I, then (q₃₁ + q₃₂)/q₂₁ equals',
    '103',
    '52',
    '201',
    '205',
    {
      kind: 'matrices',
      items: [
        {
          name: 'P',
          rows: [
            ['1', '0', '0'],
            ['4', '1', '0'],
            ['16', '4', '1'],
          ],
        },
      ],
    },
  ],
  // JEE (Advanced) 2016 Paper 2, Q38
  [
    'Let bᵢ > 1 for i = 1, 2, …, 101. Suppose logₑ b₁, logₑ b₂, …, logₑ b₁₀₁ are in Arithmetic Progression (A.P.) with the common difference logₑ 2. Suppose a₁, a₂, …, a₁₀₁ are in A.P. such that a₁ = b₁ and a₅₁ = b₅₁. If t = b₁ + b₂ + … + b₅₁ and s = a₁ + a₂ + … + a₅₁, then',
    's > t and a₁₀₁ < b₁₀₁',
    's > t and a₁₀₁ > b₁₀₁',
    's < t and a₁₀₁ > b₁₀₁',
    's < t and a₁₀₁ < b₁₀₁',
  ],
  // JEE (Advanced) 2016 Paper 2, Q39
  [
    'The value of the sum, for k = 1 to 13, of 1 / [sin(π/4 + (k − 1)π/6) · sin(π/4 + kπ/6)] is equal to',
    '2(√3 − 1)',
    '3 − √3',
    '2(3 − √3)',
    '2(2 + √3)',
  ],
  // JEE (Advanced) 2016 Paper 2, Q40
  [
    'The value of the integral of x² cos x / (1 + eˣ) dx, from x = −π/2 to x = π/2, is equal to',
    'π²/4 − 2',
    'π²/4 + 2',
    'π² − e^(π/2)',
    'π² + e^(π/2)',
  ],
  // JEE (Advanced) 2016 Paper 2, Q41
  [
    'Area of the region {(x, y) ∈ ℝ² : y ≥ √|x + 3|, 5y ≤ x + 9 ≤ 15} is equal to',
    '3/2',
    '1/6',
    '4/3',
    '5/3',
  ],
  // JEE (Advanced) 2016 Paper 2, Q42
  [
    'Let P be the image of the point (3, 1, 7) with respect to the plane x − y + z = 3. Then the equation of the plane passing through P and containing the straight line x/1 = y/2 = z/1 is',
    'x − 4y + 7z = 0',
    'x + y − 3z = 0',
    '3x + z = 0',
    '2x − y = 0',
  ],
  // JEE (Advanced) 2017 Paper 2, Q37
  [
    'The equation of the plane passing through the point (1, 1, 1) and perpendicular to the planes 2x + y − 2z = 5 and 3x − 6y − 2z = 7, is',
    '14x + 2y + 15z = 31',
    '14x + 2y − 15z = 1',
    '14x − 2y + 15z = 27',
    '−14x + 2y + 15z = 3',
  ],
  // JEE (Advanced) 2017 Paper 2, Q38
  [
    'Let O be the origin and let PQR be an arbitrary triangle. The point S is such that the vectors satisfy OP · OQ + OR · OS = OR · OP + OQ · OS = OQ · OR + OP · OS. Then the triangle PQR has S as its',
    'orthocenter',
    'centroid',
    'circumcentre',
    'incentre',
  ],
  // JEE (Advanced) 2017 Paper 2, Q39
  [
    'If y = y(x) satisfies the differential equation 8√x (√(9 + √x)) dy = (√(4 + √(9 + √x)))⁻¹ dx, x > 0, and y(0) = √7, then y(256) =',
    '3',
    '9',
    '16',
    '80',
  ],
  // JEE (Advanced) 2017 Paper 2, Q40
  [
    'If f : ℝ → ℝ is a twice differentiable function such that f″(x) > 0 for all x ∈ ℝ, and f(1/2) = 1/2, f(1) = 1, then',
    'f′(1) > 1',
    'f′(1) ≤ 0',
    '0 < f′(1) ≤ 1/2',
    '1/2 < f′(1) ≤ 1',
  ],
  // JEE (Advanced) 2017 Paper 2, Q41
  [
    'How many 3 × 3 matrices M with entries from {0, 1, 2} are there, for which the sum of the diagonal entries of MᵀM is 5?',
    '198',
    '126',
    '162',
    '135',
  ],
  // JEE (Advanced) 2017 Paper 2, Q42
  [
    'Let S = {1, 2, 3, …, 9}. For k = 1, 2, …, 5, let Nₖ be the number of subsets of S, each containing five elements out of which exactly k are odd. Then N₁ + N₂ + N₃ + N₄ + N₅ =',
    '126',
    '210',
    '252',
    '125',
  ],
  // JEE (Advanced) 2017 Paper 2, Q43
  [
    'Three randomly chosen nonnegative integers x, y and z are found to satisfy the equation x + y + z = 10. Then the probability that z is even, is',
    '6/11',
    '36/55',
    '1/2',
    '5/11',
  ],
  // JEE (Advanced) 2017 Paper 2, Q51 (Paragraph 1)
  [
    'Let O be the origin, and OX, OY, OZ be three unit vectors in the directions of the sides QR, RP, PQ, respectively, of a triangle PQR. Then |OX × OY| =',
    'sin(P + Q)',
    'sin 2R',
    'sin(P + R)',
    'sin(Q + R)',
  ],
  // JEE (Advanced) 2017 Paper 2, Q52 (Paragraph 1)
  [
    'If the triangle PQR varies, then the minimum value of cos(P + Q) + cos(Q + R) + cos(R + P) is',
    '−3/2',
    '−5/3',
    '3/2',
    '5/3',
  ],
  // JEE (Advanced) 2017 Paper 2, Q53 (Paragraph 2)
  [
    `${JEE_MATHEMATICS_SEQUENCE} Then a₁₂ =`,
    'a₁₁ + a₁₀',
    'a₁₁ − a₁₀',
    '2a₁₁ + a₁₀',
    'a₁₁ + 2a₁₀',
  ],
  // JEE (Advanced) 2017 Paper 2, Q54 (Paragraph 2)
  [
    `${JEE_MATHEMATICS_SEQUENCE} If a₄ = 28, then p + 2q =`,
    '12',
    '21',
    '14',
    '7',
  ],
  // JEE (Advanced) 2018 Paper 1, Q15 (Paragraph X)
  [
    'Let S be the circle in the xy-plane defined by the equation x² + y² = 4. Let E₁E₂ and F₁F₂ be the chords of S passing through the point P₀(1, 1) and parallel to the x-axis and the y-axis, respectively. Let G₁G₂ be the chord of S passing through P₀ and having slope −1. Let the tangents to S at E₁ and E₂ meet at E₃, the tangents to S at F₁ and F₂ meet at F₃, and the tangents to S at G₁ and G₂ meet at G₃. Then, the points E₃, F₃ and G₃ lie on the curve',
    'x + y = 4',
    '(x − 4)² + (y − 4)² = 16',
    '(x − 4)(y − 4) = 4',
    'xy = 4',
  ],
  // JEE (Advanced) 2018 Paper 1, Q16 (Paragraph X)
  [
    'Let S be the circle in the xy-plane defined by the equation x² + y² = 4. Let P be a point on the circle S with both coordinates being positive. Let the tangent to S at P intersect the coordinate axes at the points M and N. Then, the mid-point of the line segment MN must lie on the curve',
    'x² + y² = x²y²',
    '(x + y)² = 3xy',
    'x^(2/3) + y^(2/3) = 2^(4/3)',
    'x² + y² = 2xy',
  ],
  // JEE (Advanced) 2018 Paper 1, Q17 (Paragraph A)
  [
    'There are five students S₁, S₂, S₃, S₄ and S₅ in a music class and for them there are five seats R₁, R₂, R₃, R₄ and R₅ arranged in a row, where initially the seat Rᵢ is allotted to the student Sᵢ, i = 1, 2, 3, 4, 5. But, on the examination day, the five students are randomly allotted the five seats. The probability that, on the examination day, the student S₁ gets the previously allotted seat R₁, and none of the remaining students gets the seat previously allotted to him/her is',
    '3/40',
    '1/8',
    '7/40',
    '1/5',
  ],
];

// NEET

const NEET_PHYSICS: readonly Row[] = [
  // NEET 2022 Phase 1, Q154
  [
    "Let T₁ and T₂ be the energy of an electron in the first and second excited states of hydrogen atoms, respectively. According to the Bohr's model of an atom, the ratio T₁ : T₂ is",
    '9 : 4',
    '1 : 4',
    '4 : 1',
    '4 : 9',
  ],
  // NEET 2013, Q148
  [
    'The condition under which a microwave oven heats up a food item containing water molecules most efficiently is',
    'The frequency of the microwaves must match the resonant frequency of the water molecules',
    'Microwaves are heat waves, so always produce heating',
    'Infra-red waves produce heating in a microwave oven',
    'The frequency of the microwaves has no relation with natural frequency of water molecules',
  ],
  // AIPMT 2015, Q132
  [
    'A string is stretched between fixed points separated by 75.0 cm. It is observed to have resonant frequencies of 420 Hz and 315 Hz. There are no other resonant frequencies between these two. The lowest resonant frequency for this string is',
    '105 Hz',
    '10.5 Hz',
    '155 Hz',
    '205 Hz',
  ],
  // AIPMT 2014, Q155
  [
    'If the focal length of objective lens is increased then magnifying power of',
    'microscope will decrease but that of telescope will increase',
    'microscope will increase but that of telescope decrease',
    'microscope and telescope both will increase',
    'microscope and telescope both will decrease',
  ],
  // NEET 2018, Q131
  [
    'The fundamental frequency in an open organ pipe is equal to the third harmonic of a closed organ pipe. If the length of the closed organ pipe is 20 cm, the length of the open organ pipe is',
    '13.2 cm',
    '8 cm',
    '12.5 cm',
    '16 cm',
  ],
  // RE-NEET 2026, Q171
  [
    "Which of the following measurements require 'index correction'?",
    'Measurement of focal length of lenses using optical bench',
    'Measurement of speed of sound using resonance tube',
    'Measurement of resistance of a wire using meter bridge',
    'Measurement of gravitational acceleration using simple pendulum',
  ],
  // NEET 2013 (Karnataka), Q122
  [
    'The pair of quantities having same dimensions is',
    'Work and Torque',
    'Impulse and Surface Tension',
    'Angular momentum and Work',
    "Young's modulus and Energy",
  ],
  // AIPMT 1990, Q102
  [
    'A car covers the first half of the distance between two places at 40 km/h and another half at 60 km/h. The average speed of the car is',
    '48 km/h',
    '40 km/h',
    '50 km/h',
    '60 km/h',
  ],
  // NEET 2022 Phase 2, Q143
  [
    'The light rays having photons of energy 4.2 eV are falling on a metal surface having a work function of 2.2 eV. The stopping potential of the surface is',
    '2 V',
    '6.4 V',
    '2 eV',
    '1.1 V',
  ],
  // NEET 2020 Phase 1, Q132
  [
    'Two particles of mass 5 kg and 10 kg respectively are attached to the two ends of a rigid rod of length 1 m with negligible mass. The centre of mass of the system from the 5 kg particle is nearly at a distance of',
    '67 cm',
    '50 cm',
    '80 cm',
    '33 cm',
  ],
  // NEET 2017, Q154
  [
    'The ratio of wavelengths of the last line of Balmer series and the last line of Lyman series is',
    '4',
    '1',
    '0.5',
    '2',
  ],
  // NEET 2024 (Re-Examination), Q179
  [
    'When the output of an OR gate is applied as input to a NOT gate, then the combination acts as a',
    'NOR gate',
    'NAND gate',
    'AND gate',
    'OR gate',
  ],
  // NEET 2016 Phase 1, Q149
  [
    'A astronomical telescope has objective and eyepiece of focal lengths 40 cm and 4 cm respectively. To view an object 200 cm away from the objective, the lenses must be separated by a distance',
    '54.0 cm',
    '50.0 cm',
    '37.3 cm',
    '46.0 cm',
  ],
  // NEET 2025, Q168
  [
    'The radius of Martian orbit around the Sun is about 4 times the radius of the orbit of Mercury. The Martian year is 687 Earth days. Then which of the following is the length of 1 year on Mercury?',
    '88 earth days',
    '172 earth days',
    '124 earth days',
    '225 earth days',
  ],
  // NEET 2016 Phase 2, Q147
  [
    'An air bubble in a glass slab with refractive index 1.5 (near normal incidence) is 5 cm deep when viewed from one surface and 3 cm deep when viewed from the opposite face. The thickness of the slab is',
    '12 cm',
    '8 cm',
    '10 cm',
    '16 cm',
  ],
  // NEET 2019 (Odisha), Q145
  [
    'A double convex lens has focal length 25 cm. The radius of curvature of one of the surfaces is double of the other. Find the radii if the refractive index of the material of the lens is 1.5.',
    '18.75 cm, 37.5 cm',
    '50 cm, 100 cm',
    '100 cm, 50 cm',
    '25 cm, 50 cm',
  ],
  // NEET 2017, Q135
  [
    "A spring of force constant k is cut into lengths of ratio 1 : 2 : 3. They are connected in series and the new force constant is K'. Then they are connected in parallel and force constant is k''. Then k' : k'' is",
    '1 : 11',
    '1 : 9',
    '1 : 14',
    '1 : 6',
  ],
  // NEET 2023 Manipur, Q152
  [
    'Two particles A and B initially at rest, move towards each other under mutual force of attraction. At an instance when the speed of A is v and speed of B is 3v, the speed of centre of mass is',
    'zero',
    '2v',
    'v',
    '4v',
  ],
  // AIPMT 2015 (cancelled paper), Q137
  [
    'The fundamental frequency of a closed organ pipe of length 20 cm is equal to the second overtone of an organ pipe open at both the ends. The length of organ pipe open at both the ends is',
    '120 cm',
    '140 cm',
    '80 cm',
    '100 cm',
  ],
  // AIPMT 1988, Q115
  [
    'The ionisation energy of hydrogen atom is 13.6 eV, the ionisation energy of a singly ionised helium atom would be',
    '54.4 eV',
    '13.6 eV',
    '27.2 eV',
    '6.8 eV',
  ],
];

const NEET_CHEMISTRY: readonly Row[] = [
  // NEET 2017, Q104
  [
    'Which of the following is dependent on temperature?',
    'Molarity',
    'Mole fraction',
    'Weight percentage',
    'Molality',
  ],
  // NEET 2019, Q110
  [
    'The mixture that forms maximum boiling azeotrope is',
    'Water + Nitric acid',
    'Ethanol + Water',
    'Acetone + Carbon disulphide',
    'Heptane + Octane',
  ],
  // NEET 2013, Q100
  [
    'How many grams of concentrated nitric acid solution should be used to prepare 250 mL of 2.0 M HNO₃? The concentrated acid is 70% HNO₃.',
    '45.0 g conc. HNO₃',
    '70.0 g conc. HNO₃',
    '54.0 g conc. HNO₃',
    '90.0 g conc. HNO₃',
  ],
  // NEET 2016 Phase 1, Q112
  [
    'Among the following the correct order of acidity is',
    'HClO < HClO₂ < HClO₃ < HClO₄',
    'HClO₂ < HClO < HClO₃ < HClO₄',
    'HClO₄ < HClO₂ < HClO < HClO₃',
    'HClO₃ < HClO₄ < HClO₂ < HClO',
  ],
  // NEET 2018, Q101
  [
    'The geometry and magnetic behaviour of the complex [Ni(CO)₄] are',
    'tetrahedral geometry and diamagnetic',
    'square planar geometry and diamagnetic',
    'square planar geometry and paramagnetic',
    'tetrahedral geometry and paramagnetic',
  ],
  // AIPMT 2015 (cancelled paper), Q103
  [
    "Which one of the following electrolytes has the same value of van't Hoff factor (i) as that of Al₂(SO₄)₃ (if all are 100% ionised)?",
    'K₄[Fe(CN)₆]',
    'Al(NO₃)₃',
    'K₂SO₄',
    'K₃[Fe(CN)₆]',
  ],
  // NEET 2020 Phase 1, Q83
  [
    'Which of the following is a basic amino acid?',
    'Lysine',
    'Alanine',
    'Tyrosine',
    'Serine',
  ],
  // AIPMT 2014, Q93
  [
    'Which of the following salts will give highest pH in water?',
    'Na₂CO₃',
    'KCl',
    'NaCl',
    'CuSO₄',
  ],
  // AIPMT 2015, Q81
  [
    'What is the pH of the resulting solution when equal volumes of 0.1 M NaOH and 0.01 M HCl are mixed?',
    '12.65',
    '2.0',
    '7.0',
    '1.04',
  ],
  // NEET 2022 Phase 1, Q91
  [
    'The IUPAC name of the complex - [Ag(H₂O)₂][Ag(CN)₂] is',
    'diaquasilver(I) dicyanidoargentate(I)',
    'dicyanidosilver(II) diaquaargentate (II)',
    'diaquasilver(II) dicyanidoargentate(II)',
    'dicyanidosilver(I) diaquaargentate(I)',
  ],
  // NEET 2022 Phase 2, Q99
  [
    'The half life of a first order reaction is 2000 years. If the concentration after 8000 years is 0.02 M, then the initial concentration was',
    '0.32 M',
    '0.04 M',
    '0.16 M',
    '0.08 M',
  ],
  // NEET 2020 Phase 2, Q95
  [
    'Reaction of propanamide with ethanolic sodium hydroxide and bromine will give',
    'Ethylamine',
    'Aniline',
    'Methylamine',
    'Propylamine',
  ],
  // NEET 2024 (Re-Examination), Q109
  [
    'From the following select the one which is not an example of corrosion.',
    'Production of hydrogen by electrolysis of water',
    'Rusting of iron object',
    'Tarnishing of silver',
    'Development of green coating on copper and bronze ornaments',
  ],
  // NEET 2025, Q130
  [
    'Which one of the following compounds can exist as cis-trans isomers?',
    '1, 2-Dimethylcyclohexane',
    '1, 1-Dimethylcyclopropane',
    'Pent-1-ene',
    '2-Methylhex-2-ene',
  ],
  // NEET 2019, Q79
  [
    'For the second period elements the correct increasing order of first ionization enthalpy is',
    'Li < B < Be < C < O < N < F < Ne',
    'Li < B < Be < C < N < O < F < Ne',
    'Li < Be < B < C < O < N < F < Ne',
    'Li < Be < B < C < N < O < F < Ne',
  ],
  // NEET 2016 Phase 1, Q110
  [
    'Which one of the following orders is correct for the bond dissociation enthalpy of halogen molecules?',
    'Cl₂ > Br₂ > F₂ > I₂',
    'Br₂ > I₂ > F₂ > Cl₂',
    'F₂ > Cl₂ > Br₂ > I₂',
    'I₂ > Br₂ > Cl₂ > F₂',
  ],
  // NEET 2019 (Odisha), Q84
  [
    'Orbital having 3 angular nodes and 3 total nodes is',
    '4f',
    '6d',
    '5p',
    '3d',
  ],
  // NEET 2023 Manipur, Q107
  [
    'Which amongst the following compounds will show geometrical isomerism?',
    '3, 4-Dimethylhex-3-ene',
    'Pent-1-ene',
    '2, 3-Dimethylbut-2-ene',
    '2-Methylprop-1-ene',
  ],
  // AIPMT 2015, Q109
  [
    'The sum of coordination number and oxidation number of the metal M in the complex [M(en)₂(C₂O₄)]Cl (where en is ethylenediamine) is',
    '9',
    '6',
    '7',
    '8',
  ],
  // AIPMT 1990, Q95
  [
    'Kjeldahl’s method is used in the estimation of',
    'nitrogen',
    'halogens',
    'sulphur',
    'oxygen',
  ],
];

const NEET_BIOLOGY: readonly Row[] = [
  // NEET 2019, Q49
  [
    "Under which of the following conditions will there be no change in the reading frame of following mRNA? 5' AACAGCGGUGCUAUU 3'",
    'Deletion of GGU from 7ᵗʰ, 8ᵗʰ and 9ᵗʰ positions',
    'Insertion of A and G at 4ᵗʰ and 5ᵗʰ positions respectively',
    'Insertion of G at 5ᵗʰ positions',
    'Deletion of G from 5ᵗʰ positions',
  ],
  // AIPMT 2014, Q37
  [
    'Which one of the following shows isogamy with non-flagellated gametes?',
    'Spirogyra',
    'Sargassum',
    'Ectocarpus',
    'Ulothrix',
  ],
  // NEET 2013, Q14
  [
    'Macromolecule chitin is',
    'nitrogen containing polysaccharide',
    'sulphur containing polysaccharide',
    'simple polysaccharide',
    'phosphorous containing polysaccharide',
  ],
  // NEET 2022 Phase 2, Q34
  [
    'If a female individual is with small round head, furrowed tongue, partially open mouth and broad palm with characteristic palm crease. Also the physical, psychomotor and mental development is retarded. The karyotype analysis of such an individual will show',
    'Trisomy of chromosome 21',
    '47 chromosomes with XXY sex chromosomes',
    '45 chromosomes with XO sex chromosomes',
    '47 chromosomes with XYY sex chromosomes',
  ],
  // NEET 2018, Q59
  [
    'Which of the following is not an autoimmune disease?',
    'Alzheimer’s disease',
    'Psoriasis',
    'Rheumatoid arthritis',
    'Vitiligo',
  ],
  // AIPMT 2015, Q32
  ['Flowers are unisexual in', 'cucumber', 'China rose', 'onion', 'pea'],
  // NEET 2020 Phase 2, Q24
  [
    'Attachment of spindle fibers to kinetochores of chromosomes becomes evident in',
    'Metaphase',
    'Anaphase',
    'Telophase',
    'Prophase',
  ],
  // NEET 2017, Q69
  [
    'Which ecosystem has the maximum biomass?',
    'Forest ecosystem',
    'Pond ecosystem',
    'Lake ecosystem',
    'Grassland ecosystem',
  ],
  // AIPMT 1989, Q48
  [
    'Organelles can be separated from cell homogenate through',
    'differential centrifugation',
    'chromatography',
    'X-rays diffraction',
    'auto-radiography',
  ],
  // NEET 2022 Phase 1, Q59
  [
    'A dehydration reaction links two glucose molecules to product maltose. If the formula for glucose is C₆H₁₂O₆ then what is the formula for maltose?',
    'C₁₂H₂₂O₁₁',
    'C₁₂H₂₀O₁₀',
    'C₁₂H₂₄O₁₂',
    'C₁₂H₂₄O₁₁',
  ],
  // NEET 2016 Phase 1, Q36
  [
    'The coconut water from tender coconut represents',
    'free nuclear endosperm',
    'free nuclear proembryo',
    'endocarp',
    'fleshy mesocarp',
  ],
  // NEET 2024 (Re-Examination), Q10
  [
    'Which one of the following is not included under in-situ conservation?',
    'Botanical garden',
    'Wild-life sanctuary',
    'Biosphere reserve',
    'National park',
  ],
  // AIPMT 1992, Q48
  [
    'Cytokinins',
    'help retain chlorophyll',
    'promote abscission',
    'influence water movement',
    'inhibit protoplasmic streaming',
  ],
  // NEET 2019 (Odisha), Q25
  [
    'In which one of the following, both autogamy and geitonogamy are prevented?',
    'Papaya',
    'Maize',
    'Wheat',
    'Castor',
  ],
  // NEET 2020 Phase 1, Q67
  [
    'Which of the following is not an attribute of a population?',
    'Species interaction',
    'Natality',
    'Sex ratio',
    'Mortality',
  ],
  // RE-NEET 2026, Q62
  [
    'Which of the following is not evidence for evolution?',
    'Embryological support for evolution as proposed by Ernst Haeckel',
    'Divergent evolution of anatomical structures such as forelimbs',
    'Convergent evolution of traits like wings of birds and butterflies',
    'Paleontological evidence from fossil records',
  ],
  // NEET 2025, Q79
  [
    'Sweet potato and potato represent a certain type of evolution. Select the correct combination of terms to explain the evolution.',
    'Analogy, convergent',
    'Homology, convergent',
    'Analogy, divergent',
    'Homology, divergent',
  ],
  // NEET 2013, Q66
  [
    'Which of the following represents maximum number of species among global biodiversity?',
    'Fungi',
    'Algae',
    'Mosses and Ferns',
    'Lichens',
  ],
  // NEET 2022 Phase 1, Q76
  [
    'Ten E.coli cells with ¹⁵N - dsDNA are incubated in medium containing ¹⁴N nucleotide. After 60 minutes, how many E.coli cells will have DNA totally free from ¹⁵N?',
    '60 cells',
    '20 cells',
    '40 cells',
    '80 cells',
  ],
  // NEET 2016 Phase 1, Q12
  [
    'Which of the following is not a stem modification?',
    'Pitcher of Nepenthes',
    'Tendrils of cucumber',
    'Flattened structures of Opuntia',
    'Thorns of citrus',
  ],
];

// Reasoning and aptitude

const LOGICAL_REASONING: readonly Row[] = [
  ['What comes next: 2, 4, 8, 16, …?', '32', '24', '30', '20'],
  ['What comes next: 1, 4, 9, 16, …?', '25', '20', '36', '24'],
  [
    'Which is the odd one out: apple, mango, carrot, banana?',
    'Carrot',
    'Apple',
    'Mango',
    'Banana',
  ],
  [
    'If CAT is written as DBU, then DOG is written as',
    'EPH',
    'EPG',
    'DPH',
    'FQI',
  ],
  [
    'Book is to reading as fork is to',
    'Eating',
    'Drawing',
    'Writing',
    'Sleeping',
  ],
  [
    "A is B's brother and B is C's mother. A is C's",
    'Uncle',
    'Father',
    'Brother',
    'Cousin',
  ],
  [
    'You face north and turn right twice. You now face',
    'South',
    'East',
    'West',
    'North',
  ],
  ['What comes next: A, C, E, G, …?', 'I', 'H', 'J', 'K'],
  [
    'All cats are animals and all animals breathe. So',
    'All cats breathe',
    'No cats breathe',
    'Everything that breathes is a cat',
    'Some cats do not breathe',
  ],
  ['Which is the odd one out: 3, 5, 7, 9, 11?', '9', '3', '7', '11'],
  ['What comes next: 3, 6, 11, 18, …?', '27', '24', '29', '30'],
  ['If 2 + 3 = 10 and 4 + 5 = 18, then 6 + 7 =', '26', '13', '42', '20'],
  [
    'Which day is three days after Friday?',
    'Monday',
    'Sunday',
    'Tuesday',
    'Thursday',
  ],
  [
    'At 3:00, the angle between the hands of a clock is',
    '90°',
    '60°',
    '180°',
    '45°',
  ],
  [
    'Which is the odd one out: square, triangle, circle, cube?',
    'Cube',
    'Square',
    'Triangle',
    'Circle',
  ],
  ['Pen is to writer as brush is to', 'Painter', 'Doctor', 'Pilot', 'Singer'],
  [
    'Ravi is taller than Amit and Amit is taller than Sunil. Who is the shortest?',
    'Sunil',
    'Ravi',
    'Amit',
    'It cannot be told',
  ],
  ['MONDAY written backwards has which fourth letter?', 'N', 'D', 'O', 'A'],
  ['What comes next: Z, X, V, T, …?', 'R', 'S', 'Q', 'U'],
  [
    'If 1 January is a Monday, 8 January is a',
    'Monday',
    'Tuesday',
    'Sunday',
    'Wednesday',
  ],
];

const QUANTITATIVE_APTITUDE: readonly Row[] = [
  ['20% of 150 is', '30', '20', '15', '300'],
  [
    'Simple interest on ₹1,000 at 10% a year for 2 years is',
    '₹200',
    '₹100',
    '₹210',
    '₹2,000',
  ],
  ['The average of 10, 20 and 30 is', '20', '30', '60', '15'],
  [
    'A train at 60 km/h covers how far in 2.5 hours?',
    '150 km',
    '120 km',
    '24 km',
    '160 km',
  ],
  ['The LCM of 4 and 6 is', '12', '24', '2', '10'],
  ['The HCF of 12 and 18 is', '6', '3', '36', '9'],
  [
    'Bought for ₹80 and sold for ₹100, the profit is',
    '25%',
    '20%',
    '80%',
    '30%',
  ],
  [
    '₹500 shared in the ratio 2 : 3 gives the larger share as',
    '₹300',
    '₹200',
    '₹250',
    '₹333',
  ],
  ['15 × 15 =', '225', '215', '255', '205'],
  ['√144 =', '12', '14', '11', '72'],
  [
    'A finishes a job in 10 days and B in 15 days. Together they take',
    '6 days',
    '25 days',
    '12.5 days',
    '5 days',
  ],
  ['0.25 as a fraction is', '1/4', '1/2', '2/5', '25/10'],
  [
    '₹1,000 at 10% a year compounded yearly for 2 years becomes',
    '₹1,210',
    '₹1,200',
    '₹1,100',
    '₹1,221',
  ],
  [
    'A price rises 10% and then falls 10%. Overall it',
    'Falls 1%',
    'Does not change',
    'Rises 1%',
    'Falls 10%',
  ],
  ['18 km/h in metres per second is', '5', '18', '10', '3.6'],
  ['The next prime number after 31 is', '37', '33', '35', '39'],
  [
    'The area of an 8 m by 5 m rectangle is',
    '40 m²',
    '13 m²',
    '26 m²',
    '80 m²',
  ],
  [
    'The perimeter of a square of side 7 cm is',
    '28 cm',
    '49 cm',
    '14 cm',
    '21 cm',
  ],
  ['3/4 of 80 is', '60', '40', '75', '20'],
  ['If x + 5 = 12, then x =', '7', '17', '5', '60'],
];

const VERBAL_ABILITY: readonly Row[] = [
  [
    'A word that means the same as "rapid" is',
    'Quick',
    'Slow',
    'Heavy',
    'Quiet',
  ],
  ['The opposite of "ancient" is', 'Modern', 'Old', 'Historic', 'Aged'],
  [
    'Which word is spelt correctly?',
    'Necessary',
    'Neccessary',
    'Necesary',
    'Neccesary',
  ],
  ['Fill in the blank: She is ___ honest girl', 'an', 'a', 'the', 'no article'],
  [
    'A word that means the same as "begin" is',
    'Start',
    'End',
    'Stop',
    'Finish',
  ],
  ['The opposite of "generous" is', 'Mean', 'Kind', 'Giving', 'Liberal'],
  ['The plural of "child" is', 'Children', 'Childs', 'Childes', 'Childrens'],
  [
    'Fill in the blank: He ___ to school every day',
    'goes',
    'go',
    'going',
    'gone',
  ],
  [
    '"A piece of cake" means',
    'Very easy',
    'A dessert',
    'Very hard',
    'A small share',
  ],
  [
    'One word for "a person who writes poems" is',
    'Poet',
    'Painter',
    'Sculptor',
    'Editor',
  ],
  ['The past tense of "write" is', 'Wrote', 'Writed', 'Written', 'Writing'],
  [
    'A word that means the same as "happy" is',
    'Joyful',
    'Sad',
    'Angry',
    'Tired',
  ],
  ['The opposite of "brave" is', 'Cowardly', 'Bold', 'Strong', 'Daring'],
  ['Fill in the blank: She was born ___ 2005', 'in', 'on', 'at', 'by'],
  [
    'Fill in the blank: Neither Ravi nor his friends ___ coming',
    'are',
    'is',
    'was',
    'has',
  ],
  [
    'Pick the correct spelling',
    'Accommodate',
    'Acommodate',
    'Accomodate',
    'Acomodate',
  ],
  [
    '"Break the ice" means',
    'Start a conversation',
    'Break something',
    'Feel cold',
    'Stop talking',
  ],
  [
    'One word for "a place where books are kept to read or borrow" is',
    'Library',
    'Laboratory',
    'Museum',
    'Gallery',
  ],
  ['The opposite of "increase" is', 'Decrease', 'Raise', 'Expand', 'Grow'],
  [
    'Which sentence is correct?',
    "She doesn't like tea",
    "She don't like tea",
    'She not like tea',
    "She doesn't likes tea",
  ],
];

// CA / CPT (CA Foundation)

const CA_ACCOUNTING: readonly Row[] = [
  [
    'Under the accrual concept, revenue is recorded when it is',
    'Earned',
    'Received in cash',
    'Ordered',
    'Budgeted',
  ],
  [
    'The matching concept matches expenses with',
    'Revenues of the same period',
    'Assets',
    'Cash',
    'Capital',
  ],
  [
    'Inventory is valued at',
    'Cost or net realisable value, whichever is lower',
    'Market value always',
    'Selling price',
    'Replacement cost always',
  ],
  [
    'Under FIFO, closing stock is made up of the',
    'Latest purchases',
    'Earliest purchases',
    'Average of all purchases',
    'Largest purchases',
  ],
  [
    'On consignment, the consignor sends goods to the',
    'Consignee',
    'Final customer',
    'Supplier',
    'Bank',
  ],
  [
    'A joint venture is',
    'A temporary partnership',
    'A permanent company',
    'A sole trader',
    'A trust',
  ],
  [
    'A ₹50,000 machine with no scrap value and a 5-year life, on straight line, is depreciated each year by',
    '₹10,000',
    '₹5,000',
    '₹50,000',
    '₹2,500',
  ],
  [
    'The person who draws a bill of exchange is the',
    'Drawer',
    'Drawee',
    'Payee',
    'Endorsee',
  ],
  [
    'A bill is dishonoured when the',
    'Drawee does not pay on the due date',
    'Bill is paid early',
    'Bill is renewed',
    'Bill is endorsed',
  ],
  [
    'Wages paid for installing a machine are debited to',
    'Machinery account',
    'Wages account',
    'Salaries account',
    'Profit and loss account',
  ],
  [
    'Which is revenue expenditure?',
    'Repairs to a building',
    'Buying land',
    'Building a factory',
    'Buying a machine',
  ],
  [
    'The average due date is used to',
    'Settle several bills with one payment on one date',
    'Find depreciation',
    'Value stock',
    'Prepare a trial balance',
  ],
  [
    "Interest charged on partners' drawings is",
    'Income for the firm',
    'An expense of the firm',
    'A liability',
    'An asset',
  ],
  [
    'Goods sent on approval are treated as sold when the',
    'Buyer approves them',
    'Goods are sent',
    'Invoice is printed',
    'Year ends',
  ],
  [
    'Which is a capital receipt?',
    'A loan taken from a bank',
    'Sale of goods',
    'Interest received',
    'Commission received',
  ],
  [
    'Book-keeping is the',
    'Recording of transactions',
    'Analysis of statements',
    'Audit of accounts',
    'Filing of tax returns',
  ],
  [
    'The cash basis of accounting records',
    'Only cash received and paid',
    'All accruals',
    'Only credit sales',
    'Only assets',
  ],
  ['Which is an intangible asset?', 'Patent', 'Building', 'Stock', 'Cash'],
  [
    'A bank overdraft is',
    'A current liability',
    'A current asset',
    'A fixed asset',
    'Capital',
  ],
  [
    'An opening entry is passed to',
    "Bring forward last year's balances",
    'Close the accounts',
    'Record sales',
    'Correct errors',
  ],
];

const CA_BUSINESS_LAW: readonly Row[] = [
  ['The Indian Contract Act was passed in', '1872', '1932', '1930', '2013'],
  ['The Sale of Goods Act was passed in', '1930', '1872', '1932', '1956'],
  ['The Indian Partnership Act was passed in', '1932', '1872', '1930', '2008'],
  [
    'An agreement enforceable by law is a',
    'Contract',
    'Proposal',
    'Promise',
    'Offer',
  ],
  [
    'Acceptance of an offer must be',
    'Absolute and unqualified',
    'Conditional',
    'Silent',
    'Delayed',
  ],
  [
    "A minor's agreement is",
    'Void from the start',
    'Voidable',
    'Valid',
    'Illegal but enforceable',
  ],
  [
    'Consideration means',
    'Something in return',
    'A gift',
    'Only a promise',
    'A free service',
  ],
  [
    'An agreement by a person of unsound mind is',
    'Void',
    'Valid',
    'Voidable at will',
    'Enforceable',
  ],
  [
    'Coercion is defined in which section of the Indian Contract Act?',
    'Section 15',
    'Section 10',
    'Section 17',
    'Section 2(h)',
  ],
  [
    'Which makes consent not free?',
    'Coercion',
    'An offer',
    'Acceptance',
    'Consideration',
  ],
  [
    'A quasi-contract is created by',
    'Law',
    'The parties',
    'An agent',
    'A court order only',
  ],
  [
    '"Caveat emptor" means',
    'Let the buyer beware',
    'Let the seller beware',
    'Goods are sold',
    'The buyer has paid',
  ],
  [
    'In a sale, ownership of the goods passes to the',
    'Buyer',
    'Seller',
    'Agent',
    'Bank',
  ],
  ['An unpaid seller has a right of', 'Lien', 'Dividend', 'Bonus', 'Premium'],
  [
    'The Limited Liability Partnership Act was passed in',
    '2008',
    '2013',
    '1932',
    '1956',
  ],
  [
    'The Companies Act in force today is the Companies Act of',
    '2013',
    '1956',
    '1932',
    '2008',
  ],
  [
    'A partnership arises from',
    'An agreement to share the profits of a business',
    'Registration only',
    'At least 7 partners',
    'A company seal',
  ],
  ['The maximum number of partners in a firm is', '50', '10', '20', '100'],
  [
    'A contingent contract depends on',
    'An uncertain future event',
    'A past event',
    'A present promise',
    'An illegal act',
  ],
  [
    'The usual remedy for breach of contract is',
    'Damages',
    'Dividends',
    'Rent',
    'A bonus',
  ],
];

const CA_BUSINESS_ECONOMICS: readonly Row[] = [
  [
    'Price elasticity of demand greater than 1 means demand is',
    'Elastic',
    'Inelastic',
    'Unitary elastic',
    'Perfectly inelastic',
  ],
  [
    'By the law of diminishing marginal utility, marginal utility',
    'Falls as more is consumed',
    'Rises as more is consumed',
    'Stays constant',
    'Is always negative',
  ],
  [
    'A firm earns normal profit when price equals',
    'Average cost',
    'Marginal revenue only',
    'Average variable cost only',
    'Zero',
  ],
  ['Profit is maximised where', 'MR = MC', 'MR = AR', 'TR = TC', 'AC = MC'],
  [
    'The cross elasticity of demand between substitutes is',
    'Positive',
    'Negative',
    'Zero',
    'Infinite',
  ],
  [
    'Indifference curves are',
    'Convex to the origin',
    'Concave to the origin',
    'Vertical',
    'Horizontal',
  ],
  [
    'The kinked demand curve explains price rigidity in',
    'Oligopoly',
    'Monopoly',
    'Perfect competition',
    'Monopsony',
  ],
  [
    'An isoquant shows combinations of inputs that give the same',
    'Output',
    'Cost',
    'Price',
    'Utility',
  ],
  [
    'The phase of the business cycle after the peak is',
    'Contraction',
    'Expansion',
    'Recovery',
    'Trough',
  ],
  [
    'The father of economics is',
    'Adam Smith',
    'J. M. Keynes',
    'Alfred Marshall',
    'Lionel Robbins',
  ],
  [
    'Price discrimination is possible under',
    'Monopoly',
    'Perfect competition',
    'Any market with identical sellers',
    'Barter',
  ],
  [
    'Under increasing returns to scale, output grows',
    'More than in proportion to inputs',
    'Less than in proportion to inputs',
    'In the same proportion',
    'Not at all',
  ],
  [
    'A normal supply curve slopes',
    'Upwards',
    'Downwards',
    'Always horizontally',
    'Always vertically',
  ],
  [
    'National income at factor cost equals NNP at market prices minus',
    'Net indirect taxes',
    'Depreciation',
    'Exports',
    'Subsidies plus taxes',
  ],
  [
    'Inflation is',
    'A sustained rise in the general price level',
    'A fall in prices',
    'A rise in one price',
    'A rise in income',
  ],
  [
    'Economics as the science of scarcity and choice was defined by',
    'Lionel Robbins',
    'Adam Smith',
    'Alfred Marshall',
    'J. M. Keynes',
  ],
  [
    'Under perfect competition, marginal revenue equals',
    'Price',
    'Zero',
    'Total revenue',
    'Twice the price',
  ],
  [
    'As output rises, average fixed cost',
    'Keeps falling',
    'Rises',
    'Stays constant',
    'Is U-shaped',
  ],
  [
    'The demand for a Giffen good',
    'Rises when its price rises',
    'Falls when its price rises',
    'Does not change with price',
    'Is always zero',
  ],
  [
    'Consumer surplus is',
    'What a consumer is willing to pay minus what they pay',
    'Price times quantity',
    'Total utility minus price',
    'Income minus spending',
  ],
];

const CA_BUSINESS_MATHS: readonly Row[] = [
  ['log₁₀ 100 =', '2', '10', '1', '100'],
  ['5! =', '120', '25', '60', '20'],
  ['The mean of the first 5 natural numbers is', '3', '2.5', '5', '15'],
  [
    'Standard deviation measures',
    'Dispersion',
    'Central tendency',
    'Correlation',
    'Only skewness',
  ],
  [
    'If a : b = 2 : 3 and b : c = 3 : 4, then a : c =',
    '1 : 2',
    '3 : 4',
    '2 : 3',
    '4 : 3',
  ],
  [
    'Compound interest on ₹10,000 at 10% a year for 1 year is',
    '₹1,000',
    '₹1,100',
    '₹100',
    '₹10,000',
  ],
  [
    'The probability of rolling a 6 with a fair die is',
    '1/6',
    '1/3',
    '1/2',
    '6',
  ],
  ['The median of 1, 3, 5 and 7 is', '4', '3', '5', '16'],
  ['⁶C₀ =', '1', '0', '6', '720'],
  ['The sum 2 + 4 + 6 + … + 20 is', '110', '100', '120', '200'],
  ['log (ab) =', 'log a + log b', 'log a × log b', 'log a − log b', 'a log b'],
  [
    'In a symmetrical distribution',
    'Mean = median = mode',
    'Mean > median > mode',
    'Mean < mode',
    'There is no mode',
  ],
  [
    'Simple interest on ₹5,000 at 8% a year for 3 years is',
    '₹1,200',
    '₹400',
    '₹1,500',
    '₹1,000',
  ],
  ['The number of ways to arrange the letters of CAT is', '6', '3', '9', '27'],
  ['If 2ˣ = 32, then x =', '5', '4', '6', '16'],
  [
    'A correlation coefficient of +1 means',
    'Perfect positive correlation',
    'No correlation',
    'Perfect negative correlation',
    'Weak positive correlation',
  ],
  ['The index number for the base year is', '100', '0', '1', '1,000'],
  ['The second quartile (Q2) is the', 'Median', 'Mean', 'Mode', 'Range'],
  ['0! =', '1', '0', 'Undefined', '10'],
  ['If 2x − 4 = 10, then x =', '7', '3', '6', '14'],
];

export const SAMPLE_TEST_BANK = {
  class11: {
    accountancy: toPaper('11-accountancy', CLASS_11_ACCOUNTANCY),
    businessStudies: toPaper('11-business-studies', CLASS_11_BUSINESS_STUDIES),
    economics: toPaper('11-economics', CLASS_11_ECONOMICS),
    physics: toPaper('11-physics', CLASS_11_PHYSICS),
    chemistry: toPaper('11-chemistry', CLASS_11_CHEMISTRY),
    mathematics: toPaper('11-mathematics', CLASS_11_MATHEMATICS),
    biology: toPaper('11-biology', CLASS_11_BIOLOGY),
  },
  class12: {
    accountancy: toPaper('12-accountancy', CLASS_12_ACCOUNTANCY),
    businessStudies: toPaper('12-business-studies', CLASS_12_BUSINESS_STUDIES),
    economics: toPaper('12-economics', CLASS_12_ECONOMICS),
    physics: toPaper('12-physics', CLASS_12_PHYSICS),
    chemistry: toPaper('12-chemistry', CLASS_12_CHEMISTRY),
    mathematics: toPaper('12-mathematics', CLASS_12_MATHEMATICS),
    biology: toPaper('12-biology', CLASS_12_BIOLOGY),
  },
  jee: {
    physics: toPaper('jee-physics', JEE_PHYSICS),
    chemistry: toPaper('jee-chemistry', JEE_CHEMISTRY),
    mathematics: toPaper('jee-mathematics', JEE_MATHEMATICS),
  },
  neet: {
    physics: toPaper('neet-physics', NEET_PHYSICS),
    chemistry: toPaper('neet-chemistry', NEET_CHEMISTRY),
    biology: toPaper('neet-biology', NEET_BIOLOGY),
  },
  reasoning: {
    logical: toPaper('reasoning-logical', LOGICAL_REASONING),
    quantitative: toPaper('reasoning-quantitative', QUANTITATIVE_APTITUDE),
    verbal: toPaper('reasoning-verbal', VERBAL_ABILITY),
  },
  ca: {
    accounting: toPaper('ca-accounting', CA_ACCOUNTING),
    law: toPaper('ca-law', CA_BUSINESS_LAW),
    economics: toPaper('ca-economics', CA_BUSINESS_ECONOMICS),
    maths: toPaper('ca-maths', CA_BUSINESS_MATHS),
  },
} as const;

// A class or exam's subject paper, or null for keys it does not have
export const findSamplePaper = (
  trackKey: string,
  subjectKey: string,
): readonly SampleTestQuestion[] | null => {
  const track: Readonly<Record<string, readonly SampleTestQuestion[]>> | null =
    Object.hasOwn(SAMPLE_TEST_BANK, trackKey)
      ? SAMPLE_TEST_BANK[trackKey as keyof typeof SAMPLE_TEST_BANK]
      : null;
  return track && Object.hasOwn(track, subjectKey) ? track[subjectKey] : null;
};
