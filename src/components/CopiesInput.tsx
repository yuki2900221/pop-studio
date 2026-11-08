import { useState } from "react";
import {
  MAX_COPIES,
  MIN_COPIES,
  settledCopies,
  typedCopies,
} from "../lib/copies";

export interface CopiesInputProps {
  value: number;
  onChange: (copies: number) => void;
  "aria-label": string;
}

/** Lets the field be cleared while typing, then settles to 1〜20 on blur. */
export default function CopiesInput({
  value,
  onChange,
  "aria-label": label,
}: CopiesInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const settle = () => {
    if (draft === null) return;
    const next = settledCopies(draft, value);
    setDraft(null);
    if (next !== value) onChange(next);
  };
  return (
    <input
      aria-label={label}
      type="number"
      min={MIN_COPIES}
      max={MAX_COPIES}
      step={1}
      inputMode="numeric"
      value={draft ?? value}
      onChange={(event) => {
        const raw = event.target.value;
        setDraft(raw);
        const next = typedCopies(raw);
        if (next !== null && next !== value) onChange(next);
      }}
      onBlur={settle}
      onKeyDown={(event) => {
        if (event.key === "Enter") settle();
      }}
    />
  );
}
