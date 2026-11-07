import type { PopDocument } from "../lib/model";
import { formatPrice, taxIncluded } from "../lib/model";
import { SALE_FONT_FAMILY, saleFontCss } from "../lib/artwork-fonts";

/** Store reference: one SVG is shared by preview, PNG and physical print. */
export default function SaleArtwork({
  doc,
  id,
  className = "",
}: {
  doc: PopDocument;
  id?: string;
  className?: string;
}) {
  const portrait = doc.orientation === "portrait" && doc.paper !== "shelf";
  const width = portrait ? 594 : 840,
    height = doc.paper === "shelf" ? 295 : portrait ? 840 : 594;
  const scale = Math.min(width / 1200, height / 848);
  const offsetX = (width - 1200 * scale) / 2,
    offsetY = (height - 848 * scale) / 2;
  const red = doc.color;
  const amount = /^\d{1,7}$/.test(doc.price) ? Number(doc.price) : 0;
  const name = doc.productName || "商品名称";
  const chars = Array.from(name);
  const split = chars.length > 10 ? Math.ceil(chars.length / 2) : 0;
  const names = split
    ? [chars.slice(0, split).join(""), chars.slice(split).join("")]
    : [name];
  const hasDescenders = /[gjpqy_]/.test(name);
  const requestedNameSize = (names.length === 2 ? 130 : 275) * doc.fontScale;
  // Keep Latin descenders inside the heading area, above the blue memo.
  const nameSize = hasDescenders
    ? Math.min(requestedNameSize, names.length === 2 ? 132 : 275)
    : requestedNameSize;
  const price = formatPrice(amount);
  const tax = formatPrice(taxIncluded(doc.price, doc.taxRate, doc.taxRounding));
  const fit = (text: string, max: number, size: number) =>
    Math.min(max, Math.max(size, text.length * size * 0.96));
  const labelSize = (text: string, base: number, normal: number) =>
    Math.min(base, base * Math.sqrt(normal / Math.max(text.length, normal)));
  return (
    <svg
      id={id}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${doc.origin} ${doc.productName} ${price}円の特売POP`}
      fontFamily={`'${SALE_FONT_FAMILY}', sans-serif`}
      fontWeight="400"
      strokeLinejoin="round"
    >
      <defs>
        <style data-pop-font="sale">{saleFontCss()}</style>
      </defs>
      <rect width={width} height={height} fill="#fff" />
      <g transform={`translate(${offsetX} ${offsetY}) scale(${scale})`}>
        {doc.badge && (
          <g transform="translate(42 252) rotate(-25)">
            <text
              x="0"
              y="0"
              fill={red}
              stroke="#000"
              strokeWidth="10"
              paintOrder="stroke fill"
              strokeLinejoin="round"
              fontSize="99"
              textLength={Math.min(310, doc.badge.length * 99)}
              lengthAdjust="spacingAndGlyphs"
            >
              {doc.badge}
            </text>
          </g>
        )}
        {names.map((line, i) => (
          <text
            key={i}
            x="766"
            y={names.length === 2 ? 145 + i * 156 : hasDescenders ? 258 : 300}
            textAnchor="middle"
            fill="#000"
            stroke="#000"
            strokeWidth="2"
            paintOrder="stroke fill"
            fontSize={nameSize}
            textLength={fit(line, 832, nameSize)}
            lengthAdjust="spacingAndGlyphs"
          >
            {line}
          </text>
        ))}
        {doc.origin && (
          <text
            x="22"
            y="434"
            fill="#000"
            stroke="#000"
            strokeWidth="1"
            fontSize={labelSize(doc.origin, 84, 7)}
            textLength={fit(doc.origin, 415, 84)}
            lengthAdjust="spacingAndGlyphs"
          >
            {doc.origin}
          </text>
        )}
        {doc.unit && (
          <text
            x="24"
            y="531"
            fill="#000"
            stroke="#000"
            strokeWidth="1"
            fontSize={labelSize(doc.unit, 84, 7)}
            textLength={fit(doc.unit, 414, 84)}
            lengthAdjust="spacingAndGlyphs"
          >
            {doc.unit}
          </text>
        )}
        {doc.memo1 && (
          <text
            x="824"
            y="426"
            fill="#0000ff"
            fontSize={labelSize(doc.memo1, 97, 4)}
            textAnchor="middle"
            textLength={fit(doc.memo1, 668, 97)}
            lengthAdjust="spacingAndGlyphs"
          >
            {doc.memo1}
          </text>
        )}
        {doc.memo2 && (
          <text
            x="233"
            y="626"
            fill="#000"
            fontSize={labelSize(doc.memo2, 88, 4)}
            textAnchor="middle"
            textLength={fit(doc.memo2, 402, 88)}
            lengthAdjust="spacingAndGlyphs"
          >
            {doc.memo2}
          </text>
        )}
        <text
          x="26"
          y="719"
          fill={red}
          fontSize="93"
          textLength="392"
          lengthAdjust="spacingAndGlyphs"
        >
          本体価格
        </text>
        <g
          fill="#000"
          stroke="#000"
          strokeWidth="4"
          paintOrder="stroke fill"
          transform="translate(8 9)"
          aria-hidden="true"
        >
          <text
            x="456"
            y="690"
            fontSize="300"
            textLength="617"
            lengthAdjust="spacingAndGlyphs"
          >
            {price}
          </text>
          <text
            x="1088"
            y="690"
            fontSize="139"
            textLength="94"
            lengthAdjust="spacingAndGlyphs"
          >
            円
          </text>
        </g>
        <text
          x="456"
          y="690"
          fill={red}
          stroke={red}
          strokeWidth="4"
          paintOrder="stroke fill"
          fontSize="300"
          textLength="617"
          lengthAdjust="spacingAndGlyphs"
        >
          {price}
        </text>
        <text
          x="1088"
          y="690"
          fill={red}
          stroke={red}
          strokeWidth="3"
          paintOrder="stroke fill"
          fontSize="139"
          textLength="94"
          lengthAdjust="spacingAndGlyphs"
        >
          円
        </text>
        {doc.showTax && (
          <g fill="#000">
            <text x="246" y="812" fontSize="90">
              (
            </text>
            <text
              x="355"
              y="811"
              fontSize="58"
              textLength="202"
              lengthAdjust="spacingAndGlyphs"
            >
              税込価格
            </text>
            <text
              x="593"
              y="811"
              fontSize="98"
              stroke="#000"
              strokeWidth="3"
              textLength="429"
              lengthAdjust="spacingAndGlyphs"
            >
              {tax}
            </text>
            <text x="1045" y="811" fontSize="65">
              円
            </text>
            <text x="1144" y="812" fontSize="90">
              )
            </text>
          </g>
        )}
      </g>
    </svg>
  );
}
