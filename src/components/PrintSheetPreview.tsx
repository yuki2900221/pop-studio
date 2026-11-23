import PopArtwork from "./PopArtwork";
import { isB5Paper } from "../lib/model";
import { sheetGeometry, type PrintSheet } from "../lib/print";

const percent = (value: number, total: number) => `${(value / total) * 100}%`;

/** Same millimetre geometry as the print HTML: safe margin, cells, cut lines. */
export default function PrintSheetPreview({ sheet }: { sheet: PrintSheet }) {
  const slots = sheet.columns * sheet.rows;
  const label = `${isB5Paper(sheet.paper) ? "B5" : sheet.paper === "shelf" ? "棚札" : sheet.paper} ${sheet.orientation === "portrait" ? "縦" : "横"} ${slots}面付け`;
  const { cells, cutLines } = sheetGeometry(sheet);

  return (
    <div
      className="queue-sheet"
      role="group"
      aria-label={label}
      style={{ aspectRatio: `${sheet.width} / ${sheet.height}` }}
    >
      {cells.map((cell, index) => (
        <div
          className="queue-cell"
          key={index}
          aria-label={sheet.documents[index] ? undefined : "空き枠"}
          style={{
            left: percent(cell.left, sheet.width),
            top: percent(cell.top, sheet.height),
            width: percent(cell.width, sheet.width),
            height: percent(cell.height, sheet.height),
          }}
        >
          {sheet.documents[index] ? (
            <PopArtwork doc={sheet.documents[index]} />
          ) : null}
        </div>
      ))}
      {cutLines.length ? (
        <svg
          className="queue-cut-lines"
          aria-hidden="true"
          viewBox={`0 0 ${sheet.width} ${sheet.height}`}
          preserveAspectRatio="none"
        >
          <g
            stroke="#8a9096"
            strokeWidth={0.35}
            strokeDasharray="2 1.5"
            fill="none"
          >
            {cutLines.map((line, index) => (
              <line key={index} {...line} />
            ))}
          </g>
        </svg>
      ) : null}
    </div>
  );
}
