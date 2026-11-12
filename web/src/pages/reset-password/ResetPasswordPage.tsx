import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import cx from 'classnames/bind';
import { z } from 'zod';

import { Button, ButtonRouteLink } from '@components/ui/Button/Button';
import {
  FieldForm,
  FieldFormActions,
  FieldStatus,
} from '@components/ui/Field/Field';
import { Heading } from '@components/ui/Heading/Heading';
import { PasswordInput } from '@components/ui/PasswordInput/PasswordInput';
import { Section } from '@components/ui/Section/Section';
import { Text } from '@components/ui/Text/Text';
import {
  AUTH_QUERY_PARAM,
  AUTH_TEXT,
  PASSWORD_MIN_LENGTH,
} from '@constants/auth';
import { APP_ROUTES } from '@constants/routes';
import { useApiForm } from '@hooks/useApiForm';
import { confirmPasswordReset } from '@services/auth';

import styles from './ResetPasswordPage.module.css';

const cn = cx.bind(styles);

const TITLE_ID = 'reset-password-title';

const resetPasswordSchema = z
  .object({
    password: z.string().min(PASSWORD_MIN_LENGTH, AUTH_TEXT.passwordMinLength),
    confirmPassword: z.string(),
  })
  .refine(values => values.password === values.confirmPassword, {
    message: AUTH_TEXT.passwordMismatch,
    path: ['confirmPassword'],
  });

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get(AUTH_QUERY_PARAM.resetToken);
  const [isComplete, setIsComplete] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    formError,
    clearFormError,
    handleApiError,
  } = useApiForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async values => {
    if (!token) return;
    clearFormError();

    try {
      await confirmPasswordReset({ token, password: values.password });
      setIsComplete(true);
    } catch (error) {
      handleApiError(error);
    }
  });

  return (
    <Section labelledBy={TITLE_ID} className={cn('page')}>
      <div className={cn('panel')}>
        <Text as="div" variant="eyebrow">
          {AUTH_TEXT.resetEyebrow}
        </Text>
        <Heading
          level={1}
          variant="title"
          id={TITLE_ID}
          className={cn('title')}
        >
          {AUTH_TEXT.resetTitle}
          <br />
          <em>{AUTH_TEXT.resetTitleEmphasis}</em>
        </Heading>

        {!token ? (
          <FieldStatus tone="error">{AUTH_TEXT.resetMissingToken}</FieldStatus>
        ) : null}

        {token && isComplete ? (
          <div className={cn('complete')}>
            <FieldStatus tone="success">
              {AUTH_TEXT.resetSuccessMessage}
            </FieldStatus>
            <ButtonRouteLink to={APP_ROUTES.MY_LEARNING} endIcon="arrowRight">
              {AUTH_TEXT.loginSubmitLabel}
            </ButtonRouteLink>
          </div>
        ) : null}

        {token && !isComplete ? (
          <FieldForm onSubmit={onSubmit}>
            {formError ? (
              <FieldStatus tone="error">{formError}</FieldStatus>
            ) : null}
            <PasswordInput
              label={AUTH_TEXT.newPasswordLabel}
              autoComplete="new-password"
              hint={AUTH_TEXT.passwordMinLength}
              error={errors.password?.message}
              {...register('password')}
            />
            <PasswordInput
              label={AUTH_TEXT.confirmPasswordLabel}
              autoComplete="new-password"
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />
            <FieldFormActions>
              <Button type="submit" loading={isSubmitting} endIcon="arrowRight">
                {AUTH_TEXT.resetSubmitLabel}
              </Button>
            </FieldFormActions>
          </FieldForm>
        ) : null}
      </div>
    </Section>
  );
};

export default ResetPasswordPage;
