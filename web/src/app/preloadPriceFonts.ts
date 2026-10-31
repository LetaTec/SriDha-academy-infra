const RUPEE = '₹';

// The font weights prices are set in, by font token
const PRICE_FONTS = [
  { token: '--font-sans', weights: [400, 600, 700] },
  { token: '--font-serif', weights: [400, 500] },
] as const;

// The rupee sign lives in a separate font file from the Latin letters, and
// the browser fetches it only when a price first needs it. In the payment
// panel that is mid-slide, and each file that arrives makes the whole page
// lay itself out again, so the panel stutters. Fetching them once the page
// is idle means they are ready before the first click.
export const preloadPriceFonts = () => {
  if (!('fonts' in document)) return;

  const load = () => {
    const root = getComputedStyle(document.documentElement);

    PRICE_FONTS.forEach(({ token, weights }) => {
      const family = root.getPropertyValue(token).trim();
      if (!family) return;

      weights.forEach(weight => {
        document.fonts.load(`${weight} 1em ${family}`, RUPEE).catch(() => {
          // Only a head start: without it the font still loads when needed
        });
      });
    });
  };

  // Safari has no requestIdleCallback
  const whenIdle = () =>
    typeof window.requestIdleCallback === 'function'
      ? window.requestIdleCallback(load)
      : window.setTimeout(load, 0);

  if (document.readyState === 'complete') whenIdle();
  else window.addEventListener('load', whenIdle, { once: true });
};
