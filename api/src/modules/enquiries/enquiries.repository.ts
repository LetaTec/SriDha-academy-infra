import type { DatabaseClient } from '../../db/client.js';

export const insertEnquiry = (
  db: DatabaseClient,
  enquiry: {
    id: string;
    type: string;
    email: string;
    exam: string;
    userId: string | null;
    createdAt: string;
  },
) =>
  db.query(
    `INSERT INTO enquiries (id, type, email, exam, user_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      enquiry.id,
      enquiry.type,
      enquiry.email,
      enquiry.exam,
      enquiry.userId,
      enquiry.createdAt,
    ],
  );
