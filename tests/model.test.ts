import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PopArtwork from "../src/components/PopArtwork";
import {
  createDocument,
  formatPrice,
  isSafeImage,
  loadDocuments,
  saveDocuments,
  STORAGE_KEY,
  taxIncluded,
  templates,
  validateDocument,
} from "../src/lib/model";
import { buildPrintHtml, escapeHtml, paperDimensions } from "../src/lib/print";

describe("price and consumption tax", () => {
  it("uses the selected rounding rule and handles whole-yen floating point boundaries", () => {
    expect(taxIncluded("398", 8)).toBe(429);
    expect(taxIncluded("398", 8, "round")).toBe(430);
    expect(taxIncluded("398", 8, "ceil")).toBe(430);
    expect(taxIncluded("100", 10, "ceil")).toBe(110);
    expect(taxIncluded("125", 8)).toBe(135);
    expect(taxIncluded("0", 8)).toBe(0);
  });
  it.each(["", "-20", "Infinity", "abc", "1000001", "1.5"])(
    "rejects invalid and unsupported prices %s",
    (price) => {
      expect(taxIncluded(price, 8)).toBe(0);
    },
  );
  it("formats Japanese amounts consistently", () => {
    expect(formatPrice("1280")).toBe("1,280");
    expect(formatPrice(NaN)).toBe("0");
  });
});

describe("document boundaries", () => {
  it("creates a valid independent document from each provided template", () => {
    for (const template of templates)
      expect(validateDocument(createDocument(template))).toBe(true);
    expect(createDocument().id).not.toBe(createDocument().id);
  });
  it.each([
    { color: "red;display:none" },
    { price: "-1" },
    { price: "1e9" },
    { taxRate: 0 },
    { taxRate: "8" },
    { fontScale: Infinity },
    { fontScale: 8 },
    { image: "javascript:alert(1)" },
    { image: "//evil.example/pixel.png" },
    { updatedAt: "bad" },
    { productName: "a".repeat(41) },
    { origin: "a".repeat(41) },
    { unit: "a".repeat(31) },
    { badge: "a".repeat(17) },
    { fontScale: 0.6 },
    { fontScale: 1.3 },
    { price: "1000001" },
    { price: "1.5" },
    { name: "" },
    { showTax: "true" },
    { paper: "A0" },
  ])("rejects invalid imported data %j", (patch) => {
    expect(validateDocument({ ...createDocument(), ...patch })).toBe(false);
  });
  it("accepts an empty price while editing but rejects it for printing", () => {
    const doc = { ...createDocument(), price: "" };
    expect(validateDocument(doc)).toBe(true);
    expect(() => buildPrintHtml(doc)).toThrow("商品名と本体価格");
  });
  it("accepts maximum supported price and editor text boundaries", () => {
    expect(
      validateDocument({
        ...createDocument(),
        price: "1000000",
        productName: "a".repeat(40),
        origin: "a".repeat(40),
        unit: "a".repeat(30),
        badge: "a".repeat(16),
        fontScale: 1.2,
      }),
    ).toBe(true);
  });
  it("restricts image schemes, storage scope, and control characters", () => {
    expect(isSafeImage("/images/oranges.svg")).toBe(true);
    expect(isSafeImage("data:image/png;base64,YWJj")).toBe(true);
    expect(isSafeImage("https://evil.example/a.png")).toBe(false);
    expect(isSafeImage("/images/../../api/health")).toBe(false);
    expect(isSafeImage('/images/a" onerror="alert(1)')).toBe(false);
    expect(isSafeImage('data:image/svg+xml,<svg onload="alert(1)"/>')).toBe(
      false,
    );
  });
});

describe("device persistence", () => {
  it("round trips validated documents under a namespaced key", () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
    };
    const doc = createDocument();
    expect(saveDocuments(storage, [doc])).toEqual({ ok: true });
    expect(memory.has(STORAGE_KEY)).toBe(true);
    expect(loadDocuments(storage)).toEqual([doc]);
  });
  it("recovers valid records and deduplicates damaged local storage", () => {
    const doc = createDocument();
    expect(
      loadDocuments({
        getItem: () => JSON.stringify([doc, { id: "bad" }, doc]),
      }),
    ).toEqual([doc]);
    expect(loadDocuments({ getItem: () => "{bad json" })).toEqual([]);
    expect(
      loadDocuments({
        getItem: () => {
          throw new Error("denied");
        },
      }),
    ).toEqual([]);
    expect(loadDocuments()).toEqual([]);
  });
  it("reports blocked/quota storage without claiming a save succeeded", () => {
    const result = saveDocuments(
      {
        setItem: () => {
          throw new Error("quota");
        },
      },
      [createDocument()],
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("保存容量");
  });
  it("refuses more than 100 records and malformed documents before writing", () => {
    let writes = 0;
    const storage = {
      setItem: () => {
        writes++;
      },
    };
    expect(
      saveDocuments(
        storage,
        Array.from({ length: 101 }, () => createDocument()),
      ).ok,
    ).toBe(false);
    expect(
      saveDocuments(storage, [{ ...createDocument(), color: "bad" }]).ok,
    ).toBe(false);
    expect(writes).toBe(0);
  });
});

describe("physical printing and HTML isolation", () => {
  it("uses actual paper dimensions for both orientations", () => {
    expect(paperDimensions({ paper: "A4", orientation: "landscape" })).toEqual({
      width: 297,
      height: 210,
    });
    expect(paperDimensions({ paper: "A5", orientation: "portrait" })).toEqual({
      width: 148,
      height: 210,
    });
    expect(
      paperDimensions({ paper: "shelf", orientation: "landscape" }),
    ).toEqual({ width: 148, height: 52 });
    expect(
      paperDimensions({ paper: "shelf", orientation: "portrait" }),
    ).toEqual({ width: 148, height: 52 });
  });
  it("escapes product text and metadata in the generated print document", () => {
    const doc = {
      ...createDocument(),
      productName: "<img src=x onerror=alert(1)>",
      name: "</title><script>alert(1)</script>",
      origin: '"&<',
      badge: "今日's",
    };
    const html = buildPrintHtml(doc, 2);
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
    expect(html).toContain("&lt;/title&gt;");
    expect(html.match(/<article /g)).toHaveLength(2);
    expect(html).toContain("@page { size: 297mm 210mm; margin: 0; }");
    expect(html).toContain("429");
  });
  it("omits tax text when disabled", () => {
    expect(
      buildPrintHtml({ ...createDocument(), showTax: false }),
    ).not.toContain("税込 ");
    expect(buildPrintHtml(createDocument())).toContain("税込 429円");
  });
  it("prints the same SVG used by the preview for every template, paper size and orientation", () => {
    for (const template of templates) {
      for (const paper of ["A4", "A5", "shelf"] as const) {
        for (const orientation of ["landscape", "portrait"] as const) {
          const doc = { ...createDocument(template), paper, orientation };
          const svg = renderToStaticMarkup(createElement(PopArtwork, { doc }));
          const html = buildPrintHtml(doc);
          expect(html).toContain(`<article class="sheet">${svg}</article>`);
          const { width, height } = paperDimensions(doc);
          expect(html).toContain(
            `@page { size: ${width}mm ${height}mm; margin: 0; }`,
          );
          expect(html).not.toContain("onclick=");
        }
      }
    }
  });
  it.each([0, 21, 1.5, Infinity])("rejects invalid copy count %s", (copies) => {
    expect(() => buildPrintHtml(createDocument(), copies)).toThrow("1〜20");
  });
  it("escapes the full HTML-sensitive character set", () => {
    expect(escapeHtml("&<>\"'")).toBe("&amp;&lt;&gt;&quot;&#39;");
  });
});
