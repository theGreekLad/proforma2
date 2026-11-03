/**
 * `?share=1` turns a page into a standalone view for sharing: no site nav,
 * so the person you send it to can't wander off to the other tabs.
 */
export const SHARE_MODE = new URLSearchParams(window.location.search).get('share') === '1';

/** Keep share mode on links that open another page (e.g. a design's full view). */
export function withShare(url) {
  if (!SHARE_MODE) return url;
  return `${url}${url.includes('?') ? '&' : '?'}share=1`;
}
