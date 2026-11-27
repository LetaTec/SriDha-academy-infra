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
import { confirmSignUp, requestSignUp, type AuthUser } from '@services/auth';

// Mirrors the API's sign-up rules so mistakes show before sending
const PASSWORD_MIN_LENGTH = 8;

const signUpSchema = z.object({
  fullName: z.string().trim().min(2, ACCOUNT_TEXT.nameInvalid),
  email: z.string().trim().pipe(z.email(AUTH_TEXT.emailInvalid)),
  password: z.string().min(PASSWORD_MIN_LENGTH, ACCOUNT_TEXT.passwordTooShort),
});

const codeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, ACCOUNT_TEXT.codeInvalid),
});

type SignUpFormValues = z.infer<typeof signUpSchema>;
type CodeValues = z.infer<typeof codeSchema>;

// Who the code was sent to, and the password they chose (sent again with
// the code, which ties the code to this person; kept only in memory)
type PendingSignUp = { email: string; password: string };

// Step one: name, email and a new password; the API emails a code
const DetailsStep = ({
  onSent,
}: {
  onSent: (pending: PendingSignUp) => void;
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    formError,
    clearFormError,
    handleApiError,
  } = useApiForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: '', email: '', password: '' },
  });

  const onSubmit = handleSubmit(async values => {
    clearFormError();
    try {
      await requestSignUp(values);
      onSent({ email: values.email.trim(), password: values.password });
    } catch (error) {
      handleApiError(error);
    }
  });

  return (
    <FieldForm onSubmit={onSubmit}>
      {formError ? <FieldStatus tone="error">{formError}</FieldStatus> : null}
      <Input
        label={ACCOUNT_TEXT.nameLabel}
        autoComplete="name"
        placeholder={ACCOUNT_TEXT.namePlaceholder}
        error={errors.fullName?.message}
        {...register('fullName')}
      />
      <Input
        label={AUTH_TEXT.emailLabel}
        type="email"
        autoComplete="email"
        placeholder={AUTH_TEXT.emailPlaceholder}
        error={errors.email?.message}
        {...register('email')}
      />
      <PasswordField
        label={ACCOUNT_TEXT.newPasswordLabel}
        autoComplete="new-password"
        hint={ACCOUNT_TEXT.passwordHint}
        error={errors.password?.message}
        {...register('password')}
      />
      <FieldFormActions>
        <Button type="submit" loading={isSubmitting} endIcon="arrowRight">
          {ACCOUNT_TEXT.signUpSubmit}
        </Button>
      </FieldFormActions>
    </FieldForm>
  );
};

// Step two: the code from the email creates the account and signs in
const CodeStep = ({
  pending: { email, password },
  onSignedUp,
  onStartAgain,
}: {
  pending: PendingSignUp;
  onSignedUp: (user: AuthUser) => void;
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
    defaultValues: { code: '' },
  });

  const onSubmit = handleSubmit(async ({ code }) => {
    clearFormError();
    try {
      onSignedUp(await confirmSignUp({ email, code, password }));
    } catch (error) {
      handleApiError(error);
    }
  });

  return (
    <FieldForm onSubmit={onSubmit}>
      <Text as="p" tone="muted">
        {ACCOUNT_TEXT.signUpCodeLead(email)}
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
      <FieldFormActions
        note={
          <Button variant="plain" onClick={onStartAgain}>
            {ACCOUNT_TEXT.useDifferentEmail}
          </Button>
        }
      >
        <Button type="submit" loading={isSubmitting} endIcon="arrowRight">
          {ACCOUNT_TEXT.signUpConfirmSubmit}
        </Button>
      </FieldFormActions>
    </FieldForm>
  );
};

export type SignUpFormProps = {
  onSignedUp: (user: AuthUser) => void;
};

// Name, email and a new password, then the 6-digit code emailed to prove
// the address; no account exists until the code is confirmed
export const SignUpForm = ({ onSignedUp }: SignUpFormProps) => {
  const [pending, setPending] = useState<PendingSignUp | null>(null);

  return pending ? (
    <CodeStep
      pending={pending}
      onSignedUp={onSignedUp}
      onStartAgain={() => setPending(null)}
    />
  ) : (
    <DetailsStep onSent={setPending} />
  );
};
