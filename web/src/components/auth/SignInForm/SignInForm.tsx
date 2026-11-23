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
import { ACCOUNT_TEXT, AUTH_TEXT } from '@constants/auth';
import { useApiForm } from '@hooks/useApiForm';
import { signInStudent, type AuthUser } from '@services/auth';

const signInSchema = z.object({
  email: z.string().trim().pipe(z.email(AUTH_TEXT.emailInvalid)),
  password: z.string().min(1, ACCOUNT_TEXT.passwordRequired),
});

type SignInFormValues = z.infer<typeof signInSchema>;

export type SignInFormProps = {
  onSignedIn: (user: AuthUser) => void;
};

// Email and password. Students stay signed in on this device.
export const SignInForm = ({ onSignedIn }: SignInFormProps) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    formError,
    clearFormError,
    handleApiError,
  } = useApiForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async values => {
    clearFormError();

    try {
      onSignedIn(await signInStudent({ ...values, rememberMe: true }));
    } catch (error) {
      handleApiError(error);
    }
  });

  return (
    <FieldForm onSubmit={onSubmit}>
      {formError ? <FieldStatus tone="error">{formError}</FieldStatus> : null}
      <Input
        label={AUTH_TEXT.emailLabel}
        type="email"
        autoComplete="email"
        placeholder={AUTH_TEXT.emailPlaceholder}
        error={errors.email?.message}
        {...register('email')}
      />
      <PasswordField
        label={ACCOUNT_TEXT.passwordLabel}
        autoComplete="current-password"
        error={errors.password?.message}
        {...register('password')}
      />
      <FieldFormActions>
        <Button type="submit" loading={isSubmitting} endIcon="arrowRight">
          {ACCOUNT_TEXT.signInSubmit}
        </Button>
      </FieldFormActions>
    </FieldForm>
  );
};
