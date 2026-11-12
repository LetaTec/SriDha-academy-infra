import React, { useId } from 'react';
import cx from 'classnames/bind';

import { Text } from '../Text/Text';
import styles from './Checkbox.module.css';

const cn = cx.bind(styles);

export type CheckboxProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type'
> & {
  // Text, or text with links (for example to the policies being agreed to)
  label: React.ReactNode;
};

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, id, className, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;

    return (
      <div className={cn('checkbox', className)}>
        <input ref={ref} id={inputId} type="checkbox" {...props} />
        <Text as="label" variant="small" htmlFor={inputId}>
          {label}
        </Text>
      </div>
    );
  },
);

Checkbox.displayName = 'Checkbox';
