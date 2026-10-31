import React from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import cx from 'classnames/bind';

import { Icon } from '@components/ui/Icon/Icon';
import { Spinner } from '@components/ui/Spinner/Spinner';
import type { IconName } from '@constants/icons';

import { ButtonBase, type ButtonBaseProps } from '../ButtonBase/ButtonBase';
import styles from './Button.module.css';

const cn = cx.bind(styles);

export type ButtonVariant = 'primary' | 'secondary' | 'editorial' | 'plain';
export type ButtonTone = 'default' | 'inverse';

type ButtonStyleProps = {
  variant?: ButtonVariant;
  tone?: ButtonTone;
  fullWidth?: boolean;
  endIcon?: IconName;
  children: React.ReactNode;
};

export type ButtonProps = ButtonBaseProps &
  ButtonStyleProps & {
    loading?: boolean;
  };

export type ButtonLinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> &
  ButtonStyleProps & {
    href: string;
  };

export type ButtonRouteLinkProps = LinkProps & ButtonStyleProps;

const ButtonContent = ({
  children,
  endIcon,
}: Pick<ButtonStyleProps, 'children' | 'endIcon'>) => (
  <>
    {children}
    {endIcon ? <Icon name={endIcon} size="sm" /> : null}
  </>
);

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      tone = 'default',
      fullWidth = false,
      loading = false,
      endIcon,
      disabled,
      children,
      className,
      ...props
    },
    ref,
  ) => (
    <ButtonBase
      ref={ref}
      className={cn(
        'btn',
        variant,
        tone,
        { fullWidth, disabled: disabled || loading },
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <span className={cn('loadingLabel')}>{children}</span>
          <Spinner className={cn('spinner')} />
        </>
      ) : (
        <ButtonContent endIcon={endIcon}>{children}</ButtonContent>
      )}
    </ButtonBase>
  ),
);

Button.displayName = 'Button';

export const ButtonLink = ({
  variant = 'primary',
  tone = 'default',
  fullWidth = false,
  endIcon,
  children,
  className,
  ...props
}: ButtonLinkProps) => (
  <a className={cn('btn', variant, tone, { fullWidth }, className)} {...props}>
    <ButtonContent endIcon={endIcon}>{children}</ButtonContent>
  </a>
);

export const ButtonRouteLink = ({
  variant = 'primary',
  tone = 'default',
  fullWidth = false,
  endIcon,
  children,
  className,
  ...props
}: ButtonRouteLinkProps) => (
  <Link
    className={cn('btn', variant, tone, { fullWidth }, className)}
    {...props}
  >
    <ButtonContent endIcon={endIcon}>{children}</ButtonContent>
  </Link>
);
