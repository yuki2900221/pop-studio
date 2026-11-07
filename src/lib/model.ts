export type Category = "すべて" | "青果" | "精肉" | "鮮魚" | "日配" | "食品";
export type Theme =
  "market" | "minimal" | "bold" | "organic" | "fresh" | "daily" | "sale";
export type TaxRounding = "floor" | "round" | "ceil";
export type Paper = "A4" | "A5" | "shelf";

export interface Template {
  id: string;
  name: string;
  category: Category;
  theme: Theme;
  color: string;
  productName: string;
  origin: string;
  unit: string;
  price: number;
  badge: string;
  image: string | null;
  memo1?: string;
  memo2?: string;
}

export interface PopDocument {
  id: string;
  name: string;
  templateId: string;
  theme: Theme;
  color: string;
  productName: string;
  origin: string;
  unit: string;
  price: string;
  taxRate: 8 | 10;
  taxRounding: TaxRounding;
  badge: string;
  image: string | null;
  paper: Paper;
  orientation: "landscape" | "portrait";
  updatedAt: string;
  fontScale: number;
  showTax: boolean;
  memo1?: string;
  memo2?: string;
}

export const categories: Category[] = [
  "すべて",
  "青果",
  "精肉",
  "鮮魚",
  "日配",
  "食品",
];
export const STORAGE_KEY = "pop-studio.documents.v1";
export const MAX_DOCUMENTS = 100;

export const templates: Template[] = [
  {
    id: "store-sale",
    name: "特売POP（店舗書式）",
    category: "食品",
    theme: "sale",
    color: "#ff0000",
    productName: "商品名称",
    origin: "産地・メーカー",
    unit: "サイズ・容量",
    price: 398,
    badge: "お買得品",
    image: null,
    memo1: "メモ1",
    memo2: "メモ2",
  },
  {
    id: "citrus-market",
    name: "青果スタンダード",
    category: "青果",
    theme: "market",
    color: "#33765c",
    productName: "温州みかん",
    origin: "愛媛県産",
    unit: "1袋",
    price: 398,
    badge: "本日のおすすめ",
    image: "/images/oranges.svg",
  },
  {
    id: "tomato-minimal",
    name: "シンプルプライス",
    category: "青果",
    theme: "minimal",
    color: "#db543f",
    productName: "トマト",
    origin: "熊本県産",
    unit: "1パック",
    price: 298,
    badge: "青果",
    image: "/images/tomatoes.svg",
  },
  {
    id: "beef-bold",
    name: "精肉の特売",
    category: "精肉",
    theme: "bold",
    color: "#b52e3a",
    productName: "国産牛 切り落とし",
    origin: "国産",
    unit: "100gあたり",
    price: 498,
    badge: "本日のお買得",
    image: "/images/beef.svg",
  },
  {
    id: "salmon-fresh",
    name: "鮮魚スタンダード",
    category: "鮮魚",
    theme: "fresh",
    color: "#286e93",
    productName: "生サーモン",
    origin: "ノルウェー産",
    unit: "100gあたり",
    price: 398,
    badge: "鮮魚",
    image: "/images/salmon.svg",
  },
  {
    id: "apple-organic",
    name: "ナチュラル",
    category: "青果",
    theme: "organic",
    color: "#647345",
    productName: "りんご",
    origin: "青森県産",
    unit: "1袋",
    price: 498,
    badge: "青果",
    image: "/images/apples.svg",
  },
  {
    id: "milk-daily",
    name: "日配の定番",
    category: "日配",
    theme: "daily",
    color: "#4c77b1",
    productName: "成分無調整牛乳",
    origin: "北海道産",
    unit: "1本・1,000ml",
    price: 238,
    badge: "日配品",
    image: "/images/milk.svg",
  },
  {
    id: "egg-minimal",
    name: "すっきり棚札",
    category: "日配",
    theme: "minimal",
    color: "#a77339",
    productName: "たまご",
    origin: "国産",
    unit: "1パック・10個入",
    price: 258,
    badge: "日配品",
    image: "/images/eggs.svg",
  },
  {
    id: "bread-daily",
    name: "食品プライス",
    category: "食品",
    theme: "daily",
    color: "#b18454",
    productName: "食パン",
    origin: "",
    unit: "1袋・6枚入",
    price: 158,
    badge: "食品",
    image: "/images/bread.svg",
  },
  {
    id: "pork-market",
    name: "精肉シンプル",
    category: "精肉",
    theme: "market",
    color: "#a85865",
    productName: "豚ロース うす切り",
    origin: "国産",
    unit: "100gあたり",
    price: 198,
    badge: "精肉",
    image: "/images/beef.svg",
  },
  {
    id: "fish-minimal",
    name: "鮮魚プライス",
    category: "鮮魚",
    theme: "minimal",
    color: "#478194",
    productName: "銀鮭 切り身",
    origin: "チリ産",
    unit: "1切",
    price: 198,
    badge: "鮮魚",
    image: "/images/salmon.svg",
  },
];

export function createDocument(template: Template = templates[0]): PopDocument {
  return {
    id:
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `pop-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    name: `${template.productName}のPOP`,
    templateId: template.id,
    theme: template.theme,
    color: template.color,
    productName: template.productName,
    origin: template.origin,
    unit: template.unit,
    price: String(template.price),
    taxRate: 8,
    taxRounding: "floor",
    badge: template.badge,
    image: template.image,
    paper: template.id === "egg-minimal" ? "shelf" : "A4",
    orientation: "landscape",
    updatedAt: new Date().toISOString(),
    fontScale: 1,
    showTax: true,
    memo1: template.memo1 ?? "",
    memo2: template.memo2 ?? "",
  };
}

/** Consumption tax is explicitly rounded at the displayed item-price boundary. */
export function taxIncluded(
  price: string | number,
  rate: number,
  rounding: TaxRounding = "floor",
): number {
  const amount =
    typeof price === "string" && price.trim() === "" ? NaN : Number(price);
  if (
    !Number.isFinite(amount) ||
    !Number.isInteger(amount) ||
    amount < 0 ||
    amount > 1_000_000 ||
    ![8, 10].includes(rate)
  )
    return 0;
  const result = (amount * (100 + rate)) / 100;
  // Prevent binary floating-point drift at whole-yen boundaries (e.g. 100 × 1.1).
  const fixed = Math.round(result * 1_000_000) / 1_000_000;
  return Math[
    rounding in Math && ["floor", "round", "ceil"].includes(rounding)
      ? rounding
      : "floor"
  ](fixed);
}

export function formatPrice(value: number | string): string {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0
    ? amount.toLocaleString("ja-JP", { maximumFractionDigits: 2 })
    : "0";
}

function boundedString(
  value: unknown,
  max: number,
  allowEmpty = true,
): value is string {
  return (
    typeof value === "string" &&
    value.length <= max &&
    (allowEmpty || value.trim().length > 0) &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
  );
}

function optionalMemo(value: unknown): value is string | undefined {
  return (
    value === undefined ||
    (boundedString(value, 40) && !/[\u0000-\u001f\u007f]/.test(value))
  );
}

/** Uploaded raster bytes or a same-origin asset path; external and executable URLs are rejected. */
export function isSafeImage(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== "string" || value.length > 3_000_000) return false;
  if (/^data:image\/(?:png|jpeg|webp);base64,[a-zA-Z0-9+/]+=*$/.test(value))
    return true;
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\<>"'\u0000-\u0020]/.test(value)
  )
    return false;
  try {
    const parsed = new URL(value, "https://pop.invalid");
    return (
      parsed.origin === "https://pop.invalid" &&
      /^\/(?:images|assets)\//.test(parsed.pathname)
    );
  } catch {
    return false;
  }
}

/** Validates imported/device-stored data before it reaches the editor or print view. */
export function validateDocument(value: unknown): value is PopDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return (
    boundedString(v.id, 100, false) &&
    boundedString(v.name, 100, false) &&
    boundedString(v.templateId, 100, false) &&
    ["market", "minimal", "bold", "organic", "fresh", "daily", "sale"].includes(
      v.theme as string,
    ) &&
    typeof v.color === "string" &&
    /^#[0-9a-fA-F]{6}$/.test(v.color) &&
    boundedString(v.productName, 40) &&
    boundedString(v.origin, 40) &&
    boundedString(v.unit, 30) &&
    optionalMemo(v.memo1) &&
    optionalMemo(v.memo2) &&
    typeof v.price === "string" &&
    /^(?:\d{1,7})?$/.test(v.price) &&
    Number(v.price) <= 1_000_000 &&
    [8, 10].includes(v.taxRate as number) &&
    ["floor", "round", "ceil"].includes(v.taxRounding as string) &&
    boundedString(v.badge, 16) &&
    isSafeImage(v.image) &&
    ["A4", "A5", "shelf"].includes(v.paper as string) &&
    ["landscape", "portrait"].includes(v.orientation as string) &&
    typeof v.updatedAt === "string" &&
    v.updatedAt.length <= 40 &&
    Number.isFinite(Date.parse(v.updatedAt)) &&
    typeof v.fontScale === "number" &&
    Number.isFinite(v.fontScale) &&
    v.fontScale >= 0.7 &&
    v.fontScale <= 1.2 &&
    typeof v.showTax === "boolean"
  );
}

export interface DocumentStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function loadDocuments(
  storage?: Pick<DocumentStorage, "getItem">,
): PopDocument[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw || raw.length > 15_000_000) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    return parsed
      .filter(validateDocument)
      .filter((doc) => {
        if (seen.has(doc.id)) return false;
        seen.add(doc.id);
        return true;
      })
      .slice(0, MAX_DOCUMENTS);
  } catch {
    return [];
  }
}

export function saveDocuments(
  storage: Pick<DocumentStorage, "setItem">,
  documents: PopDocument[],
): { ok: boolean; error?: string } {
  if (documents.length > MAX_DOCUMENTS)
    return {
      ok: false,
      error: "保存できるPOPは100件までです。不要なPOPを削除してください。",
    };
  if (!documents.every(validateDocument))
    return { ok: false, error: "保存する内容を確認してください。" };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(documents));
    return { ok: true };
  } catch {
    return {
      ok: false,
      error:
        "端末の保存容量が不足しているか、ブラウザで保存が制限されています。画像を小さくするか、POPファイルを書き出してください。",
    };
  }
}
