import { ButtonRouteLink } from '@components/ui/Button/Button';
import { Card } from '@components/ui/Card/Card';
import { CardGrid } from '@components/ui/CardGrid/CardGrid';
import { Reveal } from '@components/ui/Reveal/Reveal';
import { Section } from '@components/ui/Section/Section';
import { SectionHead } from '@components/ui/SectionHead/SectionHead';
import { PROGRAMS_TEXT } from '@constants/home';
import { HOME_SECTION_ID } from '@constants/routes';

const TITLE_ID = 'programs-title';

// Classes, past-paper practice and topic tests, each linking to its page
export const ProgramsSection = () => (
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
      {PROGRAMS_TEXT.items.map(program => (
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
            footer={
              <ButtonRouteLink
                variant="editorial"
                to={program.to}
                endIcon="arrowRight"
              >
                {program.action}
              </ButtonRouteLink>
            }
          />
        </Reveal>
      ))}
    </CardGrid>
  </Section>
);
