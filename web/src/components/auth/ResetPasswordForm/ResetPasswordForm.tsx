import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { PasswordField } from '@components/auth/PasswordField/PasswordField';
import { Button } from '@components/ui/Button/Button';
import {
  FieldForm,
  FieldFormActions,
  FieldStatus,
} from '@components/ui/Field/Field';
import { Input } from '@components/ui/Input/Input';
import { Text } from '@components/ui/Text/Text';
import { ACCOUNT_TEXT, AUTH_TEXT } from '@constants/auth';
import { useApiForm } from '@hooks/useApiForm';
import {
  confirmPasswordReset,
  requestPasswordReset,
  type AuthUser,
} from '@services/auth';

const PASSWORD_MIN_LENGTH = 8;

const emailSchema = z.object({
  email: z.string().trim().pipe(z.email(AUTH_TEXT.emailInvalid)),
});

const codeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, ACCOUNT_TEXT.codeInvalid),
  password: z.string().min(PASSWORD_MIN_LENGTH, ACCOUNT_TEXT.passwordTooShort),
});

type EmailValues = z.infer<typeof emailSchema>;
type CodeValues = z.infer<typeof codeSchema>;

// Step one: the email to send a code to
const RequestCodeStep = ({ onSent }: { onSent: (email: string) => void }) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    formError,
    clearFormError,
    handleApiError,
  } = useApiForm<EmailValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async ({ email }) => {
    clearFormError();
    try {
      await requestPasswordReset({ email });
      onSent(email);
    } catch (error) {
      handleApiError(error);
    }
  });

  return (
    <FieldForm onSubmit={onSubmit}>
      <Text as="p" tone="muted">
        {ACCOUNT_TEXT.resetLead}
      </Text>
      {formError ? <FieldStatus tone="error">{formError}</FieldStatus> : null}
      <Input
        label={AUTH_TEXT.emailLabel}
        type="email"
        autoComplete="email"
        placeholder={AUTH_TEXT.emailPlaceholder}
        error={errors.email?.message}
        {...register('email')}
      />
      <FieldFormActions>
        <Button type="submit" loading={isSubmitting} endIcon="arrowRight">
          {ACCOUNT_TEXT.sendCode}
        </Button>
      </FieldFormActions>
    </FieldForm>
  );
};

// Step two: the code from the email and a new password
const EnterCodeStep = ({
  email,
  onReset,
  onStartAgain,
}: {
  email: string;
  onReset: (user: AuthUser) => void;
  onStartAgain: () => void;
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    formError,
    clearFormError,
    handleApiError,
  } = useApiForm<CodeValues>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: '', password: '' },
  });

  const onSubmit = handleSubmit(async values => {
    clearFormError();
    try {
      onReset(await confirmPasswordReset({ email, ...values }));
    } catch (error) {
      handleApiError(error);
    }
  });

  return (
    <FieldForm onSubmit={onSubmit}>
      <Text as="p" tone="muted">
        {ACCOUNT_TEXT.resetCodeLead(email)}
      </Text>
      {formError ? <FieldStatus tone="error">{formError}</FieldStatus> : null}
      <Input
        label={ACCOUNT_TEXT.codeLabel}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        error={errors.code?.message}
        {...register('code')}
      />
      <PasswordField
        label={ACCOUNT_TEXT.newPasswordLabel2}
        autoComplete="new-password"
        hint={ACCOUNT_TEXT.passwordHint}
        error={errors.password?.message}
        {...register('password')}
      />
      <FieldFormActions
        note={
          <Button variant="plain" onClick={onStartAgain}>
            {ACCOUNT_TEXT.resendCode}
          </Button>
        }
      >
        <Button type="submit" loading={isSubmitting} endIcon="arrowRight">
          {ACCOUNT_TEXT.resetSubmit}
        </Button>
      </FieldFormActions>
    </FieldForm>
  );
};

export type ResetPasswordFormProps = {
  onReset: (user: AuthUser) => void;
};

// "Forgot password": email a 6-digit code, then set a new password with it
export const ResetPasswordForm = ({ onReset }: ResetPasswordFormProps) => {
  const [sentTo, setSentTo] = useState<string | null>(null);

  return sentTo ? (
    <EnterCodeStep
      email={sentTo}
      onReset={onReset}
      onStartAgain={() => setSentTo(null)}
    />
  ) : (
    <RequestCodeStep onSent={setSentTo} />
  );
};
