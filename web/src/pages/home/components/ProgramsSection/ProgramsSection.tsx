import { Button, ButtonLink } from '@components/ui/Button/Button';
import { Card } from '@components/ui/Card/Card';
import { CardGrid } from '@components/ui/CardGrid/CardGrid';
import { Reveal } from '@components/ui/Reveal/Reveal';
import { Section } from '@components/ui/Section/Section';
import { SectionHead } from '@components/ui/SectionHead/SectionHead';
import { PROGRAMS_TEXT } from '@constants/home';
import { HOME_SECTION_ID, toSectionHref } from '@constants/routes';

const TITLE_ID = 'programs-title';

export type ProgramsSectionProps = {
  onSeeTestFlow: () => void;
  onJoinWaitlist: () => void;
};

export const ProgramsSection = ({
  onSeeTestFlow,
  onJoinWaitlist,
}: ProgramsSectionProps) => {
  const [classes, assessment, prediction] = PROGRAMS_TEXT.items;

  const programs = [
    {
      program: classes,
      action: (
        <ButtonLink
          variant="editorial"
          href={toSectionHref(HOME_SECTION_ID.topics)}
          endIcon="arrowRight"
        >
          {classes.action}
        </ButtonLink>
      ),
    },
    {
      program: assessment,
      action: (
        <Button
          variant="editorial"
          endIcon="arrowRight"
          onClick={onSeeTestFlow}
        >
          {assessment.action}
        </Button>
      ),
    },
    {
      program: prediction,
      action: (
        <Button
          variant="editorial"
          endIcon="arrowRight"
          onClick={onJoinWaitlist}
        >
          {prediction.action}
        </Button>
      ),
    },
  ];

  return (
    <Section
      id={HOME_SECTION_ID.programs}
      tone="subtle"
      divider
      labelledBy={TITLE_ID}
    >
      <SectionHead
        titleId={TITLE_ID}
        title={
          <>
            {PROGRAMS_TEXT.title}
            <br />
            <em>{PROGRAMS_TEXT.titleEmphasis}</em>
          </>
        }
        description={PROGRAMS_TEXT.description}
      />
      <CardGrid variant="tiled" columns={3}>
        {programs.map(({ program, action }) => (
          <Reveal key={program.tag}>
            <Card
              variant="panel"
              label={program.tag}
              title={
                <>
                  {program.title}
                  <br />
                  {program.titleEnd}
                </>
              }
              description={program.description}
              footer={action}
            />
          </Reveal>
        ))}
      </CardGrid>
    </Section>
  );
};
