import cx from 'classnames/bind';

import { Button } from '@components/ui/Button/Button';
import { EmptyState } from '@components/ui/EmptyState/EmptyState';
import { SectionHead } from '@components/ui/SectionHead/SectionHead';
import { Spinner } from '@components/ui/Spinner/Spinner';
import { Text } from '@components/ui/Text/Text';
import { TODAY_LOGINS_TEXT as TEXT } from '@constants/team';
import { useTodayTeamLogins } from '@hooks/useTodayTeamLogins';
import type { TeamTodayLogin } from '@services/admin';
import { formatDateTime } from '@utils/date';

import styles from './TodayLoginsPanel.module.css';

const cn = cx.bind(styles);

const ROLE_LABEL: Record<TeamTodayLogin['role'], string> = TEXT.roleLabels;

export const TodayLoginsPanel = () => {
  const { logins, isLoading, hasError, reload } = useTodayTeamLogins();

  return (
    <section className={cn('panel')} aria-labelledby="today-logins-title">
      <SectionHead
        title={TEXT.title}
        description={TEXT.description}
        titleId="today-logins-title"
      />

      {isLoading ? (
        <div className={cn('status')} role="status">
          <Spinner tone="muted" />
          <Text variant="small" tone="muted">
            Loading
          </Text>
        </div>
      ) : null}

      {hasError ? (
        <EmptyState
          title={TEXT.loadError}
          action={
            <Button variant="secondary" onClick={reload}>
              {TEXT.retry}
            </Button>
          }
        />
      ) : null}

      {!isLoading && !hasError ? (
        logins.length === 0 ? (
          <EmptyState title={TEXT.noLogins} />
        ) : (
          <div className={cn('tableWrap')}>
            <table className={cn('table')}>
              <caption className={cn('caption')}>{TEXT.tableCaption}</caption>
              <thead>
                <tr>
                  <th scope="col">{TEXT.account}</th>
                  <th scope="col">{TEXT.accountType}</th>
                  <th scope="col">{TEXT.signedIn}</th>
                </tr>
              </thead>
              <tbody>
                {logins.map((login, index) => (
                  <tr key={`${login.email}-${login.startedAt}-${index}`}>
                    <td>
                      <Text variant="small">{login.email}</Text>
                    </td>
                    <td>
                      <Text variant="small">{ROLE_LABEL[login.role]}</Text>
                    </td>
                    <td>
                      <Text variant="small">
                        {formatDateTime(login.startedAt)}
                      </Text>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}
    </section>
  );
};
