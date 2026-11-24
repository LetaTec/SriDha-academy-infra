// The roster for 15 December 2026 to 14 January 2027: every batch from the
// team's sheet ("SriDha_Time and Topic Roster.xlsx", Sheet1), by topic.
// A batch is one class (B1), or two sessions on consecutive days (B1/S1 and
// B1/S2: a two-day lecture). All classes are in studio 1, and the roster
// gives 300 seats to every batch.

const SESSION_ONE_CAPACITY = 300;

type RosterClass = {
  // YYYY-MM-DD
  date: string;
};

type RosterBatch = {
  classes: readonly RosterClass[];
};

type RosterTopic = {
  topicId: string;
  teacher: string;
  // 24-hour start time, e.g. "20:30", and how long each class lasts
  startTime: string;
  durationMinutes: number;
  batches: readonly RosterBatch[];
};

const on = (...dates: string[]): RosterBatch => ({
  classes: dates.map(date => ({ date })),
});

export const SESSION_ONE_ROSTER: readonly RosterTopic[] = [
  {
    topicId: 'topic_mathematics_alphabet_test_class_8',
    teacher: 'Kamini Jain',
    startTime: '15:00',
    durationMinutes: 120,
    batches: [on('2026-12-19'), on('2026-12-20')],
  },
  // The third Alphabet test batch is earlier in the day
  {
    topicId: 'topic_mathematics_alphabet_test_class_8',
    teacher: 'Kamini Jain',
    startTime: '13:00',
    durationMinutes: 120,
    batches: [on('2026-12-25')],
  },
  {
    topicId: 'topic_mathematics_coding_and_decoding_class_8',
    teacher: 'Kamini Jain',
    startTime: '13:00',
    durationMinutes: 120,
    batches: [on('2026-12-26'), on('2026-12-29'), on('2026-12-31')],
  },
  {
    topicId: 'topic_accountancy_rectification_of_errors_class_11',
    teacher: 'Richa Varyani',
    startTime: '11:00',
    durationMinutes: 120,
    batches: [on('2026-12-25'), on('2026-12-29'), on('2026-12-31')],
  },
  {
    topicId: 'topic_accountancy_bank_reconciliation_statement_class_11',
    teacher: 'Richa Varyani',
    startTime: '11:00',
    durationMinutes: 120,
    batches: [on('2026-12-26'), on('2026-12-27')],
  },
  {
    topicId: 'topic_mathematics_time_and_work_ca_cpt',
    teacher: 'Utkarsh Verma',
    startTime: '20:30',
    durationMinutes: 90,
    batches: [
      on('2026-12-21', '2026-12-22'),
      on('2026-12-23', '2026-12-24'),
      on('2026-12-25', '2026-12-26'),
    ],
  },
  {
    topicId: 'topic_mathematics_quadratic_equations_class_10',
    teacher: 'Utkarsh Verma',
    startTime: '20:30',
    durationMinutes: 90,
    batches: [
      on('2026-12-27', '2026-12-28'),
      on('2026-12-29', '2026-12-30'),
      on('2027-01-01', '2027-01-02'),
    ],
  },
  {
    topicId: 'topic_mathematics_polynomials_class_9',
    teacher: 'Utkarsh Verma',
    startTime: '20:30',
    durationMinutes: 90,
    batches: [
      on('2027-01-03', '2027-01-04'),
      on('2027-01-05', '2027-01-06'),
      on('2027-01-07', '2027-01-08'),
    ],
  },
  {
    topicId: 'topic_mathematics_sets_class_11',
    teacher: 'Utkarsh Verma',
    startTime: '20:30',
    durationMinutes: 90,
    batches: [
      on('2027-01-09', '2027-01-10'),
      on('2027-01-11', '2027-01-12'),
      on('2027-01-13', '2027-01-14'),
    ],
  },
  {
    topicId: 'topic_economics_demand_class_11',
    teacher: 'Anshu Malpani',
    startTime: '15:00',
    durationMinutes: 120,
    batches: [on('2026-12-25', '2026-12-26'), on('2026-12-27', '2026-12-28')],
  },
  {
    topicId: 'topic_economics_production_class_11',
    teacher: 'Anshu Malpani',
    startTime: '15:00',
    durationMinutes: 120,
    batches: [on('2026-12-29'), on('2026-12-30')],
  },
  {
    topicId: 'topic_economics_market_class_11',
    teacher: 'Anshu Malpani',
    startTime: '15:00',
    durationMinutes: 120,
    batches: [on('2026-12-31'), on('2027-01-01')],
  },
  {
    topicId: 'topic_mathematics_logarithms_ca_cpt',
    teacher: 'Sakshi',
    startTime: '09:00',
    durationMinutes: 120,
    batches: [
      on('2026-12-20'),
      on('2026-12-27'),
      on('2026-12-31'),
      on('2027-01-03'),
    ],
  },
  {
    topicId: 'topic_mathematics_trigonometry_class_10',
    teacher: 'Sakshi',
    startTime: '11:00',
    durationMinutes: 120,
    batches: [on('2026-12-20'), on('2027-01-03')],
  },
  {
    topicId: 'topic_economics_business_cycles_ca_cpt',
    teacher: 'Purva',
    startTime: '09:00',
    durationMinutes: 120,
    batches: [on('2026-12-17'), on('2026-12-21'), on('2026-12-23')],
  },
  {
    topicId: 'topic_economics_balance_of_payments_class_12',
    teacher: 'Purva',
    startTime: '09:00',
    durationMinutes: 120,
    batches: [on('2026-12-24'), on('2026-12-26'), on('2026-12-28')],
  },
  {
    topicId: 'topic_accountancy_admission_of_a_partner_class_12',
    teacher: 'Purva',
    startTime: '09:00',
    durationMinutes: 120,
    batches: [on('2026-12-29'), on('2026-12-30')],
  },
];

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const ordinal = (day: number) => {
  const tens = day % 100;
  if (tens >= 11 && tens <= 13) return `${day}th`;
  return `${day}${['th', 'st', 'nd', 'rd'][day % 10] ?? 'th'}`;
};

// "19th December", or "21st & 22nd December" for a two-class batch
const scheduleLabel = (dates: readonly string[]) => {
  const parts = dates.map(date => {
    const [, month, day] = date.split('-').map(Number);
    return { day: ordinal(day), month: MONTHS[month - 1] };
  });
  const sameMonth = parts.every(part => part.month === parts[0].month);
  return sameMonth
    ? `${parts.map(part => part.day).join(' & ')} ${parts[0].month}`
    : parts.map(part => `${part.day} ${part.month}`).join(' & ');
};

export type RosterSeedBatch = {
  id: string;
  name: string;
  scheduleLabel: string;
  startDate: string;
  startTime: string;
  sessionCount: number;
  sessionDurationMinutes: number;
  instructorName: string;
  capacity: number;
  status: 'OPEN';
};

// Topic id → its batches from this roster, numbered in date order from 1
export const sessionOneBatchesByTopic = (): ReadonlyMap<
  string,
  RosterSeedBatch[]
> => {
  const byTopic = new Map<string, RosterSeedBatch[]>();

  for (const topic of SESSION_ONE_ROSTER) {
    for (const batch of topic.batches) {
      const dates = batch.classes.map(item => item.date);
      const list = byTopic.get(topic.topicId) ?? [];
      list.push({
        id: '',
        name: '',
        scheduleLabel: scheduleLabel(dates),
        startDate: dates[0],
        startTime: topic.startTime,
        sessionCount: dates.length,
        sessionDurationMinutes: topic.durationMinutes,
        instructorName: topic.teacher,
        capacity: SESSION_ONE_CAPACITY,
        status: 'OPEN',
      });
      byTopic.set(topic.topicId, list);
    }
  }

  for (const [topicId, list] of byTopic) {
    const key = topicId.replace(/^topic_/, '');
    list
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .forEach((batch, index) => {
        batch.id = `batch_${key}_b${index + 1}`;
        batch.name = `Batch ${index + 1}`;
      });
  }

  return byTopic;
};
