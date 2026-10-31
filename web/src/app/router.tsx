import { lazy, Suspense } from 'react';
import {
  createBrowserRouter,
  Outlet,
  type RouteObject,
} from 'react-router-dom';

import { PageLoader } from '@components/ui/PageLoader/PageLoader';
import { AUTH_VIEW } from '@constants/auth';
import { PAGE_TEXT } from '@constants/pages';
import { POLICY } from '@constants/policies';
import { APP_ROUTES } from '@constants/routes';
import { AuthShell } from '@layout/AuthShell/AuthShell';
import { SiteShell } from '@layout/SiteShell/SiteShell';

import { ProtectedRoute } from '@/routes/ProtectedRoute';
import { PublicOnlyRoute } from '@/routes/PublicOnlyRoute';
import { RouteErrorBoundary } from '@/routes/RouteErrorBoundary';

const AuthPage = lazy(() => import('@pages/auth/AuthPage'));
const HomePage = lazy(() => import('@pages/home/HomePage'));
const MyLearningPage = lazy(() => import('@pages/my-learning/MyLearningPage'));
const BatchesPage = lazy(() => import('@pages/batches/BatchesPage'));
const TopicsPage = lazy(() => import('@pages/topics/TopicsPage'));
const AboutPage = lazy(() => import('@pages/about/AboutPage'));
const AiTestPage = lazy(() => import('@pages/ai-test/AiTestPage'));
const ModelPaperPage = lazy(() => import('@pages/model-paper/ModelPaperPage'));
const ResetPasswordPage = lazy(
  () => import('@pages/reset-password/ResetPasswordPage'),
);
const AdminSignInPage = lazy(
  () => import('@pages/admin-sign-in/AdminSignInPage'),
);
const NotFoundPage = lazy(() => import('@pages/not-found/NotFoundPage'));
const PolicyPage = lazy(() => import('@pages/policy/PolicyPage'));
const TeamOrdersPage = lazy(() => import('@pages/team-orders/TeamOrdersPage'));

const SuspendedOutlet = () => (
  <Suspense fallback={<PageLoader label={PAGE_TEXT.loading} />}>
    <Outlet />
  </Suspense>
);

// Visitors only see the sign-in screens until they log in or register;
// every other page sits behind ProtectedRoute.
export const routes: RouteObject[] = [
  {
    element: <AuthShell />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        element: <SuspendedOutlet />,
        children: [
          {
            element: <PublicOnlyRoute />,
            children: [
              {
                path: APP_ROUTES.LOGIN,
                element: <AuthPage view={AUTH_VIEW.login} />,
              },
              {
                path: APP_ROUTES.REGISTER,
                element: <AuthPage view={AUTH_VIEW.register} />,
              },
              {
                path: APP_ROUTES.FORGOT_PASSWORD,
                element: <AuthPage view={AUTH_VIEW.forgotPassword} />,
              },
            ],
          },
          { path: APP_ROUTES.RESET_PASSWORD, element: <ResetPasswordPage /> },
          { path: APP_ROUTES.ADMIN_SIGN_IN, element: <AdminSignInPage /> },
          // Public policy pages, with or without an account
          {
            path: APP_ROUTES.TERMS,
            element: <PolicyPage policy={POLICY.terms} />,
          },
          {
            path: APP_ROUTES.REFUNDS,
            element: <PolicyPage policy={POLICY.refunds} />,
          },
          {
            path: APP_ROUTES.CONTACT,
            element: <PolicyPage policy={POLICY.contact} />,
          },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        element: <SiteShell />,
        children: [
          {
            element: <SuspendedOutlet />,
            children: [
              { path: APP_ROUTES.HOME, element: <HomePage /> },
              { path: APP_ROUTES.MY_LEARNING, element: <MyLearningPage /> },
              { path: APP_ROUTES.BATCHES, element: <BatchesPage /> },
              { path: APP_ROUTES.TOPICS, element: <TopicsPage /> },
              { path: APP_ROUTES.ABOUT, element: <AboutPage /> },
              { path: APP_ROUTES.AI_TEST, element: <AiTestPage /> },
              { path: APP_ROUTES.MODEL_PAPER, element: <ModelPaperPage /> },
              { path: APP_ROUTES.TEAM_ORDERS, element: <TeamOrdersPage /> },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
