import type { IconName } from '@constants/icons';

export type SubjectTheme =
  | 'tax-ledger'
  | 'ledger-ivory'
  | 'terracotta-data'
  | 'graphite-geometric'
  | 'sage-molecular'
  | 'ochre-logic'
  | 'editorial-serif'
  | 'architectural-green';

export type AcademicDiscipline =
  | 'Commerce & Tax'
  | 'Accountancy'
  | 'Economics & Data'
  | 'Mathematics'
  | 'Science'
  | 'Reasoning & Aptitude'
  | 'Language & Literature'
  | 'Management';

export type ShowcaseSubject = {
  id: string;
  title: string;
  level: string;
  icon: IconName;
  experience: string;
  theme: SubjectTheme;
  discipline: AcademicDiscipline;
  motifLabel: string;
  catalogueTopicId?: string;
  highlights?: readonly string[];
};

// SriDha Academy — The Living Library
// Curated collection of academic subjects across Commerce, Mathematics,
// Reasoning, Humanities, and Science with individual editorial visual treatments.
export const SHOWCASE_SUBJECTS: readonly ShowcaseSubject[] = [
  {
    id: 'gst',
    title: 'GST',
    level: 'Class 11 & Professional',
    icon: 'topicGst',
    experience: 'Input tax credit, returns & invoice rules',
    theme: 'tax-ledger',
    discipline: 'Commerce & Tax',
    motifLabel: 'SEC 46 / TAX INVOICE',
    catalogueTopicId: 'topic_accounts_gst_class_11',
    highlights: [
      'Input tax credit & ledger entries',
      'Tax invoice rules & documentation',
      'Live return filing batches',
    ],
  },
  {
    id: 'science',
    title: 'Science',
    level: 'Class 10 & Foundation',
    icon: 'topicScience',
    experience: 'Core physical concepts & empirical laws',
    theme: 'sage-molecular',
    discipline: 'Science',
    motifLabel: 'EMPIRICAL PRINCIPLES',
    highlights: [
      'Fundamental physical principles',
      'Chemical equations & reactions',
      'Structured concept verification',
    ],
  },
  {
    id: 'accounts',
    title: 'Accounts',
    level: 'Class 11 & 12',
    icon: 'topicAccounts',
    experience: 'Ledger totals, journal entries & trial balance',
    theme: 'ledger-ivory',
    discipline: 'Accountancy',
    motifLabel: 'FOLIO / DR. & CR.',
    highlights: [
      'Dual-entry bookkeeping system',
      'Journal entries & ledger balancing',
      'Trial balance verification',
    ],
  },
  {
    id: 'economics',
    title: 'Economics',
    level: 'Class 11 & 12',
    icon: 'topicEconomics',
    experience: 'Elasticity, market forms & national income',
    theme: 'terracotta-data',
    discipline: 'Economics & Data',
    motifLabel: 'EQUILIBRIUM CURVE',
    highlights: [
      'Demand & supply elasticity',
      'Market structures & equilibrium',
      'National income aggregates',
    ],
  },
  {
    id: 'mathematics',
    title: 'Mathematics',
    level: 'Class 11 & 12',
    icon: 'topicMathematics',
    experience: 'Calculus, matrices & coordinate geometry',
    theme: 'graphite-geometric',
    discipline: 'Mathematics',
    motifLabel: '∫ f(x) dx · MATRIX ALGEBRA',
    highlights: [
      'Calculus & derivative theorems',
      'Matrix algebra & linear systems',
      'Step-by-step problem sets',
    ],
  },
  {
    id: 'english',
    title: 'English',
    level: 'Class 11 & 12',
    icon: 'topicEnglish',
    experience: 'Critical discourse, syntax & literature',
    theme: 'editorial-serif',
    discipline: 'Language & Literature',
    motifLabel: 'EDITORIAL PROSE',
    highlights: [
      'Critical analysis & comprehension',
      'Formal syntax & discourse rules',
      'Authorial argument mapping',
    ],
  },
  {
    id: 'banking_reasoning',
    title: 'Banking Reasoning',
    level: 'Competitive Exams',
    icon: 'topicReasoning',
    experience: 'Seating arrangements & syllogistic logic',
    theme: 'ochre-logic',
    discipline: 'Reasoning & Aptitude',
    motifLabel: 'DEDUCTION MATRIX',
  },
  {
    id: 'business_studies',
    title: 'Business Studies',
    level: 'Class 11 & 12',
    icon: 'topicBusiness',
    experience: 'Organizational structures & management',
    theme: 'architectural-green',
    discipline: 'Management',
    motifLabel: 'ENTERPRISE ARCHITECTURE',
  },
  {
    id: 'rectification_of_errors',
    title: 'Rectification of Errors',
    level: 'Class 11 Accountancy',
    icon: 'topicRectification',
    experience: 'Suspense accounts & one-sided correction',
    theme: 'ledger-ivory',
    discipline: 'Accountancy',
    motifLabel: 'SUSPENSE A/C ADJUSTMENT',
  },
  {
    id: 'trial_balance',
    title: 'Trial Balance',
    level: 'Class 11 Accountancy',
    icon: 'topicTrialBalance',
    experience: 'Arithmetic accuracy of dual book-keeping',
    theme: 'ledger-ivory',
    discipline: 'Accountancy',
    motifLabel: 'DUAL ENTRY EQUILIBRIUM',
  },
  {
    id: 'bank_reconciliation',
    title: 'Bank Reconciliation Statement',
    level: 'Class 11 Accountancy',
    icon: 'topicBank',
    experience: 'Cash book vs pass book timing reconciliation',
    theme: 'tax-ledger',
    discipline: 'Commerce & Tax',
    motifLabel: 'PASSBOOK CLEARING',
  },
  {
    id: 'accountancy',
    title: 'Accountancy',
    level: 'Class 12 & Foundation',
    icon: 'topicAccountancy',
    experience: 'Company balance sheets & debentures',
    theme: 'ledger-ivory',
    discipline: 'Accountancy',
    motifLabel: 'CORPORATE LEDGER',
  },
  {
    id: 'business_mathematics',
    title: 'Business Mathematics',
    level: 'Commerce & Management',
    icon: 'topicBusinessMath',
    experience: 'Annuities, interest calculus & linear programming',
    theme: 'graphite-geometric',
    discipline: 'Mathematics',
    motifLabel: 'FINANCIAL CALCULUS',
  },
  {
    id: 'statistics',
    title: 'Statistics',
    level: 'Economics & Research',
    icon: 'topicStatistics',
    experience: 'Variance, standard deviation & index numbers',
    theme: 'terracotta-data',
    discipline: 'Economics & Data',
    motifLabel: 'SIGMA DISPERSION',
  },
  {
    id: 'logical_reasoning',
    title: 'Logical Reasoning',
    level: 'Aptitude & Entrance',
    icon: 'topicLogicalReasoning',
    experience: 'Venn diagrams, causal deduction & puzzles',
    theme: 'ochre-logic',
    discipline: 'Reasoning & Aptitude',
    motifLabel: 'ANALYTIC LOGIC',
  },
  {
    id: 'quantitative_aptitude',
    title: 'Quantitative Aptitude',
    level: 'Competitive Exams',
    icon: 'topicQuant',
    experience: 'Work-time, compound ratio & speed mathematics',
    theme: 'graphite-geometric',
    discipline: 'Reasoning & Aptitude',
    motifLabel: 'QUANTITATIVE RATIO',
  },
  {
    id: 'english_grammar',
    title: 'English Grammar',
    level: 'Foundational & Exam',
    icon: 'topicGrammar',
    experience: 'Active-passive, conditional clauses & voice',
    theme: 'editorial-serif',
    discipline: 'Language & Literature',
    motifLabel: 'SYNTAX & CLAUSES',
  },
  {
    id: 'reading_comprehension',
    title: 'Reading Comprehension',
    level: 'Verbal Ability',
    icon: 'topicComprehension',
    experience: 'Inference, authorial tone & argument mapping',
    theme: 'editorial-serif',
    discipline: 'Language & Literature',
    motifLabel: 'PASSAGE EXEGESIS',
  },
  {
    id: 'financial_accounting',
    title: 'Financial Accounting',
    level: 'Professional Studies',
    icon: 'topicFinancialAccounting',
    experience: 'Depreciation, inventory valuation & final accounts',
    theme: 'ledger-ivory',
    discipline: 'Accountancy',
    motifLabel: 'BALANCE SHEET AUDIT',
  },
  {
    id: 'partnership_accounts',
    title: 'Partnership Accounts',
    level: 'Class 12 Commerce',
    icon: 'topicPartnership',
    experience: 'Admission, revaluation & sacrifice ratio',
    theme: 'ledger-ivory',
    discipline: 'Accountancy',
    motifLabel: 'SACRIFICE RATIO & GOODWILL',
  },
  {
    id: 'cash_flow_statements',
    title: 'Cash Flow Statements',
    level: 'Class 12 Accountancy',
    icon: 'topicCashFlow',
    experience: 'Operating, investing & financing activities',
    theme: 'tax-ledger',
    discipline: 'Commerce & Tax',
    motifLabel: 'AS-3 CASH INFLOW/OUTFLOW',
  },
  {
    id: 'probability',
    title: 'Probability',
    level: 'Class 11 & 12',
    icon: 'topicProbability',
    experience: 'Bayes theorem, conditional odds & distributions',
    theme: 'graphite-geometric',
    discipline: 'Mathematics',
    motifLabel: 'P(A|B) · BAYES EQUATION',
  },
  {
    id: 'data_interpretation',
    title: 'Data Interpretation',
    level: 'Competitive Exams',
    icon: 'topicDataInterpretation',
    experience: 'Comparative graphs, radar charts & caselets',
    theme: 'terracotta-data',
    discipline: 'Economics & Data',
    motifLabel: 'GRAPHICAL SYNTHESIS',
  },
] as const;
