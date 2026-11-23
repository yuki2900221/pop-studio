import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import PopArtwork from "../src/components/PopArtwork";
import {
  b5Layouts,
  b5Papers,
  createDocument,
  isB5Paper,
  loadDocuments,
  type Paper,
  validateDocument,
} from "../src/lib/model";
import {
  buildBatchPrintHtml,
  buildPrintHtml,
  buildPrintSheets,
  paperDimensions,
  printBatch,
  printedDimensions,
  PRINT_SAFE_MARGIN_MM,
  sheetGeometry,
  type PrintEntry,
} from "../src/lib/print";

afterEach(() => vi.unstubAllGlobals());

function entry(id: string, paper: Paper, copies = 1): PrintEntry {
  return {
    id,
    copies,
    doc: { ...createDocument(), paper, productName: id },
  };
}

describe("JIS B5 sizes and physical imposition", () => {
  it.each([
    ["B5", 257, 182, 257, 182, 1, 1, "landscape"],
    ["B5-half", 182, 128.5, 182, 257, 1, 2, "portrait"],
    ["B5-quarter", 128.5, 91, 257, 182, 2, 2, "landscape"],
    ["B5-eighth", 91, 64.25, 182, 257, 2, 4, "portrait"],
  ] as const)(
    "%s keeps a landscape POP and the specified B5 sheet/grid",
    (
      paper,
      width,
      height,
      sheetWidth,
      sheetHeight,
      columns,
      rows,
      orientation,
    ) => {
      const doc = entry("商品", paper).doc;
      expect(validateDocument(doc)).toBe(true);
      expect(paperDimensions(doc)).toEqual({ width, height });
      expect(b5Layouts[paper]).toMatchObject({
        width,
        height,
        sheetWidth,
        sheetHeight,
        columns,
        rows,
        orientation,
      });
      const [sheet] = buildPrintSheets([{ id: "single", doc, copies: 1 }]);
      expect(sheet).toMatchObject({
        paper,
        width: sheetWidth,
        height: sheetHeight,
        columns,
        rows,
        orientation,
      });
      expect(sheet.documents).toEqual([doc]);
    },
  );

  it("accepts all B5 variants and preserves old stored A4 documents unchanged", () => {
    expect(b5Papers.filter(isB5Paper)).toHaveLength(4);
    expect(isB5Paper("A4")).toBe(false);
    expect(isB5Paper("B5-script")).toBe(false);
    const old = entry("旧書式", "A4").doc;
    expect(loadDocuments({ getItem: () => JSON.stringify([old]) })).toEqual([
      old,
    ]);
  });

  it.each(b5Papers)("paginates %s and leaves spare cells empty", (paper) => {
    const capacity = b5Layouts[paper].columns * b5Layouts[paper].rows;
    const items = Array.from({ length: capacity + 1 }, (_, i) =>
      entry(`商品${i}`, paper),
    );
    const sheets = buildPrintSheets(items);
    expect(sheets).toHaveLength(2);
    expect(sheets.map((sheet) => sheet.documents.length)).toEqual([
      capacity,
      1,
    ]);
    expect(
      sheets.flatMap((sheet) => sheet.documents.map((doc) => doc.productName)),
    ).toEqual(items.map((item) => item.doc.productName));
    const html = buildBatchPrintHtml(items);
    expect(html.match(/<svg (?!class="cut-lines")/g)).toHaveLength(
      capacity + 1,
    );
    expect(html.match(/class="print-cell empty-cell"/g) ?? []).toHaveLength(
      capacity - 1,
    );
    expect(html).toContain(
      `@page pop1 { size: ${sheets[1].width}mm ${sheets[1].height}mm; margin: 0; }`,
    );
  });

  it("groups sizes in first-seen order, keeps product order, and expands requested copies only", () => {
    const items = [
      entry("半分1", "B5-half"),
      entry("四分1", "B5-quarter"),
      entry("半分2", "B5-half", 2),
      entry("四分2", "B5-quarter", 3),
      entry("八分1", "B5-eighth", 2),
      entry("全面", "B5"),
    ];
    const sheets = buildPrintSheets(items);
    expect(
      sheets.map((sheet) => [
        sheet.paper,
        sheet.documents.map((doc) => doc.productName),
      ]),
    ).toEqual([
      ["B5-half", ["半分1", "半分2"]],
      ["B5-half", ["半分2"]],
      ["B5-quarter", ["四分1", "四分2", "四分2", "四分2"]],
      ["B5-eighth", ["八分1", "八分1"]],
      ["B5", ["全面"]],
    ]);
    expect(sheets.reduce((sum, sheet) => sum + sheet.documents.length, 0)).toBe(
      10,
    );
  });

  it("keeps legacy portrait and landscape sizes on different physical pages", () => {
    const landscape = entry("横", "A4");
    const portrait = {
      ...entry("縦", "A4"),
      doc: { ...entry("縦", "A4").doc, orientation: "portrait" as const },
    };
    const sheets = buildPrintSheets([landscape, portrait]);
    expect(sheets.map(({ width, height }) => [width, height])).toEqual([
      [297, 210],
      [210, 297],
    ]);
  });

  it("uses the identical editor SVG for each queued product and applies no alternate print design", () => {
    const items = b5Papers.map((paper, i) => entry(`商品${i}`, paper));
    const html = buildBatchPrintHtml(items);
    for (const { doc } of items) {
      const svg = renderToStaticMarkup(createElement(PopArtwork, { doc }));
      expect(html).toContain(`${svg}</div>`);
    }
    expect(html).toContain("POP 4枚・用紙4枚");
    // Last 1/8 cell, scaled inside the 6mm printer-safe margin.
    expect(html).toContain(
      "left:91mm;top:188.514mm;width:85mm;height:60.014mm",
    );
    expect(html).not.toContain("display: grid");
    expect(html).toContain(
      ".sheet + .sheet { page-break-before: always; break-before: page; }",
    );
  });

  it("does not repeat a single small POP to fill its whole sheet", () => {
    const html = buildPrintHtml(entry("1枚だけ", "B5-eighth").doc, 1);
    expect(html.match(/<svg (?!class="cut-lines")/g)).toHaveLength(1);
    expect(html.match(/class="print-cell empty-cell"/g)).toHaveLength(7);
  });

  it("ends mixed-orientation print flow on the final named sheet without a default-page transition", () => {
    // This batch produced an unwanted sixth blank page in Chrome's native
    // print preview until the root retained the final named-page context.
    const html = buildBatchPrintHtml([
      entry("キャベツ", "B5"),
      entry("トマト", "B5-half"),
      entry("きゅうり", "B5-half"),
      entry("りんご", "B5-quarter", 4),
      entry("みかん", "B5-eighth", 9),
    ]);
    expect(html.match(/<article class="sheet"/g)).toHaveLength(5);
    expect(html).toContain("@page pop0 { size: 257mm 182mm; margin: 0; }");
    expect(html).toContain("@page pop4 { size: 182mm 257mm; margin: 0; }");
    expect(html).toContain("@media print { html, body { page: pop4;");
  });
});

describe("printer-safe margin and cutting guides", () => {
  it.each([
    ["B5", 257, 182, 1, 1, 240.1, 170],
    ["B5-half", 182, 257, 1, 2, 170, 120],
    ["B5-quarter", 257, 182, 2, 2, 120, 85],
    ["B5-eighth", 182, 257, 2, 4, 85, 60],
  ] as const)(
    "%s keeps every POP at least 6mm inside the sheet with the same aspect ratio",
    (paper, width, height, columns, rows, printedWidth, printedHeight) => {
      const geometry = sheetGeometry({ paper, width, height, columns, rows });
      const design = paperDimensions({ paper, orientation: "landscape" });
      for (const cell of geometry.cells) {
        expect(cell.left).toBeGreaterThanOrEqual(PRINT_SAFE_MARGIN_MM);
        expect(cell.top).toBeGreaterThanOrEqual(PRINT_SAFE_MARGIN_MM);
        expect(cell.left + cell.width).toBeLessThanOrEqual(
          width - PRINT_SAFE_MARGIN_MM + 0.001,
        );
        expect(cell.top + cell.height).toBeLessThanOrEqual(
          height - PRINT_SAFE_MARGIN_MM + 0.001,
        );
        // Uniform scale: the shared SVG is shrunk, never stretched.
        expect(cell.width / cell.height).toBeCloseTo(
          design.width / design.height,
          3,
        );
      }
      expect(printedDimensions({ paper, orientation: "landscape" })).toEqual({
        width: printedWidth,
        height: printedHeight,
      });
      // One guide per cell edge, each running to the paper edge.
      expect(geometry.cutLines).toHaveLength(columns + 1 + rows + 1);
      for (const line of geometry.cutLines) {
        const vertical = line.x1 === line.x2;
        expect(vertical ? [line.y1, line.y2] : [line.x1, line.x2]).toEqual([
          0,
          vertical ? height : width,
        ]);
      }
    },
  );

  it("prints dashed cutting guides above the artwork", () => {
    const html = buildPrintHtml(entry("切り取り", "B5-quarter").doc, 4);
    expect(html).toContain('<svg class="cut-lines" aria-hidden="true"');
    expect(html).toContain('stroke-dasharray="2 1.5"');
    expect(html.match(/<line /g)).toHaveLength(6);
    expect(html.indexOf('class="cut-lines"')).toBeGreaterThan(
      html.lastIndexOf('class="print-cell'),
    );
  });

  it("leaves legacy A4/A5/shelf pages full-size without guides", () => {
    for (const paper of ["A4", "A5", "shelf"] as const) {
      const geometry = sheetGeometry({
        paper,
        width: 297,
        height: 210,
        columns: 1,
        rows: 1,
      });
      expect(geometry.scale).toBe(1);
      expect(geometry.cells[0]).toEqual({
        left: 0,
        top: 0,
        width: 297,
        height: 210,
      });
      expect(geometry.cutLines).toEqual([]);
    }
    expect(buildPrintHtml(entry("旧A4", "A4").doc)).not.toContain(
      'class="cut-lines"',
    );
  });
});

describe("batch print trust boundary", () => {
  it.each([[], null, {}, [null], [{ id: "bad", copies: 1, doc: {} }]])(
    "refuses empty or malformed input before opening a popup: %j",
    (items) => {
      const open = vi.fn();
      vi.stubGlobal("window", { open });
      expect(printBatch(items as PrintEntry[]).ok).toBe(false);
      expect(open).not.toHaveBeenCalled();
    },
  );

  it("rejects a batch containing even one incomplete document", () => {
    const valid = entry("有効", "B5-half");
    expect(() =>
      buildPrintSheets([
        valid,
        { ...entry("未入力", "B5-half"), doc: { ...valid.doc, price: "" } },
      ]),
    ).toThrow("商品名と本体価格");
    expect(() =>
      buildPrintSheets([
        valid,
        {
          ...entry("未入力", "B5-half"),
          doc: { ...valid.doc, productName: " " },
        },
      ]),
    ).toThrow("商品名と本体価格");
  });

  it.each([0, -1, 1.5, 21, Infinity, "2"])(
    "rejects invalid copies %s",
    (copies) => {
      expect(() =>
        buildPrintSheets([
          { ...entry("有効", "B5"), copies: copies as number },
        ]),
      ).toThrow("1〜20");
    },
  );

  it("rejects duplicate IDs, more than 100 entries and more than 200 total POPs", () => {
    const item = entry("same", "B5");
    expect(() => buildPrintSheets([item, item])).toThrow();
    expect(() =>
      buildPrintSheets(
        Array.from({ length: 101 }, (_, i) => entry(String(i), "B5")),
      ),
    ).toThrow("1〜100");
    expect(() =>
      buildPrintSheets(
        Array.from({ length: 11 }, (_, i) => entry(String(i), "B5", 20)),
      ),
    ).toThrow("200枚");
    expect(
      buildPrintSheets(
        Array.from({ length: 10 }, (_, i) => entry(String(i), "B5-eighth", 20)),
      ),
    ).toHaveLength(25);
  });

  it("escapes every queued product's text, including later products", () => {
    const items = [
      entry("安全", "B5-quarter"),
      entry("<img src=x onerror=alert(1)>", "B5-quarter"),
    ];
    items[1].doc.memo1 = "</div><script>x</script>";
    const html = buildBatchPrintHtml(items);
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;img src=x");
    expect(html).toContain("&lt;/div&gt;&lt;script&gt;x&lt;/script&gt;");
  });
});
