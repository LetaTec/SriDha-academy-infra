import { useSyncExternalStore } from 'react';

// The question banks are large, so each is its own download, fetched once
// on first use. They are files shipped with the website, not server data,
// so they need no query cache: a tiny store keeps each module once it
// arrives, and components read null until then (a paper draws its frame
// at full size meanwhile, so nothing on the page moves).

type SampleModule = typeof import('@constants/sampleTestPapers');
type TopicModule = typeof import('@constants/topicTestPapers');

const createModuleStore = <Module>(load: () => Promise<Module>) => {
  let loaded: Module | null = null;
  let loading: Promise<Module> | null = null;
  const listeners = new Set<() => void>();

  const start = () =>
    (loading ??= load().then(module => {
      loaded = module;
      listeners.forEach(listener => listener());
      return module;
    }));

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    void start();
    return () => {
      listeners.delete(listener);
    };
  };

  return { start, subscribe, read: () => loaded };
};

const samplePapers = createModuleStore<SampleModule>(
  () => import('@constants/sampleTestPapers'),
);
const topicPapers = createModuleStore<TopicModule>(
  () => import('@constants/topicTestPapers'),
);

// Start a download early, e.g. while a student reads the rules
export const loadSamplePapers = samplePapers.start;
export const loadTopicPapers = topicPapers.start;

// The questions of a class or exam's subject paper; null while downloading
export const useSamplePaper = (trackKey: string, subjectKey: string) => {
  const module = useSyncExternalStore(
    samplePapers.subscribe,
    samplePapers.read,
  );
  return module ? (module.findSamplePaper(trackKey, subjectKey) ?? []) : null;
};

// A topic's test questions; null while downloading
export const useTopicPaper = (topicId: string) => {
  const module = useSyncExternalStore(topicPapers.subscribe, topicPapers.read);
  return module ? (module.findTopicTest(topicId) ?? []) : null;
};
