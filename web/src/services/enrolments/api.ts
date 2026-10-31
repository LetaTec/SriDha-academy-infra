import { API_CLIENT } from '@services/http/api';

import type { Enrolment } from './types';

export const listEnrolments = async () =>
  (await API_CLIENT.get<{ enrolments: Enrolment[] }>('/enrolments')).data
    .enrolments;
