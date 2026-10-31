export type ConceptNode = {
  id: string;
  step: string;
  title: string;
  category: string;
  summary: string;
  subtopics: readonly string[];
  statusLabel: string;
  catalogueTopicId?: string;
};

export type MapSubject = {
  id: string;
  name: string;
  level: string;
  discipline: string;
  initialNodeId: string;
  nodes: readonly ConceptNode[];
};

export const CONCEPT_MAP_SUBJECTS: readonly MapSubject[] = [
  {
    id: 'partnership_accounts',
    name: 'Partnership Accounts',
    level: 'Class 12 Commerce',
    discipline: 'Accountancy',
    initialNodeId: 'partnership_fundamentals',
    nodes: [
      {
        id: 'partnership_fundamentals',
        step: '01',
        title: 'Partnership Fundamentals',
        category: 'Foundation',
        summary:
          'Core provisions of the Indian Partnership Act, Profit & Loss Appropriation account, and fluctuating vs fixed capital methods.',
        subtopics: [
          'Provisions in absence of deed',
          'P&L Appropriation account',
          'Interest on capital & drawings',
          "Partners' capital accounts",
        ],
        statusLabel: 'Class 12 Core Concept',
      },
      {
        id: 'goodwill_valuation',
        step: '02',
        title: 'Valuation of Goodwill',
        category: 'Valuation',
        summary:
          'Techniques for valuing intangible firm reputation during reconstitution: average profits, super profits, and capitalisation.',
        subtopics: [
          'Average profit method',
          'Super profit method',
          'Capitalisation of average profits',
          'Treatment of abnormal items',
        ],
        statusLabel: 'Valuation Methods',
      },
      {
        id: 'profit_sharing_ratio',
        step: '03',
        title: 'Change in Ratio',
        category: 'Reconstitution',
        summary:
          'Calculating sacrificing and gaining shares among continuing partners, revaluation of existing assets, and reserve apportionment.',
        subtopics: [
          'Sacrificing & gaining ratio',
          'Revaluation account preparation',
          'Workmen compensation reserve',
          'Investment fluctuation reserve',
        ],
        statusLabel: 'Ratio Adjustment',
      },
      {
        id: 'admission_of_partner',
        step: '04',
        title: 'Admission of a Partner',
        category: 'Core Module',
        summary:
          'Accounting for new partner capital, premium for goodwill distribution, asset/liability revaluation, and adjusted balance sheet.',
        subtopics: [
          'New profit sharing ratio',
          'Premium for goodwill allocation',
          'Revaluation account balances',
          'Opening balance sheet',
        ],
        statusLabel: 'Core Examination Module',
      },
      {
        id: 'retirement_and_death',
        step: '05',
        title: 'Retirement & Death',
        category: 'Settlement',
        summary:
          'Determining retiring partner dues, gaining ratio calculation, treatment of goodwill, and settlement of loan or executor accounts.',
        subtopics: [
          'Gaining ratio determination',
          'Goodwill adjustment through capital',
          "Retiring partner's loan account",
          "Deceased partner's profit share",
        ],
        statusLabel: 'Advanced Reconstitution',
      },
      {
        id: 'dissolution_of_firm',
        step: '06',
        title: 'Firm Dissolution',
        category: 'Closure',
        summary:
          'Closing firm books through Realisation account, settling third-party claims, partner loans, and final capital distributions.',
        subtopics: [
          'Realisation account preparation',
          'Outside liabilities settlement',
          'Partner loan repayment',
          'Final cash closing entry',
        ],
        statusLabel: 'Final Accounts Closure',
      },
    ],
  },
  {
    id: 'gst_accounts',
    name: 'Goods & Services Tax (GST)',
    level: 'Class 11 Accountancy',
    discipline: 'Commerce & Tax',
    initialNodeId: 'gst_what_is',
    nodes: [
      {
        id: 'gst_what_is',
        step: '01',
        title: 'What is GST',
        category: 'Tax Framework',
        summary:
          'Dual GST framework (CGST, SGST, IGST), destination principle, and classification of inter-state vs intra-state taxable events.',
        subtopics: [
          'CGST, SGST and IGST distinction',
          'Inter-state vs intra-state supply',
          'Taxable events & threshold limits',
        ],
        statusLabel: 'Live Batch Available',
        catalogueTopicId: 'topic_accounts_gst_class_11',
      },
      {
        id: 'gst_entries',
        step: '02',
        title: 'GST Ledger Entries',
        category: 'Bookkeeping',
        summary:
          'Recording taxes paid on inward supplies (Input GST) and taxes collected on outward supplies (Output GST) in primary books.',
        subtopics: [
          'Input CGST & SGST accounts',
          'Output CGST & SGST accounts',
          'Reverse charge entries',
        ],
        statusLabel: 'Live Batch Available',
        catalogueTopicId: 'topic_accounts_gst_class_11',
      },
      {
        id: 'gst_input_tax_credit',
        step: '03',
        title: 'Input Tax Credit (ITC)',
        category: 'Tax Offsetting',
        summary:
          'Rules and statutory order for setting off input tax against output tax liability, including blocked credit under Section 17(5).',
        subtopics: [
          'Prescribed order of ITC set-off',
          'Eligible vs blocked credits',
          'Documentation requirements',
        ],
        statusLabel: 'Live Batch Available',
        catalogueTopicId: 'topic_accounts_gst_class_11',
      },
      {
        id: 'gst_journal_entries',
        step: '04',
        title: 'Journal & Settlement',
        category: 'Practical Applications',
        summary:
          'Comprehensive journal entries covering trade discounts, cash discounts, purchase/sales returns, and monthly government remittance.',
        subtopics: [
          'Trade vs cash discount with GST',
          'Purchase & sales returns with tax',
          'Monthly tax settlement entry',
        ],
        statusLabel: 'Live Batch Available',
        catalogueTopicId: 'topic_accounts_gst_class_11',
      },
    ],
  },
] as const;
