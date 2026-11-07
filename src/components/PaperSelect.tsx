import { b5Layouts, b5Papers, isB5Paper, type Paper } from "../lib/model";

export const paperLabels: Record<Paper, string> = {
  A4: "A4",
  A5: "A5",
  shelf: "棚札",
  B5: "B5",
  "B5-half": "B5 1/2",
  "B5-quarter": "B5 1/4",
  "B5-eighth": "B5 1/8",
};

export default function PaperSelect({
  value,
  onChange,
  label = "POPサイズ",
  legacy = true,
}: {
  value: Paper;
  onChange: (paper: Paper) => void;
  label?: string;
  legacy?: boolean;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value as Paper)}
    >
      {b5Papers.map((paper) => (
        <option key={paper} value={paper}>
          {paperLabels[paper]}（
          {b5Layouts[paper].columns * b5Layouts[paper].rows}面）
        </option>
      ))}
      {legacy ? (
        <>
          <option value="A4">A4</option>
          <option value="A5">A5</option>
          <option value="shelf">棚札</option>
        </>
      ) : !isB5Paper(value) ? (
        <option value={value}>{paperLabels[value]}（以前のサイズ）</option>
      ) : null}
    </select>
  );
}
