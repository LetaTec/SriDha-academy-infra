// Origins the website runs on. Besides exact origins, an entry such as
// https://*.sridha-academy.pages.dev allows that host's direct subdomains
// (one label, https only): Cloudflare's preview deployments, which are built
// only from this repository's branches.
const WILDCARD_PREFIX = 'https://*.';
const SUBDOMAIN_LABEL = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
// At least two labels, so a wildcard never covers a whole top-level domain
const WILDCARD_HOST = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

export const isWildcardOrigin = (entry: string) =>
  entry.startsWith(WILDCARD_PREFIX);

// A wildcard entry is valid when what follows "https://*." is a plain host
export const isValidWildcardOrigin = (entry: string) =>
  isWildcardOrigin(entry) &&
  WILDCARD_HOST.test(entry.slice(WILDCARD_PREFIX.length));

export const isOriginAllowed = (
  allowedOrigins: readonly string[],
  origin: string,
) =>
  allowedOrigins.some(entry => {
    if (!isWildcardOrigin(entry)) return entry === origin;
    const suffix = `.${entry.slice(WILDCARD_PREFIX.length)}`;
    if (!origin.startsWith('https://') || !origin.endsWith(suffix)) {
      return false;
    }
    const label = origin.slice('https://'.length, -suffix.length);
    return SUBDOMAIN_LABEL.test(label);
  });
