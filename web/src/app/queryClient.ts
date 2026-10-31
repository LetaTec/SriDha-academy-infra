import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { QueryClient } from '@tanstack/react-query';

// Server data the website reads, by query key. Hooks in src/hooks read
// them; a change on the server (a payment) invalidates the keys it affects.
export const QUERY_KEY = {
  catalogue: ['catalogue'],
  enrolments: ['enrolments'],
  preRegistrations: ['pre-registrations'],
  teamOrders: ['team-orders'],
} as const;

const MINUTE_MS = 60 * 1000;

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        // Data is refetched in the background after a minute, when the
        // tab regains focus or the connection returns
        staleTime: MINUTE_MS,
        retry: 2,
      },
    },
  });

// The catalogue is kept in this browser for a day, so a returning visitor
// sees every topic at once, even while the API wakes up; it is refreshed
// as soon as the API answers. Seats and payments are never kept.
export const CATALOGUE_CACHE_MAX_AGE_MS = 24 * 60 * MINUTE_MS;
// Raise when the catalogue's shape changes, so older copies are ignored
export const QUERY_CACHE_VERSION = 'catalogue-v1';

const browserStorage = () => {
  try {
    return window.localStorage;
  } catch {
    // Storage is blocked (private mode, site settings): nothing is kept
    return undefined;
  }
};

export const queryPersister = createSyncStoragePersister({
  storage: browserStorage(),
  key: 'sridha-academy-queries',
});

export const shouldPersistQuery = (query: {
  queryKey: readonly unknown[];
  state: { status: string };
}) =>
  query.queryKey[0] === QUERY_KEY.catalogue[0] &&
  query.state.status === 'success';
