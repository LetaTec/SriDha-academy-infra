import '@testing-library/jest-dom/vitest';

import { FEATURES } from '@constants/features';

// Tests cover the site with student accounts on; tests of the "off"
// state switch it themselves and switch it back
FEATURES.studentAccounts = true;

// jsdom does not implement the modal dialog API.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open');
  };
}

// jsdom does not implement scrolling; the router scroll handling calls it.
window.scrollTo = () => {};
Element.prototype.scrollIntoView = function scrollIntoView() {};

// jsdom has no canvas; decorative canvases simply draw nothing in tests.
HTMLCanvasElement.prototype.getContext = () => null;

// jsdom does not implement media queries; tests run as "no preference".
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
