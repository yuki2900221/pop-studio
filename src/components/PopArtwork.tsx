import SaleArtwork from "./SaleArtwork";
import type { PopDocument } from "../lib/model";
import { taxIncluded, formatPrice, isB5Paper } from "../lib/model";

export default function PopArtwork({
  doc,
  id,
  className = "",
}: {
  doc: PopDocument;
  id?: string;
  className?: string;
}) {
  if (doc.theme === "sale")
    return <SaleArtwork doc={doc} id={id} className={className} />;
  const portrait =
    doc.orientation === "portrait" &&
    doc.paper !== "shelf" &&
    !isB5Paper(doc.paper);
  const shelf = doc.paper === "shelf";
  const w = portrait ? 594 : 840,
    h = shelf ? 295 : portrait ? 840 : 594;
  const bold = doc.theme === "bold",
    organic = doc.theme === "organic",
    fresh = doc.theme === "fresh",
    minimal = doc.theme === "minimal";
  const bg = bold
    ? doc.color
    : organic
      ? "#edf0df"
      : fresh
        ? "#edf4f1"
        : minimal
          ? "#ffffff"
          : "#fff9ed";
  const ink = bold ? "#fffdf4" : doc.color;
  const priceInk = bold ? "#fffdf4" : minimal ? doc.color : "#d34430";
  const safePrice = /^\d{1,7}$/.test(doc.price) ? Number(doc.price) : 0;
  const nameWidth = portrait ? 480 : shelf ? 460 : 720;
  const nameSize = Math.min(
    (portrait ? 65 : shelf ? 57 : 74) * doc.fontScale,
    nameWidth / Math.max(doc.productName.length, 4) - 2,
  );
  const originSize = Math.min(
    shelf ? 19 : 24,
    (shelf ? 440 : w - 120) / Math.max(doc.origin.length, 1) - 2,
  );
  const unitSize = Math.min(
    shelf ? 16 : 22,
    (portrait ? 450 : shelf ? 380 : doc.image ? 440 : 650) /
      Math.max(doc.unit.length, 1) -
      2,
  );
  const badgeSize = Math.min(24, 300 / Math.max(doc.badge.length, 1) - 2);
  const priceSize =
    (shelf ? 100 : portrait ? 129 : 160) *
    Math.min(1, 4 / Math.max(String(safePrice).length, 3));
  const cx = portrait ? w / 2 : shelf ? 220 : doc.image ? 320 : w / 2;
  const imageX = portrait ? 45 : shelf ? 540 : 450,
    imageY = portrait ? 265 : shelf ? 28 : 220,
    imageW = portrait ? 504 : shelf ? 260 : 430,
    imageH = portrait ? 285 : shelf ? 240 : 350;
  const nameY = shelf ? 95 : portrait ? 212 : 188,
    priceY = shelf ? 214 : portrait ? 730 : 460;
  return (
    <svg
      id={id}
      className={className}
      fontFamily="'Yu Gothic', Meiryo, sans-serif"
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={`${doc.origin} ${doc.productName} ${formatPrice(safePrice)}円のPOP`}
    >
      <rect width={w} height={h} fill={bg} />
      {organic && (
        <>
          <circle
            cx={w + 80}
            cy={h * 0.5}
            r={h * 0.63}
            fill="#d8e0bb"
            opacity=".55"
          />
          <path
            d={`M0 ${h - 35} Q${w * 0.3} ${h - 110} ${w} ${h - 48}V${h}H0Z`}
            fill={doc.color}
            opacity=".12"
          />
        </>
      )}
      {bold ? (
        <>
          <path
            d={`M0 0H${w}V26H0ZM0 ${h - 26}H${w}V${h}H0Z`}
            fill="#fff"
            opacity=".12"
          />
          <rect
            x="20"
            y="20"
            width={w - 40}
            height={h - 40}
            fill="none"
            stroke="#fff8db"
            strokeWidth="2"
          />
        </>
      ) : minimal ? (
        <rect
          x="26"
          y="26"
          width={w - 52}
          height={h - 52}
          fill="none"
          stroke={doc.color}
          strokeWidth="1.5"
        />
      ) : (
        <>
          <path d={`M32 32H${w - 32}`} stroke={doc.color} strokeWidth="3" />
          <path
            d={`M32 ${h - 32}H${w - 32}`}
            stroke={doc.color}
            strokeWidth="3"
          />
        </>
      )}
      {!shelf && doc.badge && (
        <g>
          <rect
            x={w / 2 - Math.min(160, doc.badge.length * 16)}
            y="52"
            width={Math.min(320, doc.badge.length * 32)}
            height="44"
            rx={minimal ? 0 : 22}
            fill={ink}
          />
          <text
            x={w / 2}
            y="82"
            fill={bold ? doc.color : bg}
            textAnchor="middle"
            fontSize={badgeSize}
            fontWeight="700"
            letterSpacing="2"
          >
            {doc.badge}
          </text>
        </g>
      )}
      <text
        x={shelf ? 48 : w / 2}
        y={shelf ? 46 : portrait ? 143 : 134}
        fill={ink}
        fontSize={originSize}
        textAnchor={shelf ? "start" : "middle"}
        letterSpacing="3"
        fontWeight="500"
      >
        {doc.origin}
      </text>
      <text
        x={shelf ? 48 : w / 2}
        y={nameY + (portrait ? 20 : 20)}
        fill={ink}
        fontSize={nameSize}
        textAnchor={shelf ? "start" : "middle"}
        fontWeight="900"
        letterSpacing="2"
      >
        {doc.productName || "商品名"}
      </text>
      {doc.image && (
        <image
          href={doc.image}
          x={imageX}
          y={imageY}
          width={imageW}
          height={imageH}
          preserveAspectRatio="xMidYMid meet"
        />
      )}
      <g>
        <text
          x={cx}
          y={priceY - (shelf ? 82 : portrait ? 145 : 133)}
          textAnchor="middle"
          fill={ink}
          fontSize={unitSize}
          letterSpacing="2"
        >
          {doc.unit}
        </text>
        <text
          x={cx + (shelf ? 0 : 0)}
          y={priceY}
          textAnchor="middle"
          fill={priceInk}
          fontSize={priceSize}
          fontWeight="900"
          letterSpacing="-6"
          fontFamily="Arial, 'Noto Sans JP', sans-serif"
        >
          {formatPrice(safePrice)}
          <tspan fontSize={shelf ? 28 : 38} letterSpacing="0" dx="8">
            円
          </tspan>
        </text>
        {doc.showTax && (
          <text
            x={cx}
            y={priceY + (shelf ? 32 : 42)}
            textAnchor="middle"
            fill={ink}
            fontSize={shelf ? 17 : 22}
            letterSpacing="1"
          >
            税込{" "}
            {formatPrice(taxIncluded(doc.price, doc.taxRate, doc.taxRounding))}
            円
          </text>
        )}
      </g>
      {!shelf && (
        <text
          x={w - 42}
          y={h - 48}
          fill={ink}
          textAnchor="end"
          opacity=".7"
          fontSize="14"
        >
          本体価格・消費税{doc.taxRate}%
        </text>
      )}
    </svg>
  );
}
