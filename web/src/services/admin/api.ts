import { API_CLIENT } from '@services/http/api';

import type { TeamOrder, TeamTodayLoginsResponse } from './types';

export const listTeamOrders = async () =>
  (await API_CLIENT.get<{ orders: TeamOrder[] }>('/admin/orders')).data.orders;

export const listTodayTeamLogins = async () =>
  (await API_CLIENT.get<TeamTodayLoginsResponse>('/admin/activity/today')).data
    .logins;
