/**
 * Leaving the page (WFE-168): the one place the app hands the browser to
 * another address, so everything else stays testable without a real
 * navigation. Only addresses {@link ../features/authorize/redirectTarget}
 * has accepted may reach it.
 */

/** Send the browser to {@link url}, keeping this page in its history. */
export function navigateTo(url: string): void {
  window.location.assign(url);
}
