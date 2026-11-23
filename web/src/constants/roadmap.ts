import type { StatusColor } from './status';

// Features that are still being built. Progress is derived from the
// milestones, so moving a milestone to "done" updates every progress figure.
export type MilestoneStatus = 'done' | 'active' | 'next';

export const MILESTONE_STATUS_LABEL: Record<MilestoneStatus, string> = {
  done: 'Written',
  active: 'Being written',
  next: 'Next chapter',
};

export const MILESTONE_STATUS_COLOR: Record<MilestoneStatus, StatusColor> = {
  done: 'positive',
  active: 'warning',
  next: 'neutral',
};

export type Milestone = {
  title: string;
  description: string;
  status: MilestoneStatus;
};

export type FeatureStep = {
  label: string;
  title: string;
  description: string;
};

export type FeatureRoadmap = {
  eyebrow: string;
  title: string;
  titleEmphasis: string;
  lead: string;
  milestones: readonly Milestone[];
  steps: readonly FeatureStep[];
};

export const ROADMAP_TEXT = {
  status: 'In the workshop',
  stamp: 'In progress',
  progressEyebrow: 'Build progress',
  progressTitle: 'Built',
  progressTitleEmphasis: 'so far.',
  progressDescription:
    'We are writing this feature chapter by chapter. Here is exactly where it stands',
  progressLabel: 'Built so far',
  progressCaption: (done: number, total: number) =>
    `${done} of ${total} chapters written`,
  chapterLabel: (index: number) => `Chapter ${String(index).padStart(2, '0')}`,
  stepsTitle: 'How it will',
  stepsTitleEmphasis: 'work.',
  ctaEyebrow: 'Meanwhile / 01',
  ctaTitle: 'Until then,',
  ctaTitleEmphasis: 'start with a topic.',
  ctaAction: 'Browse topics',
  joinWaitlist: 'Join the waitlist',
} as const;

// An active milestone counts as half written.
export const getRoadmapProgress = (milestones: readonly Milestone[]) => {
  const done = milestones.filter(item => item.status === 'done').length;
  const active = milestones.filter(item => item.status === 'active').length;
  const percent =
    milestones.length === 0
      ? 0
      : Math.round(((done + active / 2) / milestones.length) * 100);

  return { done, total: milestones.length, percent };
};

export const MODEL_PAPER_ROADMAP: FeatureRoadmap = {
  eyebrow: 'AI Model Paper / Coming soon',
  title: 'Revise with',
  titleEmphasis: 'what matters.',
  lead: 'Model papers prepared from the last five years of papers and the subject book, reviewed by teachers and delivered seven days before the exam',
  milestones: [
    {
      title: 'Five years of past papers',
      description: 'Collected and organised chapter by chapter',
      status: 'done',
    },
    {
      title: 'Pattern analysis',
      description: 'Which chapters and question types appear most often',
      status: 'active',
    },
    {
      title: 'Teacher review panel',
      description: 'Every model paper checked by subject teachers',
      status: 'next',
    },
    {
      title: 'Seven-day delivery',
      description: 'Papers reach students a week before the exam',
      status: 'next',
    },
    {
      title: 'First papers',
      description: 'Model papers for Class 11 and Class 12 students',
      status: 'next',
    },
  ],
  steps: [
    {
      label: '01',
      title: 'Join the waitlist',
      description: 'Tell us your class and exam',
    },
    {
      label: '02',
      title: 'Papers are prepared',
      description: 'Built from past papers and the subject book',
    },
    {
      label: '03',
      title: 'Teachers review',
      description: 'Every paper is checked before it is released',
    },
    {
      label: '04',
      title: 'Seven days before',
      description: 'Your model paper arrives a week before the exam',
    },
  ],
};
