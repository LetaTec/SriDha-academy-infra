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
import { Select } from '@components/ui/Select/Select';
import { ACCOUNT_TEXT, AUTH_TEXT } from '@constants/auth';
import {
  CHECKOUT_TEXT,
  INDIAN_STATE_OPTIONS,
  INDIAN_STATES,
} from '@constants/payments';
import type { IndianState } from '@contracts/payments';
import { useApiForm } from '@hooks/useApiForm';
import { signUpStudent, type AuthUser } from '@services/auth';

// Mirrors the API's sign-up rules so mistakes show before sending
const PASSWORD_MIN_LENGTH = 8;

const signUpSchema = z.object({
  fullName: z.string().trim().min(2, ACCOUNT_TEXT.nameInvalid),
  email: z.string().trim().pipe(z.email(AUTH_TEXT.emailInvalid)),
  mobile: z
    .string()
    .trim()
    .regex(/^\+?[0-9][0-9\s-]{8,16}[0-9]$/, CHECKOUT_TEXT.mobileInvalid),
  state: z
    .union([z.enum(INDIAN_STATES), z.literal('')])
    .refine(value => value !== '', CHECKOUT_TEXT.stateRequired),
  city: z.string().trim().min(2, CHECKOUT_TEXT.cityRequired).max(80),
  pinCode: z
    .string()
    .trim()
    .regex(/^[1-9][0-9]{5}$/, CHECKOUT_TEXT.pinCodeInvalid),
  password: z.string().min(PASSWORD_MIN_LENGTH, ACCOUNT_TEXT.passwordTooShort),
});

// The state starts empty, so the form holds more than it submits
type SignUpFormInput = z.input<typeof signUpSchema>;
type SignUpFormValues = z.output<typeof signUpSchema>;

export type SignUpFormProps = {
  onSignedUp: (user: AuthUser) => void;
};

// Name, email, mobile, state, city, PIN code and a new password. Checkout
// fills these in later. Nothing is emailed to check the address.
export const SignUpForm = ({ onSignedUp }: SignUpFormProps) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    formError,
    clearFormError,
    handleApiError,
  } = useApiForm<SignUpFormInput, SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      fullName: '',
      email: '',
      mobile: '',
      state: '',
      city: '',
      pinCode: '',
      password: '',
    },
  });

  const onSubmit = handleSubmit(async values => {
    clearFormError();

    try {
      onSignedUp(
        await signUpStudent({ ...values, state: values.state as IndianState }),
      );
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
      <Input
        label={CHECKOUT_TEXT.mobileLabel}
        type="tel"
        autoComplete="tel"
        error={errors.mobile?.message}
        {...register('mobile')}
      />
      <Select
        label={CHECKOUT_TEXT.stateLabel}
        placeholder={CHECKOUT_TEXT.statePlaceholder}
        options={INDIAN_STATE_OPTIONS}
        autoComplete="address-level1"
        error={errors.state?.message}
        {...register('state')}
      />
      <Input
        label={CHECKOUT_TEXT.cityLabel}
        placeholder={CHECKOUT_TEXT.cityPlaceholder}
        autoComplete="address-level2"
        error={errors.city?.message}
        {...register('city')}
      />
      <Input
        label={CHECKOUT_TEXT.pinCodeLabel}
        placeholder={CHECKOUT_TEXT.pinCodePlaceholder}
        autoComplete="postal-code"
        inputMode="numeric"
        error={errors.pinCode?.message}
        {...register('pinCode')}
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
