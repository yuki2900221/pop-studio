import { afterEach, describe, expect, it, vi } from "vitest";
import { createDocument, templates } from "../src/lib/model";
import { printBatch, printDocument } from "../src/lib/print";
import { SALE_FONT_FAMILY, PRICE_FONT_FAMILY } from "../src/lib/artwork-fonts";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("store POP print font readiness", () => {
  function popupWithFonts(fonts: (font: string) => Promise<unknown[]>) {
    const status = { textContent: "" };
    const load = vi.fn(fonts);
    const popup = {
      closed: false,
      opener: {},
      focus: vi.fn(),
      print: vi.fn(),
      document: {
        open: vi.fn(),
        write: vi.fn(),
        close: vi.fn(),
        getElementById: (id: string) =>
          id === "print-status" ? status : { addEventListener: vi.fn() },
        fonts: { load, ready: Promise.resolve() },
      },
    };
    vi.stubGlobal("window", { open: () => popup });
    return { popup, status, load };
  }

  it("does not open native printing if the store font did not load", async () => {
    vi.useFakeTimers();
    const { popup, status, load } = popupWithFonts(async () => []);
    const doc = createDocument(templates.find((t) => t.theme === "sale")!);
    expect(printDocument(doc).ok).toBe(true);
    await vi.runAllTimersAsync();
    expect(load).toHaveBeenCalledWith(`400 32px "${SALE_FONT_FAMILY}"`);
    expect(load).toHaveBeenCalledWith(`400 32px "${PRICE_FONT_FAMILY}"`);
    expect(popup.print).not.toHaveBeenCalled();
    expect(status.textContent).toContain("書体または商品画像");
  });

  it("blocks printing if only the numeric font is missing", async () => {
    vi.useFakeTimers();
    const { popup, status } = popupWithFonts(async (font) =>
      font.includes(PRICE_FONT_FAMILY) ? [] : [{ family: SALE_FONT_FAMILY }],
    );
    const doc = createDocument(templates.find((t) => t.theme === "sale")!);
    expect(printDocument(doc).ok).toBe(true);
    await vi.runAllTimersAsync();
    expect(popup.print).not.toHaveBeenCalled();
    expect(status.textContent).toContain("書体または商品画像");
  });

  it("handles a rejected numeric font request without printing a fallback", async () => {
    vi.useFakeTimers();
    const { popup, status } = popupWithFonts(async (font) => {
      if (font.includes(PRICE_FONT_FAMILY)) throw new Error("network");
      return [{ family: SALE_FONT_FAMILY }];
    });
    const doc = createDocument(templates.find((t) => t.theme === "sale")!);
    expect(printDocument(doc).ok).toBe(true);
    await vi.runAllTimersAsync();
    expect(popup.print).not.toHaveBeenCalled();
    expect(status.textContent).toContain("書体または商品画像");
  });

  it("waits for the numeric font before printing and ignores an unused carried image", async () => {
    vi.useFakeTimers();
    let finishNumeric!: (fonts: unknown[]) => void;
    const numericReady = new Promise<unknown[]>((resolve) => {
      finishNumeric = resolve;
    });
    const { popup, status } = popupWithFonts(async (font) =>
      font.includes(PRICE_FONT_FAMILY)
        ? numericReady
        : [{ family: SALE_FONT_FAMILY }],
    );
    vi.stubGlobal(
      "Image",
      class {
        constructor() {
          throw new Error("unused sale image must not be decoded");
        }
      },
    );
    const doc = {
      ...createDocument(templates.find((t) => t.theme === "sale")!),
      image: "/images/oranges.svg",
    };
    expect(printDocument(doc).ok).toBe(true);
    await vi.advanceTimersByTimeAsync(150);
    expect(popup.print).not.toHaveBeenCalled();
    finishNumeric([{ family: PRICE_FONT_FAMILY }]);
    await vi.runAllTimersAsync();
    expect(popup.focus).toHaveBeenCalledOnce();
    expect(popup.print).toHaveBeenCalledOnce();
    expect(status.textContent).toBe("");
  });

  it("waits for a later product's image even if the first item only uses POP fonts", async () => {
    vi.useFakeTimers();
    const { popup } = popupWithFonts(async () => [{}]);
    let finishImage: (() => void) | undefined;
    const requested: string[] = [];
    vi.stubGlobal(
      "Image",
      class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(value: string) {
          requested.push(value);
          finishImage = () => this.onload?.();
        }
      },
    );
    const sale = createDocument(templates[0]);
    const imageDoc = createDocument(templates[1]);
    expect(
      printBatch([
        { id: "sale", doc: sale, copies: 1 },
        { id: "image", doc: imageDoc, copies: 1 },
      ]).ok,
    ).toBe(true);
    await vi.advanceTimersByTimeAsync(150);
    expect(requested).toEqual([imageDoc.image]);
    expect(popup.print).not.toHaveBeenCalled();
    finishImage?.();
    await vi.runAllTimersAsync();
    expect(popup.print).toHaveBeenCalledOnce();
  });

  it("blocks the whole batch if a later product image fails", async () => {
    vi.useFakeTimers();
    const { popup, status } = popupWithFonts(async () => [{}]);
    vi.stubGlobal(
      "Image",
      class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_value: string) {
          this.onerror?.();
        }
      },
    );
    expect(
      printBatch([
        { id: "sale", doc: createDocument(templates[0]), copies: 1 },
        { id: "image", doc: createDocument(templates[1]), copies: 1 },
      ]).ok,
    ).toBe(true);
    await vi.runAllTimersAsync();
    expect(popup.print).not.toHaveBeenCalled();
    expect(status.textContent).toContain("書体または商品画像");
  });
});
