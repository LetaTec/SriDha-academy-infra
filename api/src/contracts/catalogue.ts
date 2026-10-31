// The shape of GET /api/catalogue. This folder (api/src/contracts) is the
// one definition of what the API sends and accepts: the API builds its
// responses as these types and the website imports the same files
// (@contracts/*), so a change on either side fails the other's typecheck.
// Types only: nothing here runs.

export type Price = {
  amountPaise: number;
  currency: 'INR';
  taxLabel: string | null;
};

export type Lesson = {
  id: string;
  title: string;
  durationMinutes: number | null;
};

// Derived by the API from the stored status, the start date and the live
// seat count
export type BatchAvailability =
  'OPEN' | 'FULL' | 'CLOSED' | 'UPCOMING' | 'INACTIVE';

export type Batch = {
  id: string;
  name: string;
  scheduleLabel: string;
  startDate: string | null;
  startTime: string | null;
  sessionCount: number | null;
  sessionDurationMinutes: number | null;
  instructorName: string | null;
  capacity: number | null;
  seatsRemaining: number | null;
  availability: BatchAvailability;
};

export type Topic = {
  id: string;
  // The full title, e.g. "Learn GST for Class 11"
  title: string;
  // The name on topic cards, e.g. "GST"
  shortTitle: string;
  summary: string;
  level: string | null;
  // A name from the website's icon set; null means the subject's icon
  icon: string | null;
  // Featured topics lead the short lists, 1 first; null when not featured
  featuredRank: number | null;
  price: Price | null;
  lessons: Lesson[];
  batches: Batch[];
};

export type Chapter = {
  id: string;
  title: string;
  topics: Topic[];
};

export type SubjectStatus = 'AVAILABLE' | 'UPCOMING';

export type Subject = {
  id: string;
  // Stable key for a subject, e.g. "accounts" or "business-studies"
  slug: string;
  name: string;
  description: string;
  status: SubjectStatus;
  listPrice: Price | null;
  chapters: Chapter[];
};

export type CatalogueResponse = { subjects: Subject[] };
