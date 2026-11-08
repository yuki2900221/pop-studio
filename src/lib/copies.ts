export const MIN_COPIES = 1;
export const MAX_COPIES = 20;

/** A whole number already within range while the user is still typing; otherwise wait. */
export function typedCopies(raw: string): number | null {
  if (!/^\d{1,2}$/.test(raw.trim())) return null;
  const value = Number(raw);
  return value >= MIN_COPIES && value <= MAX_COPIES ? value : null;
}

/** Applied when the field loses focus: blank or invalid input keeps the previous count. */
export function settledCopies(raw: string, previous: number): number {
  const value = Number(raw.trim());
  if (!raw.trim() || !Number.isFinite(value)) return previous;
  return Math.min(MAX_COPIES, Math.max(MIN_COPIES, Math.floor(value)));
}
