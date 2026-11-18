import pg from 'pg';

// Real-PostgreSQL test suites need TEST_DATABASE_URL (a superuser URL to a
// disposable server's maintenance database; the suites create and drop
// their own databases and roles). Without it a suite is reported as
// "NOT RUN", never as passed. With REQUIRE_POSTGRES_TESTS=1 (CI, and
// `npm run test:postgres -w api`) a missing URL fails the run instead.
export const POSTGRES_ADMIN_URL = process.env.TEST_DATABASE_URL;

export const postgresSuite = (name: string): { skip: string | false } => {
  if (POSTGRES_ADMIN_URL) return { skip: false };
  if (process.env.REQUIRE_POSTGRES_TESTS === '1') {
    throw new Error(
      `${name}: REQUIRE_POSTGRES_TESTS=1 but TEST_DATABASE_URL is not set; this mandatory real-PostgreSQL suite cannot run`,
    );
  }
  return {
    skip: `NOT RUN: ${name} needs TEST_DATABASE_URL (a disposable PostgreSQL server)`,
  };
};

// Runs SQL as the server's administrator (create/drop databases and roles)
export const asPostgresAdmin = async (sql: string) => {
  const client = new pg.Client({ connectionString: POSTGRES_ADMIN_URL });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
};

// A URL to `database` on the test server, optionally as another role
export const postgresUrl = (
  database: string,
  user?: { name: string; password: string },
) => {
  const url = new URL(POSTGRES_ADMIN_URL!);
  url.pathname = `/${database}`;
  if (user) {
    url.username = user.name;
    url.password = user.password;
  }
  return url.toString();
};
