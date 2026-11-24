// Switches for features that wait on something outside the website.
export const FEATURES = {
  // Student sign-up, sign-in and the lock over papers need the API's
  // account routes (/auth/sign-up and friends). Off until the API with them
  // is live on Render: papers then open to everyone, as before accounts.
  // Turn on once POST /api/auth/sign-up stops answering 404.
  studentAccounts: false,
};
