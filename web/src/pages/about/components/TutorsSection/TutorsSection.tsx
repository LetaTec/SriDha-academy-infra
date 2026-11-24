import { TutorPortrait } from '@components/catalogue/TutorPortrait/TutorPortrait';
import { Card } from '@components/ui/Card/Card';
import { CardGrid } from '@components/ui/CardGrid/CardGrid';
import { Reveal } from '@components/ui/Reveal/Reveal';
import { Section } from '@components/ui/Section/Section';
import { SectionHead } from '@components/ui/SectionHead/SectionHead';
import { Text } from '@components/ui/Text/Text';
import { ABOUT_PAGE_TEXT } from '@constants/about';
import { ABOUT_SECTION_ID } from '@constants/routes';
import { useTopicPreviews } from '@hooks/useTopicPreviews';
import { listTeachers } from '@services/catalogue';

const TITLE_ID = 'tutors-title';
const { tutors } = ABOUT_PAGE_TEXT;

// Everyone teaching a batch, once each, with the topics they teach
export const TutorsSection = () => {
  const { previews } = useTopicPreviews();
  const teachers = listTeachers(previews);

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
        {teachers.map(({ tutor, topics }) => (
          <Reveal key={tutor.id}>
            <Card
              variant="profile"
              media={<TutorPortrait tutor={tutor} />}
              title={tutor.name}
              description={tutor.credentials.join(' · ') || null}
              footer={
                <Text as="p" variant="small" tone="muted">
                  {topics.join(' · ')}
                </Text>
              }
            />
          </Reveal>
        ))}
      </CardGrid>
    </Section>
  );
};
