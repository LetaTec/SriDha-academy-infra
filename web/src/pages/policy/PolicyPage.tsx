import cx from 'classnames/bind';

import { Heading } from '@components/ui/Heading/Heading';
import { Section } from '@components/ui/Section/Section';
import { Text } from '@components/ui/Text/Text';
import {
  POLICY_CONTENT,
  SUPPORT_EMAIL,
  type PolicyKey,
} from '@constants/policies';

import styles from './PolicyPage.module.css';

const cn = cx.bind(styles);

export type PolicyPageProps = {
  policy: PolicyKey;
};

// Terms, refund and contact pages. Public, so payment providers and
// visitors can read them without an account.
const PolicyPage = ({ policy }: PolicyPageProps) => {
  const content = POLICY_CONTENT[policy];
  const titleId = `policy-${policy}-title`;

  return (
    <Section labelledBy={titleId} className={cn('page')}>
      <article className={cn('sheet')}>
        <header className={cn('head')}>
          <Text as="div" variant="eyebrow" tone="accent">
            {content.eyebrow}
          </Text>
          <Heading level={1} variant="display" id={titleId}>
            {content.title} <em>{content.titleEmphasis}</em>
          </Heading>
          <Text as="p" variant="small" tone="muted" className={cn('updated')}>
            {content.updated}
          </Text>
          <Text as="p" variant="lead" className={cn('intro')}>
            {content.intro}
          </Text>
        </header>

        {content.sections.map(section => (
          <section key={section.heading} className={cn('section')}>
            <Heading level={2} variant="item">
              {section.heading}
            </Heading>
            {section.paragraphs?.map(paragraph =>
              paragraph === SUPPORT_EMAIL ? (
                <a
                  key={paragraph}
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className={cn('email')}
                >
                  {SUPPORT_EMAIL}
                </a>
              ) : (
                <Text key={paragraph} as="p">
                  {paragraph}
                </Text>
              ),
            )}
            {section.items ? (
              <ul className={cn('items')}>
                {section.items.map(item => (
                  <li key={item}>
                    <Text as="span">{item}</Text>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </article>
    </Section>
  );
};

export default PolicyPage;
