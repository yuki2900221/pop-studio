import {
  validateDocument,
  type DocumentStorage,
  type PopDocument,
} from "./model";
import type { PrintEntry } from "./print";

export const PRINT_QUEUE_KEY = "pop-studio.print-queue.v1";
export const MAX_QUEUE_ENTRIES = 100;
export const MAX_QUEUE_COPIES = 20;
export const MAX_QUEUE_POPS = 200;
const MAX_QUEUE_JSON_LENGTH = 15_000_000;

function newId(): string {
  return typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `queue-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** A queue stores independent product snapshots, not references to saved drafts. */
export function validatePrintQueue(value: unknown): value is PrintEntry[] {
  if (!Array.isArray(value) || value.length > MAX_QUEUE_ENTRIES) return false;
  const ids = new Set<string>();
  let total = 0;
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const entry = item as Record<string, unknown>;
    if (
      typeof entry.id !== "string" ||
      !entry.id.trim() ||
      entry.id.length > 100 ||
      /[\u0000-\u001f\u007f]/.test(entry.id) ||
      ids.has(entry.id) ||
      !validateDocument(entry.doc) ||
      !entry.doc.productName.trim() ||
      entry.doc.price === "" ||
      typeof entry.copies !== "number" ||
      !Number.isInteger(entry.copies) ||
      entry.copies < 1 ||
      entry.copies > MAX_QUEUE_COPIES
    )
      return false;
    ids.add(entry.id);
    total += entry.copies;
    if (total > MAX_QUEUE_POPS) return false;
  }
  return true;
}

export function loadPrintQueue(
  storage?: Pick<DocumentStorage, "getItem">,
): PrintEntry[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(PRINT_QUEUE_KEY);
    if (!raw || raw.length > MAX_QUEUE_JSON_LENGTH) return [];
    const parsed: unknown = JSON.parse(raw);
    return validatePrintQueue(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePrintQueue(
  storage: Pick<DocumentStorage, "setItem">,
  entries: PrintEntry[],
): { ok: boolean; error?: string } {
  if (!validatePrintQueue(entries))
    return {
      ok: false,
      error:
        "印刷待ちは100商品・合計200枚まで、同じ商品の枚数は1〜20枚で指定してください。商品名と本体価格も確認してください。",
    };
  try {
    const raw = JSON.stringify(entries);
    if (raw.length > MAX_QUEUE_JSON_LENGTH)
      return {
        ok: false,
        error: "印刷待ちのデータが大きすぎます。商品画像を小さくしてください。",
      };
    storage.setItem(PRINT_QUEUE_KEY, raw);
    return { ok: true };
  } catch {
    return {
      ok: false,
      error:
        "印刷待ちを保存できませんでした。端末の保存容量とブラウザの保存設定を確認してください。",
    };
  }
}

export function makeQueueEntry(doc: PopDocument, copies = 1): PrintEntry {
  const entry = { id: newId(), doc: { ...doc }, copies };
  if (!validatePrintQueue([entry]))
    throw new Error(
      "商品名と正しい本体価格を入力し、枚数を1〜20枚で指定してください。",
    );
  return entry;
}

/** Continue data entry without carrying the previous product's facts or image. */
export function nextProductDocument(doc: PopDocument): PopDocument {
  return {
    ...doc,
    id: newId(),
    name: "新しいPOP",
    productName: "",
    origin: "",
    unit: "",
    price: "",
    memo1: "",
    memo2: "",
    image: null,
    updatedAt: new Date().toISOString(),
  };
}
