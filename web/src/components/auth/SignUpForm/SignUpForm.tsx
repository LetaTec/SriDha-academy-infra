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
import { signUpStudent, type AuthUser } from '@services/auth';

// Mirrors the API's sign-up rules so mistakes show before sending
const PASSWORD_MIN_LENGTH = 8;

const signUpSchema = z.object({
  fullName: z.string().trim().min(2, ACCOUNT_TEXT.nameInvalid),
  email: z.string().trim().pipe(z.email(AUTH_TEXT.emailInvalid)),
  password: z.string().min(PASSWORD_MIN_LENGTH, ACCOUNT_TEXT.passwordTooShort),
});

type SignUpFormValues = z.infer<typeof signUpSchema>;

export type SignUpFormProps = {
  onSignedUp: (user: AuthUser) => void;
};

// Name, email and a new password; nothing is emailed to check the address
export const SignUpForm = ({ onSignedUp }: SignUpFormProps) => {
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
      onSignedUp(await signUpStudent(values));
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
