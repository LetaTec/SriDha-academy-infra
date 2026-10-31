import type { EnrolmentStatus } from '@constants/catalogue';
import type { Batch, Lesson, Price } from '@services/catalogue';

export type Enrolment = {
  id: string;
  status: EnrolmentStatus;
  createdAt: string;
  subject: { id: string; slug: string; name: string };
  topic: {
    id: string;
    title: string;
    summary: string;
    level: string | null;
    price: Price | null;
    lessons: Lesson[];
  };
  batch: Batch;
};
