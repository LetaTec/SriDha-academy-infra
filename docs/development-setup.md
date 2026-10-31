# SriDha Academy (LetEd) — Development Setup Guide

## 1. Prerequisites

- **Node.js**: Version 22 LTS (`>=22.13.0`). Check your version:
  ```bash
  node -v
  ```
- **npm**: Version 10+.
- **Git**: Installed and configured.
- **PostgreSQL**: (Optional for local testing). The test suite and zero-configuration development mode automatically use an embedded PostgreSQL WebAssembly engine (`@electric-sql/pglite`) without requiring a local PostgreSQL daemon or Docker. For connecting to an external local/cloud PostgreSQL database, a standard connection string is supported.

---

## 2. Initial Setup

1. **Clone the repository and checkout the feature branch**:

   ```bash
   git clone https://github.com/LetaTec/LetEd.git
   cd LetEd
   git checkout feat/postgresql-production-readiness
   ```

2. **Install all workspace dependencies from root**:

   ```bash
   npm install
   ```

3. **Verify the environment**:
   ```bash
   npm run typecheck
   npm run test
   ```
   All 55 automated tests (API + Web) must pass.

---

## 3. Environment Configuration (`.env`)

### Backend (`api/.env`)

Create `api/.env`:

```env
NODE_ENV=development
PORT=4000
WEB_ORIGIN=http://localhost:5173
# Optional: Set DATABASE_URL to connect to a local PostgreSQL instance.
# If omitted or left as :memory:, the API runs in-memory PostgreSQL automatically.
# DATABASE_URL=postgres://postgres:postgres@localhost:5432/sridha_dev
MAIL_TRANSPORT=console
```

### Frontend (`web/.env.local`)

Create `web/.env.local`:

```env
# In development, the Vite dev server proxies or connects directly to the API
VITE_API_URL=http://localhost:4000/api
```

---

## 4. Running the Application

### Start Backend API:

```bash
npm run dev:api
```

The API server starts on `http://localhost:4000`. Database migrations and schema creation execute automatically on startup.

### Seed Course Catalogue:

```bash
npm run db:seed
```

Seeds subjects, chapters, topics, lessons, and batch cohorts into the PostgreSQL database named by `DATABASE_URL`. Without `DATABASE_URL`, the API runs in-memory and seeds its own catalogue every time it starts, so this step is not needed.

### Start Frontend Website:

```bash
npm run dev:web
```

The Vite development server starts on `http://localhost:5173`. Open your browser to explore the website.

---

## 5. Running Tests

- **Run all automated tests (backend and frontend)**:
  ```bash
  npm run test
  ```
- **Run backend tests only**:
  ```bash
  npm run test -w api
  ```
- **Run frontend tests only**:
  ```bash
  npm run test -w web
  ```
