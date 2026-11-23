import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { PasswordField } from '@components/auth/PasswordField/PasswordField';
import { Button } from '@components/ui/Button/Button';
import {
  FieldForm,
  FieldFormActions,
  FieldStatus,
} from '@components/ui/Field/Field';
import { Modal } from '@components/ui/Modal/Modal';
import { Text } from '@components/ui/Text/Text';
import { ACCOUNT_TEXT as TEXT } from '@constants/auth';
import { useToast } from '@context/ToastContext';
import { useApiForm } from '@hooks/useApiForm';
import { changePassword } from '@services/auth';

const PASSWORD_MIN_LENGTH = 8;

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, TEXT.passwordRequired),
  newPassword: z.string().min(PASSWORD_MIN_LENGTH, TEXT.passwordTooShort),
});

type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

export type ChangePasswordDialogProps = {
  open: boolean;
  onClose: () => void;
};

// A signed-in student sets a new password with their current one
export const ChangePasswordDialog = ({
  open,
  onClose,
}: ChangePasswordDialogProps) => {
  const { showToast } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    formError,
    clearFormError,
    handleApiError,
  } = useApiForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  });

  const handleClose = () => {
    clearFormError();
    reset();
    onClose();
  };

  const onSubmit = handleSubmit(async values => {
    clearFormError();
    try {
      await changePassword(values);
      showToast(TEXT.changedToast);
      handleClose();
    } catch (error) {
      handleApiError(error);
    }
  });

  return (
    <Modal
      open={open}
      onClose={handleClose}
      eyebrow={TEXT.changeEyebrow}
      title={
        <>
          {TEXT.changeTitle}
          <br />
          <em>{TEXT.changeTitleEmphasis}</em>
        </>
      }
    >
      <FieldForm onSubmit={onSubmit}>
        <Text as="p" tone="muted">
          {TEXT.changeLead}
        </Text>
        {formError ? <FieldStatus tone="error">{formError}</FieldStatus> : null}
        <PasswordField
          label={TEXT.currentPasswordLabel}
          autoComplete="current-password"
          error={errors.currentPassword?.message}
          {...register('currentPassword')}
        />
        <PasswordField
          label={TEXT.newPasswordLabel2}
          autoComplete="new-password"
          hint={TEXT.passwordHint}
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />
        <FieldFormActions>
          <Button type="submit" loading={isSubmitting} endIcon="arrowRight">
            {TEXT.changeSubmit}
          </Button>
        </FieldFormActions>
      </FieldForm>
    </Modal>
  );
};
