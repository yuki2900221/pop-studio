import PopArtwork from "./PopArtwork";
import { isB5Paper } from "../lib/model";
import type { PrintSheet } from "../lib/print";

export default function PrintSheetPreview({ sheet }: { sheet: PrintSheet }) {
  const slots = sheet.columns * sheet.rows;
  const label = `${isB5Paper(sheet.paper) ? "B5" : sheet.paper === "shelf" ? "棚札" : sheet.paper} ${sheet.orientation === "portrait" ? "縦" : "横"} ${slots}面付け`;

  return (
    <div
      className="queue-sheet"
      role="group"
      aria-label={label}
      style={{
        aspectRatio: `${sheet.width} / ${sheet.height}`,
        gridTemplateColumns: `repeat(${sheet.columns}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${sheet.rows}, minmax(0, 1fr))`,
      }}
    >
      {Array.from({ length: slots }, (_, index) => (
        <div
          className="queue-cell"
          key={index}
          aria-label={sheet.documents[index] ? undefined : "空き枠"}
        >
          {sheet.documents[index] ? (
            <PopArtwork doc={sheet.documents[index]} />
          ) : null}
        </div>
      ))}
    </div>
  );
}
