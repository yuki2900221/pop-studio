import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PopArtwork from "../components/PopArtwork";
import { validateDocument, type PopDocument } from "./model";
import { SALE_FONT_FAMILY, PRICE_FONT_FAMILY } from "./artwork-fonts";

export function escapeHtml(value: unknown): string {
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
}

export function paperDimensions(
  doc: Pick<PopDocument, "paper" | "orientation">,
): { width: number; height: number } {
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

/** Print the exact SVG component shown in the editor, without a second layout implementation. */
export function buildPrintHtml(doc: PopDocument, copies = 1): string {
  if (!validateDocument(doc) || !doc.productName.trim() || doc.price === "")
    throw new Error("商品名と本体価格を入力してください。");
  if (!Number.isInteger(copies) || copies < 1 || copies > 20)
    throw new Error("印刷枚数は1〜20枚で指定してください。");
  const { width, height } = paperDimensions(doc);
  const artwork = renderToStaticMarkup(createElement(PopArtwork, { doc }));
  const sheet = `<article class="sheet">${artwork}</article>`;
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(doc.name)} — 印刷</title><style>
    @page { size: ${width}mm ${height}mm; margin: 0; }
    * { box-sizing: border-box; }
    html, body { padding: 0; margin: 0; font-family: 'Noto Sans JP', 'Yu Gothic', Meiryo, sans-serif; }
    body { background: #e9ecea; color: #1c3028; }
    .print-controls { position: sticky; top: 0; display: flex; justify-content: center; gap: 16px; align-items: center; padding: 14px; background: #fff; font-size: 14px; z-index: 2; }
    .print-controls button { padding: 10px 24px; background: #255b46; color: white; border: 0; border-radius: 8px; cursor: pointer; font: inherit; }
    .sheet { width: ${width}mm; height: ${height}mm; overflow: hidden; margin: 8mm auto; background: #fff; print-color-adjust: exact; -webkit-print-color-adjust: exact; page-break-after: always; break-after: page; }
    .sheet:last-child { page-break-after: auto; break-after: auto; }
    .sheet > svg { display: block; width: 100%; height: 100%; }
    @media print { html, body { width: ${width}mm; background: white; } .print-controls { display: none; } .sheet { margin: 0; } }
  </style></head><body><div class="print-controls"><span id="print-status">${escapeHtml(doc.paper === "shelf" ? "棚札 148 × 52 mm" : doc.paper)}・${copies}枚・倍率100%で印刷</span><button id="print-action" type="button">印刷 / PDF保存</button></div>${Array.from({ length: copies }, () => sheet).join("")}</body></html>`;
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

export function printDocument(
  doc: PopDocument,
  copies = 1,
): { ok: boolean; error?: string } {
  let html: string;
  try {
    html = buildPrintHtml(doc, copies);
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "印刷内容を確認してください。",
    };
  }
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
      if (doc.theme === "sale") {
        // Both faces must be available before creating the physical price output.
        const loaded = await Promise.all(
          [SALE_FONT_FAMILY, PRICE_FONT_FAMILY].map((family) =>
            popup.document.fonts.load(`400 32px "${family}"`),
          ),
        );
        if (loaded.some((faces) => !faces.length)) throw new Error("font");
      } else if (doc.image) {
        // SVG <image> is absent from document.images. Decode it explicitly.
        await preloadImage(doc.image);
      }
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
