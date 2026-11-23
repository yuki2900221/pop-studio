/** Names longer than this many characters are shown on two lines. */
export const SINGLE_LINE_MAX = 10;

type CharKind = "kanji" | "hiragana" | "katakana" | "alnum" | "other";

const WHITESPACE = /[\s　]/;
// Characters that must not start a line (small kana, prolonged sound mark,
// closing brackets and punctuation).
const NO_LINE_START =
  /[ぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶーｰ゛゜・、。，．,.！？!?）)」』】〕］\]〉》ゝゞヽヾ々]/;
// Characters that must not end a line (opening brackets).
const NO_LINE_END = /[（(「『【〔［[〈《]/;
// A break right after these reads naturally ("塩ラーメン・｜味噌ラーメン").
const SEPARATOR = /[・、，,／/）)」』】〕］\]〉》]/;

function kind(char: string): CharKind {
  if (/[ぁ-ゟ]/.test(char)) return "hiragana";
  if (/[゠-ヿｦ-ﾟー]/.test(char)) return "katakana";
  if (/[一-鿿々〆㐀-䶿]/.test(char)) return "kanji";
  if (/[0-9A-Za-z０-９Ａ-Ｚａ-ｚ]/.test(char)) return "alnum";
  return "other";
}

/** Cost of breaking between `before` and `after`; lower reads better. */
function boundaryCost(before: string, after: string): number {
  if (NO_LINE_START.test(after) || NO_LINE_END.test(before)) return Infinity;
  if (SEPARATOR.test(before)) return -4;
  const a = kind(before);
  const b = kind(after);
  // Kanji and hiragana alternate inside words (もも肉, 焼き), so only treat
  // changes involving katakana, digits or Latin as word boundaries.
  const mixed = (x: CharKind, y: CharKind) =>
    (x === "kanji" && y === "hiragana") || (x === "hiragana" && y === "kanji");
  if (a !== b) return mixed(a, b) ? 0 : -2; // e.g. おかめ豆腐｜ツインパック
  if (a === "katakana") return 6; // never split a katakana word
  if (a === "alnum") return 8; // keep numbers and Latin words intact
  if (a === "hiragana") return 2;
  return 1;
}

/**
 * Splits a product name for the store POP heading.
 *
 * - Up to SINGLE_LINE_MAX characters stay on one line.
 * - A space typed by staff marks the break (the one nearest the middle).
 * - Otherwise the break goes near the middle at a natural boundary: after
 *   「・」or similar separators, or where kanji/kana/katakana change, and never
 *   inside a katakana word or before small kana and 「ー」.
 */
export function splitProductName(name: string): string[] {
  const text = name.trim();
  const chars = Array.from(text);
  const visible = chars.filter((char) => !WHITESPACE.test(char)).length;
  if (visible <= SINGLE_LINE_MAX) return [text];

  const middle = chars.length / 2;
  const spaces = chars
    .map((char, index) => (WHITESPACE.test(char) ? index : -1))
    .filter((index) => index > 0 && index < chars.length - 1);
  if (spaces.length) {
    const at = spaces.reduce((best, index) =>
      Math.abs(index - middle) < Math.abs(best - middle) ? index : best,
    );
    const first = chars.slice(0, at).join("").trim();
    const second = chars
      .slice(at + 1)
      .join("")
      .trim();
    if (first && second) return [first, second];
  }

  // Keep both lines reasonably balanced: each at least a quarter of the name.
  const minLine = Math.max(2, Math.ceil(chars.length / 4));
  let best = -1;
  let bestCost = Infinity;
  for (let index = minLine; index <= chars.length - minLine; index++) {
    const cost =
      Math.abs(index - middle) + boundaryCost(chars[index - 1], chars[index]);
    if (cost < bestCost) {
      bestCost = cost;
      best = index;
    }
  }
  // No acceptable boundary (e.g. one long katakana word): fall back to the middle.
  const at = best > 0 ? best : Math.ceil(middle);
  return [chars.slice(0, at).join(""), chars.slice(at).join("")];
}
