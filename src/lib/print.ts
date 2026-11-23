import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PopArtwork from "../components/PopArtwork";
import {
  b5Layouts,
  isB5Paper,
  validateDocument,
  type Paper,
  type PopDocument,
} from "./model";
import { SALE_FONT_FAMILY, PRICE_FONT_FAMILY } from "./artwork-fonts";

export interface PrintEntry {
  id: string;
  doc: PopDocument;
  copies: number;
}

export interface PrintSheet {
  paper: Paper;
  orientation: "landscape" | "portrait";
  width: number;
  height: number;
  columns: number;
  rows: number;
  /** Occupied cells in reading order. Unused cells remain blank. */
  documents: PopDocument[];
}

export function escapeHtml(value: unknown): string {
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
}

/** Dimensions of one finished POP, rather than the physical printing sheet. */
export function paperDimensions(
  doc: Pick<PopDocument, "paper" | "orientation">,
): { width: number; height: number } {
  if (isB5Paper(doc.paper)) {
    const { width, height } = b5Layouts[doc.paper];
    return { width, height };
  }
  const sizes = {
    A4: { width: 297, height: 210 },
    A5: { width: 210, height: 148 },
    shelf: { width: 148, height: 52 },
  };
  const size = sizes[doc.paper];
  return doc.orientation === "portrait" && doc.paper !== "shelf"
    ? { width: size.height, height: size.width }
    : size;
}

function sheetLayout(doc: PopDocument): Omit<PrintSheet, "documents"> {
  if (isB5Paper(doc.paper)) {
    const { sheetWidth, sheetHeight, columns, rows, orientation } =
      b5Layouts[doc.paper];
    return {
      paper: doc.paper,
      orientation,
      width: sheetWidth,
      height: sheetHeight,
      columns,
      rows,
    };
  }
  return {
    paper: doc.paper,
    orientation: doc.paper === "shelf" ? "landscape" : doc.orientation,
    ...paperDimensions(doc),
    columns: 1,
    rows: 1,
  };
}

/** Group matching sizes, then fill sheets without duplicating a product into spare cells. */
export function buildPrintSheets(entries: readonly PrintEntry[]): PrintSheet[] {
  if (!Array.isArray(entries) || !entries.length || entries.length > 100)
    throw new Error("印刷待ちは1〜100件で指定してください。");
  let total = 0;
  const ids = new Set<string>();
  for (const entry of entries) {
    if (
      !entry ||
      typeof entry !== "object" ||
      typeof entry.id !== "string" ||
      !entry.id.trim() ||
      entry.id.length > 100 ||
      /[\u0000-\u001f\u007f]/.test(entry.id) ||
      ids.has(entry.id) ||
      !validateDocument(entry.doc) ||
      !entry.doc.productName.trim() ||
      entry.doc.price === ""
    )
      throw new Error(
        "商品名と本体価格を入力してください。印刷待ちの内容も確認してください。",
      );
    if (
      !Number.isInteger(entry.copies) ||
      entry.copies < 1 ||
      entry.copies > 20
    )
      throw new Error("印刷枚数は1〜20枚で指定してください。");
    ids.add(entry.id);
    total += entry.copies;
  }
  if (total > 200) throw new Error("一度に印刷できるPOPは200枚までです。");

  const groups = new Map<
    string,
    { layout: Omit<PrintSheet, "documents">; documents: PopDocument[] }
  >();
  for (const entry of entries) {
    const layout = sheetLayout(entry.doc);
    const key = `${layout.paper}:${layout.orientation}`;
    let group = groups.get(key);
    if (!group) {
      group = { layout, documents: [] };
      groups.set(key, group);
    }
    for (let copy = 0; copy < entry.copies; copy++)
      group.documents.push(entry.doc);
  }
  const sheets: PrintSheet[] = [];
  for (const { layout, documents } of groups.values()) {
    const capacity = layout.columns * layout.rows;
    for (let start = 0; start < documents.length; start += capacity)
      sheets.push({
        ...layout,
        documents: documents.slice(start, start + capacity),
      });
  }
  return sheets;
}

/**
 * Printers cannot print the outer few millimetres of a sheet, which clipped
 * prices and tax lines at the right and bottom edges of B5 sheets. B5
 * impositions are uniformly scaled to stay inside this band.
 */
export const PRINT_SAFE_MARGIN_MM = 6;

export interface CellRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface CutLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface SheetGeometry {
  /** Uniform scale applied to every POP (1 = full size, no margin). */
  scale: number;
  cells: CellRect[];
  /** Dashed cutting guides along every cell edge, running to the sheet edge. */
  cutLines: CutLine[];
}

const roundMm = (value: number) => Math.round(value * 1000) / 1000;

/** Shared by the print HTML and the on-screen preview so both match exactly. */
export function sheetGeometry(
  sheet: Pick<PrintSheet, "paper" | "width" | "height" | "columns" | "rows">,
): SheetGeometry {
  const { width, height, columns, rows } = sheet;
  // Legacy A4/A5/shelf pages keep their original full-page placement.
  const margin = isB5Paper(sheet.paper) ? PRINT_SAFE_MARGIN_MM : 0;
  const scale = Math.min(
    (width - 2 * margin) / width,
    (height - 2 * margin) / height,
  );
  const cellWidth = (width / columns) * scale;
  const cellHeight = (height / rows) * scale;
  const left = (width - cellWidth * columns) / 2;
  const top = (height - cellHeight * rows) / 2;
  const cells = Array.from({ length: columns * rows }, (_, slot) => ({
    left: roundMm(left + (slot % columns) * cellWidth),
    top: roundMm(top + Math.floor(slot / columns) * cellHeight),
    width: roundMm(cellWidth),
    height: roundMm(cellHeight),
  }));
  const cutLines: CutLine[] = margin
    ? [
        ...Array.from({ length: columns + 1 }, (_, i) => {
          const x = roundMm(left + i * cellWidth);
          return { x1: x, y1: 0, x2: x, y2: height };
        }),
        ...Array.from({ length: rows + 1 }, (_, j) => {
          const y = roundMm(top + j * cellHeight);
          return { x1: 0, y1: y, x2: width, y2: y };
        }),
      ]
    : [];
  return { scale, cells, cutLines };
}

/** Finished size of a POP after cutting, including the safe-margin scale. */
export function printedDimensions(
  doc: Pick<PopDocument, "paper" | "orientation">,
): { width: number; height: number } {
  const size = paperDimensions(doc);
  if (!isB5Paper(doc.paper)) return size;
  const { scale } = sheetGeometry({
    paper: doc.paper,
    width: b5Layouts[doc.paper].sheetWidth,
    height: b5Layouts[doc.paper].sheetHeight,
    columns: b5Layouts[doc.paper].columns,
    rows: b5Layouts[doc.paper].rows,
  });
  return {
    width: Math.round(size.width * scale * 10) / 10,
    height: Math.round(size.height * scale * 10) / 10,
  };
}

/** Light dashed guides drawn above the artwork; shared markup for print. */
export function cutLinesSvg(
  sheet: Pick<PrintSheet, "width" | "height">,
  lines: readonly CutLine[],
): string {
  if (!lines.length) return "";
  const paths = lines
    .map(
      (line) =>
        `<line x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}"/>`,
    )
    .join("");
  return `<svg class="cut-lines" aria-hidden="true" viewBox="0 0 ${sheet.width} ${sheet.height}" preserveAspectRatio="none"><g stroke="#8a9096" stroke-width="0.2" stroke-dasharray="2 1.5" fill="none">${paths}</g></svg>`;
}

/** Print the editor's exact SVG in each physical cell, including partially filled sheets. */
export function buildBatchPrintHtml(entries: readonly PrintEntry[]): string {
  const sheets = buildPrintSheets(entries);
  const first = sheets[0];
  const total = entries.reduce((sum, entry) => sum + entry.copies, 0);
  const title = entries.length === 1 ? entries[0].doc.name : "POPまとめて印刷";
  const pageRules = sheets
    .map(
      (sheet, index) =>
        `@page pop${index} { size: ${sheet.width}mm ${sheet.height}mm; margin: 0; }`,
    )
    .join("\n");
  const pages = sheets
    .map((sheet, index) => {
      // Position each cell in exact millimetres outside the pagination flow,
      // inside the printer-safe margin, with cutting guides on top.
      const geometry = sheetGeometry(sheet);
      const cells = geometry.cells
        .map((cell, slot) => {
          const doc = sheet.documents[slot];
          const artwork = doc
            ? renderToStaticMarkup(createElement(PopArtwork, { doc }))
            : "";
          return `<div class="print-cell${doc ? "" : " empty-cell"}" style="left:${cell.left}mm;top:${cell.top}mm;width:${cell.width}mm;height:${cell.height}mm">${artwork}</div>`;
        })
        .join("");
      return `<article class="sheet" data-paper="${sheet.paper}" style="page:pop${index};width:${sheet.width}mm;height:${sheet.height}mm">${cells}${cutLinesSvg(sheet, geometry.cutLines)}</article>`;
    })
    .join("");
  // Keep the root in the last named page: Chromium otherwise emits a trailing
  // default-size blank page when a job mixes page orientations.
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} — 印刷</title><style>
    @page { size: ${first.width}mm ${first.height}mm; margin: 0; }
    ${pageRules}
    * { box-sizing: border-box; }
    html, body { padding: 0; margin: 0; font-family: 'Noto Sans JP', 'Yu Gothic', Meiryo, sans-serif; }
    body { background: #e9ecea; color: #1c3028; }
    .print-controls { position: sticky; top: 0; display: flex; justify-content: center; gap: 16px; align-items: center; padding: 14px; background: #fff; font-size: 14px; z-index: 2; }
    .print-controls button { padding: 10px 24px; background: #255b46; color: white; border: 0; border-radius: 8px; cursor: pointer; font: inherit; }
    .sheet { position: relative; overflow: hidden; margin: 8mm auto; background: #fff; print-color-adjust: exact; -webkit-print-color-adjust: exact; page-break-inside: avoid; break-inside: avoid-page; }
    .sheet + .sheet { page-break-before: always; break-before: page; }
    .print-cell { position: absolute; overflow: hidden; }
    .print-cell > svg { display: block; width: 100%; height: 100%; }
    .cut-lines { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
    @media print { html, body { page: pop${sheets.length - 1}; background: white; } .print-controls { display: none; } .sheet { margin: 0; } }
  </style></head><body><div class="print-controls"><span id="print-status">POP ${total}枚・用紙${sheets.length}枚・倍率100%で印刷</span><button id="print-action" type="button">印刷 / PDF保存</button></div>${pages}</body></html>`;
}

export function buildPrintHtml(doc: PopDocument, copies = 1): string {
  return buildBatchPrintHtml([{ id: "single", doc, copies }]);
}

function preloadImage(source: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("timeout"));
    }, 10_000);
    const cleanup = () => {
      clearTimeout(timeout);
      img.onload = null;
      img.onerror = null;
    };
    img.onload = () => {
      cleanup();
      resolve();
    };
    img.onerror = () => {
      cleanup();
      reject(new Error("image"));
    };
    img.src = source;
  });
}

export function printBatch(entries: readonly PrintEntry[]): {
  ok: boolean;
  error?: string;
} {
  let html: string;
  try {
    html = buildBatchPrintHtml(entries);
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "印刷内容を確認してください。",
    };
  }
  const documents = entries.map((entry) => ({ ...entry.doc }));
  const popup = window.open("", "_blank");
  if (!popup)
    return {
      ok: false,
      error:
        "印刷画面を開けませんでした。ブラウザのポップアップを許可してください。",
    };
  popup.opener = null;
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  let preparing = false;
  const doPrint = async () => {
    if (popup.closed || preparing) return;
    preparing = true;
    const status = popup.document.getElementById("print-status");
    try {
      const images = new Set(
        documents.flatMap((doc) =>
          doc.theme !== "sale" && doc.image ? [doc.image] : [],
        ),
      );
      const fontsReady = async () => {
        if (!documents.some((doc) => doc.theme === "sale")) return;
        // Both faces must be available before creating the physical price output.
        const loaded = await Promise.all(
          [SALE_FONT_FAMILY, PRICE_FONT_FAMILY].map((family) =>
            popup.document.fonts.load(`400 32px "${family}"`),
          ),
        );
        if (loaded.some((faces) => !faces.length)) throw new Error("font");
      };
      // Every item must be ready; a later item's missing image must not print silently.
      await Promise.all([fontsReady(), ...Array.from(images, preloadImage)]);
      await popup.document.fonts.ready;
      if (!popup.closed) {
        popup.focus();
        popup.print();
      }
    } catch {
      if (status && !popup.closed)
        status.textContent =
          "書体または商品画像を読み込めませんでした。接続と画像を確認して再度お試しください。";
    } finally {
      preparing = false;
    }
  };
  popup.document
    .getElementById("print-action")
    ?.addEventListener("click", () => {
      void doPrint();
    });
  setTimeout(() => {
    void doPrint();
  }, 150);
  return { ok: true };
}

export function printDocument(
  doc: PopDocument,
  copies = 1,
): { ok: boolean; error?: string } {
  return printBatch([{ id: "single", doc, copies }]);
}
