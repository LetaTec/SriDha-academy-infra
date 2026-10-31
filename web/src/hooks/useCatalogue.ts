import { useCallback, useEffect, useState } from 'react';

import { getCatalogue, type Subject } from '@services/catalogue';

export type CatalogueState = {
  subjects: Subject[];
  isLoading: boolean;
  hasError: boolean;
  reload: () => void;
};

// One request serves every component on the page (header search, topic
// cards, payment panel), so they always agree on prices and batches.
let sharedRequest: Promise<Subject[]> | null = null;

const loadCatalogue = () => {
  sharedRequest ??= getCatalogue().catch(error => {
    sharedRequest = null;
    throw error;
  });
  return sharedRequest;
};

// For tests: each test starts without a cached catalogue
export const resetCatalogueCache = () => {
  sharedRequest = null;
};

export const useCatalogue = (): CatalogueState => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [requestId, setRequestId] = useState(0);

  useEffect(() => {
    let isActive = true;
    setIsLoading(true);
    setHasError(false);

    loadCatalogue()
      .then(nextSubjects => {
        if (isActive) setSubjects(nextSubjects);
      })
      .catch(error => {
        if (!isActive) return;
        console.error('[catalogue] failed to load catalogue', error);
        setHasError(true);
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [requestId]);

  const reload = useCallback(() => {
    sharedRequest = null;
    setRequestId(id => id + 1);
  }, []);

  // A failed load (the API was briefly down) retries when the student comes
  // back to the tab, so topics do not stay without their fees and batches.
  useEffect(() => {
    if (!hasError) return undefined;

    const retryWhenVisible = () => {
      if (document.visibilityState === 'visible') reload();
    };
    window.addEventListener('focus', retryWhenVisible);
    document.addEventListener('visibilitychange', retryWhenVisible);

    return () => {
      window.removeEventListener('focus', retryWhenVisible);
      document.removeEventListener('visibilitychange', retryWhenVisible);
    };
  }, [hasError, reload]);

  return { subjects, isLoading, hasError, reload };
};
