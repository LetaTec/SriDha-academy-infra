import { lazy, Suspense } from 'react';
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  type RouteObject,
} from 'react-router-dom';

import { PageLoader } from '@components/ui/PageLoader/PageLoader';
import { PAGE_TEXT } from '@constants/pages';
import { POLICY } from '@constants/policies';
import { APP_ROUTES } from '@constants/routes';
import { AuthShell } from '@layout/AuthShell/AuthShell';
import { SiteShell } from '@layout/SiteShell/SiteShell';

import { ProtectedRoute } from '@/routes/ProtectedRoute';
import { RouteErrorBoundary } from '@/routes/RouteErrorBoundary';

const HomePage = lazy(() => import('@pages/home/HomePage'));
const BatchesPage = lazy(() => import('@pages/batches/BatchesPage'));
const TopicsPage = lazy(() => import('@pages/topics/TopicsPage'));
const AboutPage = lazy(() => import('@pages/about/AboutPage'));
const AiTestPage = lazy(() => import('@pages/ai-test/AiTestPage'));
const ModelPaperPage = lazy(() => import('@pages/model-paper/ModelPaperPage'));
const AdminSignInPage = lazy(
  () => import('@pages/admin-sign-in/AdminSignInPage'),
);
const NotFoundPage = lazy(() => import('@pages/not-found/NotFoundPage'));
const PolicyPage = lazy(() => import('@pages/policy/PolicyPage'));
const TeamOrdersPage = lazy(() => import('@pages/team-orders/TeamOrdersPage'));
const CheckoutPage = lazy(() => import('@pages/checkout/CheckoutPage'));

const SuspendedOutlet = () => (
  <Suspense fallback={<PageLoader label={PAGE_TEXT.loading} />}>
    <Outlet />
  </Suspense>
);

// The site is open to everyone and students never sign in: they pay with
// their name, email and mobile, and the seat belongs to that email. Only
// the team signs in (with an emailed link), for the pages behind
// ProtectedRoute.
export const routes: RouteObject[] = [
  {
    element: <AuthShell />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        element: <SuspendedOutlet />,
        children: [
          { path: APP_ROUTES.ADMIN_SIGN_IN, element: <AdminSignInPage /> },
          // Public policy pages, with or without an account
          {
            path: APP_ROUTES.TERMS,
            element: <PolicyPage policy={POLICY.terms} />,
          },
          {
            path: APP_ROUTES.CONTACT,
            element: <PolicyPage policy={POLICY.contact} />,
          },
        ],
      },
    ],
  },
  // Student accounts are gone; old links (from emails, bookmarks) land on
  // the homepage
  ...[
    APP_ROUTES.LOGIN,
    APP_ROUTES.REGISTER,
    APP_ROUTES.FORGOT_PASSWORD,
    APP_ROUTES.RESET_PASSWORD,
    APP_ROUTES.MY_LEARNING,
    APP_ROUTES.REFUNDS,
  ].map(path => ({
    path,
    element: <Navigate to={APP_ROUTES.HOME} replace />,
  })),
  {
    element: <SiteShell />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        element: <SuspendedOutlet />,
        children: [
          { path: APP_ROUTES.HOME, element: <HomePage /> },
          { path: APP_ROUTES.BATCHES, element: <BatchesPage /> },
          { path: APP_ROUTES.TOPICS, element: <TopicsPage /> },
          { path: APP_ROUTES.ABOUT, element: <AboutPage /> },
          { path: APP_ROUTES.AI_TEST, element: <AiTestPage /> },
          { path: APP_ROUTES.MODEL_PAPER, element: <ModelPaperPage /> },
          // Open to everyone; paying needs no account
          { path: APP_ROUTES.CHECKOUT, element: <CheckoutPage /> },
          {
            element: <ProtectedRoute />,
            children: [
              { path: APP_ROUTES.TEAM_ORDERS, element: <TeamOrdersPage /> },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
