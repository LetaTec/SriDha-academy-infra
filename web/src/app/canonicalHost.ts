// "sridhaacademy.com." (a trailing dot, which browsers accept) is a
// different origin from "sridhaacademy.com". The API only answers the
// usual address, so on the dotted one nothing loads and sign-in fails.
// Visitors there are sent to the usual address before the app starts.
// Returns true when it is redirecting.
export const redirectToCanonicalHost = () => {
  const { hostname, href } = window.location;
  if (!hostname.endsWith('.')) return false;

  const url = new URL(href);
  url.hostname = hostname.replace(/\.+$/, '');
  window.location.replace(url.href);
  return true;
};
