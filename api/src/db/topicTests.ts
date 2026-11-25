// The topics that have a paid topic test, and what one attempt costs. A
// student pays this for each 45-minute attempt at a topic's test. The
// catalogue shows it as each test topic's testPrice, and checkout charges it.
export const TOPIC_TEST_PRICE_PAISE = 500;

// How long one attempt lasts, from the moment the student starts it
export const TOPIC_TEST_DURATION_MINUTES = 45;

export const TOPIC_TEST_IDS: ReadonlySet<string> = new Set([
  'topic_accounts_gst_class_11',
  'topic_chemistry_bonding_class_11',
  'topic_physics_ray_optics_class_12',
  'topic_maths_integrals_class_12',
  'topic_chemistry_mole_concept_class_11',
  'topic_physics_current_electricity_class_12',
  'topic_physics_laws_of_motion_class_11',
  'topic_accounts_partnership_class_12',
]);
