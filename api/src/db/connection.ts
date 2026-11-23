// How the API connects to PostgreSQL over the network. One place decides
// TLS: certificate verification is on unless explicitly disabled (which
// production refuses), and TLS settings inside the URL are ignored,
// because node-postgres lets them override this (sslmode=no-verify would
// silently switch verification off).

export type DatabaseTls = {
  mode: 'verify' | 'disable';
  // PEM certificate of the provider's CA, when it is not publicly trusted
  ca: string | null;
};

const URL_TLS_PARAMETERS = [
  'ssl',
  'sslmode',
  'sslrootcert',
  'sslcert',
  'sslkey',
  'sslpassword',
  'uselibpqcompat',
];

export const toPoolConnection = (databaseUrl: string, tls: DatabaseTls) => {
  const url = new URL(databaseUrl);
  const ignoredUrlParameters = URL_TLS_PARAMETERS.filter(name =>
    url.searchParams.has(name),
  );
  for (const name of ignoredUrlParameters) {
    url.searchParams.delete(name);
  }
  return {
    connectionString: url.toString(),
    ssl:
      tls.mode === 'disable'
        ? (false as const)
        : { rejectUnauthorized: true, ...(tls.ca ? { ca: tls.ca } : {}) },
    ignoredUrlParameters,
  };
};

// The role a connection URL signs in as
export const roleOfDatabaseUrl = (databaseUrl: string) =>
  decodeURIComponent(new URL(databaseUrl).username);
