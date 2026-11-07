export const SALE_FONT_FAMILY = "Reggae One";
export const SALE_FONT_URL = "/fonts/reggae-one.woff2";

/** Shared by on-screen SVG, printed SVG, and standalone PNG export. */
export function saleFontCss(source = SALE_FONT_URL): string {
  const safeSource = source.replace(/["\\\n\r\f]/g, (char) => {
    return `\\${char.charCodeAt(0).toString(16)} `;
  });
  return `@font-face { font-family: '${SALE_FONT_FAMILY}'; font-style: normal; font-weight: 400; font-display: block; src: url("${safeSource}") format('woff2'); }`;
}
