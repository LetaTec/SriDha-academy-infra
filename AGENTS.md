# Repository Instructions

These rules follow the pro-web conventions, adapted to SriDha Academy. Differences from pro-web are called out explicitly.

## Repository layout

- `api/` — Node + Express 5 + TypeScript API. PostgreSQL through `pg` in production; PGlite (an in-memory PostgreSQL) when `DATABASE_URL` is unset, locally and in tests. Owns authentication, sessions, the catalogue, checkout and payments, enrolments and enquiries.
- `web/` — Vite + React 19 + TypeScript + CSS Modules website.
- The API is the only source of truth for identity, catalogue data and permissions. The website never generates identifiers for persisted records.
- `api/src/contracts` defines every request and response shape, types only. The API checks its responses with `satisfies <Response>` and its schemas with `satisfies z.ZodType<Request>`; the website imports the same files as `@contracts/*` (type-only) instead of declaring its own.

## Architecture (web)

- Pages, layouts, components and hooks talk to domain services in `src/services/*` (`auth`, `catalogue`, `enrolments`, `payments`, `admin`, `enquiries`). Only services import the shared Axios client from `src/services/http/api.ts`.
- Server data is read through TanStack Query hooks in `src/hooks` (`useCatalogue`, `useTopicPreviews`, `useMyLearning`, `useTeamOrders`), with keys in `QUERY_KEY` (`src/app/queryClient.ts`). Do not fetch in `useEffect`; after a change on the server, invalidate the keys it affects (see `useRefreshAfterPayment`).
- Topics come only from the catalogue: use `useTopicPreviews` for topic cards. The topic list lives in `api/src/db/topicLibrary.ts`; never copy topic names or lists into the website.
- Dependency direction: pages/layouts compose services, hooks, constants and components; services own backend calls; utilities stay pure and side-effect free.
- Keep generic display formatting in `src/utils/*` (`currency`, `date`, `url`) or domain mappers. Components must not define local date, currency or entity formatters.
- Use route-local `components/` folders (for example `pages/home/components`) for code used by one route. Promote to `src/components`, `src/hooks` or `src/services` only when reuse is real.
- Selection and dialog state that must survive authentication (open topic, chosen batch, redirect target) lives in the URL. Use `useTopicSelection` and the `redirect_to` query parameter; do not duplicate it in component state or storage.
- Students choose topics, never subjects. Subjects appear only as a way to find topics on the Topics page (the subject filter and subject group headings); topic cards, dialogs and other copy never present a subject or a "course".

## Access control

- Keep access decisions in pure, synchronous policy modules under `src/access/*`, named after actions (for example `canEnrolInBatch`). The first argument is the value from `useAuth()`.
- Client policies only shape the UI. Every restricted operation is enforced again by the API (`requireAuth`, server-derived user IDs, strict request schemas).

## API conventions

- Every error response is `{ message: string, code: string, details: unknown | null }`. Validation errors use `code: "REQUEST_VALIDATION_FAILED"` with field issues under `details.body`.
- Validate every request body with a strict zod schema (`z.strictObject`) through `http/validate.ts`. Never accept a user or student ID from the client; use `req.auth.userId`.
- Error codes live in `ERROR_CODE` (`api/src/http/errors.ts`). Never hardcode error-code strings elsewhere.
- Schema changes are new entries appended to `api/src/db/migrations.ts`. Never edit an applied migration. Production is migrated on start-up but seeded by hand, so a migration that adds columns fills existing rows itself.
- Layers per module: routes validate and respond, services hold the rules, and every SQL statement lives in the module's `*.repository.ts`.
- Log with `logger` (`api/src/logging/logger.ts`), never `console`: a named event (`payments.webhook_amount_mismatch`) and fields. Every line carries the request id; error-level events also go to Sentry when `SENTRY_DSN` is set. Never log passwords, tokens or card details.

## Form error handling

- Small forms keep the schema, inferred type, `useApiForm` setup and submit handler inline in the form component.
- API errors go through `useApiForm` / `useApiFormError` and `src/services/api/errors.ts`. Do not dig into Axios responses in components.
- Show form-level messages with `FieldStatus`, field messages on the fields.

## Components and styling

- React + TypeScript with CSS Modules. Each component with styling has a colocated `.module.css` and uses `classnames/bind` via `cx.bind(styles)`.
- `src/components/ui` holds product-agnostic building blocks. Business-aware components live under their entity: `auth`, `catalogue`, `enrolments`, `enquiries`, `brand`.
- Reuse before building. Cards are always `Card` inside `CardGrid`. Section layout is `Section` + `SectionHead`. Text is `Text` / `Heading`. Buttons are `Button`, `ButtonLink`, `ButtonRouteLink`, `IconButton` or `ButtonBase` — never a raw `<button>`. Dialogs are `Modal` (native `<dialog>`). Icons are `Icon` with names from `src/constants/icons.ts` — never raw Unicode arrows.
- Async actions pass `loading` to `Button`; the button keeps its width and shows a spinner.
- Export public prop types as `ComponentNameProps`. No single-component `index.ts` barrels.
- Use `BrandLogo` for the SriDha Academy wordmark.

## Import ordering

- Three groups separated by a blank line: package imports, app-wide aliased imports (`@/`, `@components`, `@constants`, …), then relative imports.
- A blank line follows the imports before `const cn = cx.bind(styles)` or other code.

## Design system

- `web/src/styles/tokens.css` is the visual source of truth. Component CSS uses tokens for colour, spacing, typography, motion, layout and z-index. Add a token before introducing a new value.
- Spacing follows the 4px/8px token scale (`--space-*`).
- Do not end single-sentence UI copy with a period. Editorial headlines that end in a period ("Open the next chapter.") are part of the brand and keep it.
- Use typography primitives (`Text`, `Heading`) for text roles. Visual casing uses CSS `text-transform`, never JS string methods.
- Status UI is a semantic dot plus plain text (`StatusDot`). Map domain statuses to semantic colours in `src/constants/*`.
- Route shells own page padding; components own internal layout. The brand uses flat offset blocks (`--shadow-offset-accent`) instead of soft card shadows.

## Constants, pages and routing

- Domain labels, options and status mappings live in one constants file per domain (`catalogue.ts`, `student.ts`, `enquiry.ts`, `auth.ts`). Derive option arrays from source values.
- Homepage copy lives in `src/constants/home.ts`. Components do not hardcode display strings.
- Page entry files are named after the page (`HomePage.tsx`) and lazy-loaded at route boundaries in `src/app/router.tsx`.

## Responsive CSS (differs from pro-web)

- CSS custom properties cannot be used inside media queries — `@media (max-width: var(--breakpoint-sm))` is ignored by browsers. SriDha Academy declares shared breakpoints as custom media in `web/src/styles/breakpoints.css`, compiled by `postcss-custom-media`:
  - `@media (--viewport-md)`, `@media (--viewport-sm)`, `@media (--reduced-motion)`, `@media (--no-hover)` (touch screens).
- Do not invent component-specific breakpoints; add a custom media entry first.
- Respect `prefers-reduced-motion` for every transition and animation.

## Verification

- `npm run lint`, `npm run typecheck`, `npm run test` and `npm run build` must pass from the repository root.
- Browser tests: `npm run test:e2e -w web` starts the API (on a throwaway in-memory database) and the dev server, then drives Chrome at desktop and mobile sizes.
- GitHub Actions (`.github/workflows/checks.yml`) runs all of the above on every pull request.
- Run `npm run format` before pushing.
