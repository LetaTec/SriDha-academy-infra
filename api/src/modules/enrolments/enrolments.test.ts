import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import {
  startTestServer,
  validRegistration,
  type TestClient,
} from '../../test/testServer.js';

const NOVEMBER_BATCH = 'batch_gst_class_11_november';
const DECEMBER_BATCH = 'batch_gst_class_11_december';

describe('catalogue and enrolments', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;
  let student: TestClient;
  let studentId: string;
  let otherStudent: TestClient;

  before(async () => {
    server = await startTestServer();
    student = server.createClient();
    const registered = await student.request(
      'POST',
      '/api/auth/register',
      validRegistration(),
    );
    studentId = registered.body.user.id;

    otherStudent = server.createClient();
    await otherStudent.request(
      'POST',
      '/api/auth/register',
      validRegistration({ email: 'ravi@example.com', fullName: 'Ravi Shah' }),
    );
  });

  after(async () => {
    await server.close();
  });

  it('serves the public catalogue as subject → chapter → topic → lesson → batch', async () => {
    const response = await server
      .createClient()
      .request('GET', '/api/catalogue');

    assert.equal(response.status, 200);
    const accounts = response.body.subjects.find(
      (subject: { slug: string }) => subject.slug === 'accounts',
    );
    const topic = accounts.chapters[0].topics[0];
    assert.equal(topic.title, 'Learn GST for Class 11');
    assert.equal(topic.lessons.length, 4);
    assert.deepEqual(topic.price, {
      amountPaise: 12900,
      currency: 'INR',
      taxLabel: null,
    });
    assert.equal(topic.batches[0].availability, 'OPEN');
    assert.equal(topic.batches[0].seatsRemaining, 100);
    assert.equal(topic.batches[0].instructorName, null);
  });

  // Seats are only taken through checkout; the amount and student come
  // from the server
  const checkout = (
    client: TestClient,
    batchId: string,
    extra: Record<string, unknown> = {},
  ) =>
    client.request('POST', '/api/payments/checkout', {
      kind: 'ENROLMENT',
      batchId,
      fullName: 'Asha Verma',
      email: 'asha@example.com',
      mobile: '+91 98765 43210',
      ...extra,
    });

  it('requires authentication to enrol', async () => {
    const response = await checkout(server.createClient(), NOVEMBER_BATCH);

    assert.equal(response.status, 401);
    assert.equal(response.body.code, 'UNAUTHENTICATED');
  });

  it('no longer reserves seats without checkout', async () => {
    const response = await student.request('POST', '/api/enrolments', {
      batchId: NOVEMBER_BATCH,
    });

    assert.equal(response.status, 404);
  });

  it('enrols the signed-in student as pending payment', async () => {
    const response = await checkout(student, NOVEMBER_BATCH);
    assert.equal(response.status, 201);

    const mine = await student.request('GET', '/api/enrolments');
    const [enrolment] = mine.body.enrolments;
    assert.equal(enrolment.status, 'PENDING_PAYMENT');
    assert.equal(enrolment.batch.id, NOVEMBER_BATCH);
    assert.equal(enrolment.batch.seatsRemaining, 99);
    assert.equal(enrolment.topic.lessons.length, 4);

    const row = await server.db.get<{ user_id: string }>(
      'SELECT user_id FROM enrolments WHERE id = $1',
      [enrolment.id],
    );
    assert.equal(row?.user_id, studentId);
  });

  it('reuses the pending seat when the student checks out again', async () => {
    const response = await checkout(student, NOVEMBER_BATCH);
    assert.equal(response.status, 201);

    const count = await server.db.get<{ count: string | number }>(
      'SELECT COUNT(*) AS count FROM enrolments WHERE user_id = $1 AND batch_id = $2',
      [studentId, NOVEMBER_BATCH],
    );
    assert.equal(Number(count?.count), 1);
  });

  it('cannot enrol another user by supplying their id', async () => {
    const response = await checkout(otherStudent, DECEMBER_BATCH, {
      userId: studentId,
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.code, 'REQUEST_VALIDATION_FAILED');

    const count = await server.db.get<{ count: string | number }>(
      'SELECT COUNT(*) AS count FROM enrolments WHERE user_id = $1 AND batch_id = $2',
      [studentId, DECEMBER_BATCH],
    );
    assert.equal(Number(count?.count), 0);
  });

  it('only lists the signed-in student’s own enrolments', async () => {
    const mine = await student.request('GET', '/api/enrolments');
    const theirs = await otherStudent.request('GET', '/api/enrolments');

    assert.equal(mine.body.enrolments.length, 1);
    assert.equal(theirs.body.enrolments.length, 0);
  });

  it('validates batch identifiers on the server', async () => {
    const response = await checkout(student, 'batch_does_not_exist');

    assert.equal(response.status, 404);
    assert.equal(response.body.code, 'BATCH_NOT_FOUND');
  });

  it('refuses inactive batches with their actual status', async () => {
    await server.db.query(
      "UPDATE batches SET status = 'INACTIVE' WHERE id = $1",
      [DECEMBER_BATCH],
    );

    try {
      const response = await checkout(otherStudent, DECEMBER_BATCH);
      assert.equal(response.status, 409);
      assert.equal(response.body.code, 'BATCH_UNAVAILABLE');
      assert.equal(response.body.details.availability, 'INACTIVE');
    } finally {
      await server.db.query(
        "UPDATE batches SET status = 'OPEN' WHERE id = $1",
        [DECEMBER_BATCH],
      );
    }
  });

  it('refuses full batches', async () => {
    await server.db.query('UPDATE batches SET capacity = 1 WHERE id = $1', [
      NOVEMBER_BATCH,
    ]);

    try {
      const response = await checkout(otherStudent, NOVEMBER_BATCH);
      assert.equal(response.status, 409);
      assert.equal(response.body.code, 'BATCH_FULL');

      const catalogue = await otherStudent.request('GET', '/api/catalogue');
      const batch = catalogue.body.subjects[0].chapters[0].topics[0].batches[0];
      assert.equal(batch.availability, 'FULL');
      assert.equal(batch.seatsRemaining, 0);
    } finally {
      await server.db.query('UPDATE batches SET capacity = 100 WHERE id = $1', [
        NOVEMBER_BATCH,
      ]);
    }
  });

  it('closes batches whose start date has passed', async () => {
    await server.db.query(
      "UPDATE batches SET start_date = '2026-10-01' WHERE id = $1",
      [DECEMBER_BATCH],
    );

    try {
      const response = await checkout(otherStudent, DECEMBER_BATCH);
      assert.equal(response.status, 409);
      assert.equal(response.body.details.availability, 'CLOSED');
    } finally {
      await server.db.query(
        "UPDATE batches SET start_date = '2026-12-08' WHERE id = $1",
        [DECEMBER_BATCH],
      );
    }
  });
});

describe('enquiries', () => {
  it('stores model paper waitlist sign-ups and rejects counselling requests', async () => {
    const server = await startTestServer();

    try {
      const client = server.createClient();
      const waitlist = await client.request('POST', '/api/enquiries', {
        type: 'MODEL_PAPER_WAITLIST',
        email: 'priya@example.com',
        exam: 'COMMERCE_11_12',
      });
      assert.equal(waitlist.status, 201);
      assert.equal(waitlist.body.enquiry.type, 'MODEL_PAPER_WAITLIST');

      const counselling = await client.request('POST', '/api/enquiries', {
        type: 'COUNSELLING',
        email: 'priya@example.com',
      });
      assert.equal(counselling.status, 400);
      assert.equal(counselling.body.code, 'REQUEST_VALIDATION_FAILED');
    } finally {
      await server.close();
    }
  });
});
