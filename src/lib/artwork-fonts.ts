export const SALE_FONT_FAMILY = "Mochiy Pop One";
export const SALE_FONT_URL = "/fonts/mochiy-pop-one.woff2";
export const PRICE_FONT_FAMILY = "Archivo Black";
export const PRICE_FONT_URL = "/fonts/archivo-black.woff2";

function escapeFontSource(source: string): string {
  return source.replace(/["\\\n\r\f]/g, (char) => {
    return `\\${char.charCodeAt(0).toString(16)} `;
  });
}

/** Shared by on-screen SVG, printed SVG, and standalone PNG export. */
export function saleFontCss(
  source = SALE_FONT_URL,
  priceSource = PRICE_FONT_URL,
): string {
  return [
    [SALE_FONT_FAMILY, source],
    [PRICE_FONT_FAMILY, priceSource],
  ]
    .map(
      ([family, fontSource]) =>
        `@font-face { font-family: '${family}'; font-style: normal; font-weight: 400; font-display: block; src: url("${escapeFontSource(fontSource)}") format('woff2'); }`,
    )
    .join("\n");
}
