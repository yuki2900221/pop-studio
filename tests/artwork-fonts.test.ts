import { afterEach, describe, expect, it, vi } from "vitest";
import { createDocument, templates } from "../src/lib/model";
import { printDocument } from "../src/lib/print";
import { SALE_FONT_FAMILY } from "../src/lib/artwork-fonts";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("store POP print font readiness", () => {
  function popupWithFonts(fonts: unknown[]) {
    const status = { textContent: "" };
    const load = vi.fn().mockResolvedValue(fonts);
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
    const { popup, status, load } = popupWithFonts([]);
    const doc = createDocument(templates.find((t) => t.theme === "sale")!);
    expect(printDocument(doc).ok).toBe(true);
    await vi.runAllTimersAsync();
    expect(load).toHaveBeenCalledWith(`400 32px "${SALE_FONT_FAMILY}"`);
    expect(popup.print).not.toHaveBeenCalled();
    expect(status.textContent).toContain("書体または商品画像");
  });

  it("prints only after the POP font is ready and ignores an unused carried image", async () => {
    vi.useFakeTimers();
    const { popup, status } = popupWithFonts([{ family: SALE_FONT_FAMILY }]);
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
    await vi.runAllTimersAsync();
    expect(popup.focus).toHaveBeenCalledOnce();
    expect(popup.print).toHaveBeenCalledOnce();
    expect(status.textContent).toBe("");
  });
});
