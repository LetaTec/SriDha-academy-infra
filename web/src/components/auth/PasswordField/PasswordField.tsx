import React, { useState } from 'react';

import { IconButton } from '@components/ui/IconButton/IconButton';
import { Input, type InputProps } from '@components/ui/Input/Input';
import { ACCOUNT_TEXT } from '@constants/auth';

export type PasswordFieldProps = Omit<InputProps, 'type' | 'endAdornment'>;

// A password input with a button to show what was typed
export const PasswordField = React.forwardRef<
  HTMLInputElement,
  PasswordFieldProps
>((props, ref) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <Input
      ref={ref}
      type={isVisible ? 'text' : 'password'}
      endAdornment={
        <IconButton
          icon={isVisible ? 'passwordHide' : 'passwordShow'}
          label={
            isVisible ? ACCOUNT_TEXT.hidePassword : ACCOUNT_TEXT.showPassword
          }
          onClick={() => setIsVisible(visible => !visible)}
        />
      }
      {...props}
    />
  );
});

PasswordField.displayName = 'PasswordField';
