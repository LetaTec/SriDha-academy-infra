import { Card } from '@components/ui/Card/Card';
import { CardGrid } from '@components/ui/CardGrid/CardGrid';
import { Monogram } from '@components/ui/Monogram/Monogram';
import { Reveal } from '@components/ui/Reveal/Reveal';
import { Section } from '@components/ui/Section/Section';
import { SectionHead } from '@components/ui/SectionHead/SectionHead';
import { StatusDot } from '@components/ui/StatusDot/StatusDot';
import { ABOUT_PAGE_TEXT } from '@constants/about';
import { ABOUT_SECTION_ID } from '@constants/routes';
import { SIGN_IN_TOPIC_COUNT } from '@constants/topics';
import { useTopicPreviews } from '@hooks/useTopicPreviews';

const TITLE_ID = 'tutors-title';
const { tutors } = ABOUT_PAGE_TEXT;

// One tutor card per topic on the sign-in page
export const TutorsSection = () => {
  const { previews } = useTopicPreviews();

  return (
    <Section id={ABOUT_SECTION_ID.tutors} divider labelledBy={TITLE_ID}>
      <SectionHead
        titleId={TITLE_ID}
        title={
          <>
            {tutors.title}
            <br />
            <em>{tutors.titleEmphasis}</em>
          </>
        }
        description={tutors.description}
      />
      <CardGrid variant="columns" columns={4}>
        {previews.slice(0, SIGN_IN_TOPIC_COUNT).map(topic => (
          <Reveal key={topic.catalogueTopicId}>
            <Card
              variant="profile"
              media={<Monogram initial={topic.title.charAt(0)} />}
              title={topic.title}
              description={topic.level}
              footer={<StatusDot color="neutral" label={tutors.status} />}
            />
          </Reveal>
        ))}
      </CardGrid>
    </Section>
  );
};
