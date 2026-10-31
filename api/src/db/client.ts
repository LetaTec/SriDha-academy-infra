/* eslint-disable @typescript-eslint/no-explicit-any */
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';

import { MIGRATIONS } from './migrations.js';

const { Pool } = pg;

export type QueryResultRow = Record<string, any>;

// A row as read from the database, before a repository maps it
export type Row = Record<string, unknown>;

export type QueryResult<T = QueryResultRow> = {
  rows: T[];
  rowCount: number;
};

export type DatabaseClient = {
  query: <T = QueryResultRow>(
    sql: string,
    params?: unknown[],
  ) => Promise<QueryResult<T>>;
  get: <T = QueryResultRow>(
    sql: string,
    params?: unknown[],
  ) => Promise<T | null>;
  all: <T = QueryResultRow>(sql: string, params?: unknown[]) => Promise<T[]>;
  run: (sql: string, params?: unknown[]) => Promise<{ rowCount: number }>;
  exec: (sql: string) => Promise<void>;
};

export type Database = DatabaseClient & {
  transaction: <T>(work: (tx: DatabaseClient) => Promise<T>) => Promise<T>;
  close: () => Promise<void>;
};

const IN_MEMORY_DATABASE = ':memory:';

// PGlite reports rows changed by INSERT, UPDATE and DELETE as affectedRows;
// a SELECT has none, so its row count is the rows it returned
const pgliteRowCount = (result: { rows: unknown[]; affectedRows?: number }) =>
  result.affectedRows ?? result.rows.length;

// No DATABASE_URL (or ":memory:") means the embedded in-memory PostgreSQL.
export const isInMemoryDatabase = (
  databaseUrl?: string | null,
): databaseUrl is typeof IN_MEMORY_DATABASE | '' | null | undefined =>
  !databaseUrl || databaseUrl === IN_MEMORY_DATABASE;

export const openDatabase = async (
  databaseUrl?: string | null,
  maxConnections = 10,
): Promise<Database> => {
  if (!isInMemoryDatabase(databaseUrl)) {
    const isProduction = process.env.NODE_ENV === 'production';
    const pool = new Pool({
      connectionString: databaseUrl,
      max: maxConnections,
      ssl: isProduction ? { rejectUnauthorized: false } : undefined,
    });

    const clientWrapper: DatabaseClient = {
      query: async <T = QueryResultRow>(sql: string, params?: unknown[]) => {
        const res = await pool.query(sql, params as any[]);
        return { rows: res.rows as T[], rowCount: res.rowCount ?? 0 };
      },
      get: async <T = QueryResultRow>(sql: string, params?: unknown[]) => {
        const res = await pool.query(sql, params as any[]);
        return (res.rows[0] as T) ?? null;
      },
      all: async <T = QueryResultRow>(sql: string, params?: unknown[]) => {
        const res = await pool.query(sql, params as any[]);
        return res.rows as T[];
      },
      run: async (sql: string, params?: unknown[]) => {
        const res = await pool.query(sql, params as any[]);
        return { rowCount: res.rowCount ?? 0 };
      },
      exec: async (sql: string) => {
        await pool.query(sql);
      },
    };

    return {
      ...clientWrapper,
      transaction: async <T>(work: (tx: DatabaseClient) => Promise<T>) => {
        const conn = await pool.connect();
        try {
          await conn.query('BEGIN');
          const txClient: DatabaseClient = {
            query: async <R = QueryResultRow>(
              sql: string,
              params?: unknown[],
            ) => {
              const res = await conn.query(sql, params as any[]);
              return { rows: res.rows as R[], rowCount: res.rowCount ?? 0 };
            },
            get: async <R = QueryResultRow>(
              sql: string,
              params?: unknown[],
            ) => {
              const res = await conn.query(sql, params as any[]);
              return (res.rows[0] as R) ?? null;
            },
            all: async <R = QueryResultRow>(
              sql: string,
              params?: unknown[],
            ) => {
              const res = await conn.query(sql, params as any[]);
              return res.rows as R[];
            },
            run: async (sql: string, params?: unknown[]) => {
              const res = await conn.query(sql, params as any[]);
              return { rowCount: res.rowCount ?? 0 };
            },
            exec: async (sql: string) => {
              await conn.query(sql);
            },
          };
          const result = await work(txClient);
          await conn.query('COMMIT');
          return result;
        } catch (error) {
          await conn.query('ROLLBACK');
          throw error;
        } finally {
          conn.release();
        }
      },
      close: async () => {
        await pool.end();
      },
    };
  }

  // In-memory or fallback PostgreSQL instance via WebAssembly PGlite
  const pglite = new PGlite();

  const clientWrapper: DatabaseClient = {
    query: async <T = QueryResultRow>(sql: string, params?: unknown[]) => {
      const res = await pglite.query(sql, params as any[]);
      return { rows: res.rows as T[], rowCount: pgliteRowCount(res) };
    },
    get: async <T = QueryResultRow>(sql: string, params?: unknown[]) => {
      const res = await pglite.query(sql, params as any[]);
      return (res.rows[0] as T) ?? null;
    },
    all: async <T = QueryResultRow>(sql: string, params?: unknown[]) => {
      const res = await pglite.query(sql, params as any[]);
      return res.rows as T[];
    },
    run: async (sql: string, params?: unknown[]) => {
      const res = await pglite.query(sql, params as any[]);
      return { rowCount: pgliteRowCount(res) };
    },
    exec: async (sql: string) => {
      await pglite.exec(sql);
    },
  };

  return {
    ...clientWrapper,
    transaction: async <T>(work: (tx: DatabaseClient) => Promise<T>) => {
      return pglite.transaction(async tx => {
        const txClient: DatabaseClient = {
          query: async <R = QueryResultRow>(
            sql: string,
            params?: unknown[],
          ) => {
            const res = await tx.query(sql, params as any[]);
            return { rows: res.rows as R[], rowCount: pgliteRowCount(res) };
          },
          get: async <R = QueryResultRow>(sql: string, params?: unknown[]) => {
            const res = await tx.query(sql, params as any[]);
            return (res.rows[0] as R) ?? null;
          },
          all: async <R = QueryResultRow>(sql: string, params?: unknown[]) => {
            const res = await tx.query(sql, params as any[]);
            return res.rows as R[];
          },
          run: async (sql: string, params?: unknown[]) => {
            const res = await tx.query(sql, params as any[]);
            return { rowCount: pgliteRowCount(res) };
          },
          exec: async (sql: string) => {
            await tx.exec(sql);
          },
        };
        return work(txClient);
      });
    },
    close: async () => {
      await pglite.close();
    },
  };
};

export const runMigrations = async (db: Database): Promise<void> => {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL
    );
  `);

  const appliedRows = await db.all<{ id: string }>(
    'SELECT id FROM schema_migrations',
  );
  const applied = new Set(appliedRows.map(row => String(row.id)));

  for (const migration of MIGRATIONS) {
    if (!applied.has(migration.id)) {
      await db.transaction(async tx => {
        await tx.exec(migration.sql);
        await tx.query(
          'INSERT INTO schema_migrations (id, applied_at) VALUES ($1, $2)',
          [migration.id, new Date().toISOString()],
        );
      });
      applied.add(migration.id);
    }
  }
};

export const transaction = async <T>(
  db: Database,
  work: (tx: DatabaseClient) => Promise<T>,
): Promise<T> => {
  return db.transaction(work);
};
