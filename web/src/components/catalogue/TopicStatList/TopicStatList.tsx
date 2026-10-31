import { StatList, type StatListProps } from '@components/ui/StatList/StatList';
import { useStatsWithTopicCount } from '@hooks/useTopicPreviews';

export type TopicStatListProps = StatListProps;

// A stat list whose LIVE_TOPIC_COUNT entry shows how many topics the
// catalogue has
export const TopicStatList = ({ items, className }: TopicStatListProps) => (
  <StatList items={useStatsWithTopicCount(items)} className={className} />
);
