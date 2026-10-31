import { API_CLIENT } from '@services/http/api';

import type { TeamOrder } from './types';

export const listTeamOrders = async () =>
  (await API_CLIENT.get<{ orders: TeamOrder[] }>('/admin/orders')).data.orders;
