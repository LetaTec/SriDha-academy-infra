// The AI model paper waitlist. See catalogue.ts for what this folder is.

export type EnquiryType = 'MODEL_PAPER_WAITLIST';

export type ModelPaperExam = 'JEE' | 'NEET' | 'UPSC' | 'CA' | 'COMMERCE_11_12';

export type EnquiryRequest = {
  type: EnquiryType;
  email: string;
  exam: ModelPaperExam;
};

export type EnquiryResponse = {
  enquiry: { id: string; type: EnquiryType };
};
