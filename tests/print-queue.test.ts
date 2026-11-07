import { describe, expect, it, vi } from "vitest";
import { b5Papers, createDocument, validateDocument } from "../src/lib/model";
import {
  loadPrintQueue,
  makeQueueEntry,
  MAX_QUEUE_ENTRIES,
  MAX_QUEUE_POPS,
  nextProductDocument,
  PRINT_QUEUE_KEY,
  savePrintQueue,
  validatePrintQueue,
} from "../src/lib/print-queue";

describe("local print queue snapshots", () => {
  it("keeps each addition independent of its editable or saved product", () => {
    const doc = createDocument();
    const first = makeQueueEntry(doc, 2);
    const second = makeQueueEntry(doc);
    expect(first.id).not.toBe(second.id);
    expect(first.doc).not.toBe(doc);
    doc.price = "999";
    doc.productName = "変更後";
    expect(first.doc.price).toBe("398");
    expect(first.doc.productName).toBe("商品名称");
    expect(first.copies).toBe(2);
    expect(validatePrintQueue([first, second])).toBe(true);
  });

  it("round-trips an empty or populated queue separately from saved drafts", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    const queue = [makeQueueEntry(createDocument(), 3)];
    expect(savePrintQueue(storage, queue)).toEqual({ ok: true });
    expect(values.has(PRINT_QUEUE_KEY)).toBe(true);
    expect(loadPrintQueue(storage)).toEqual(queue);
    expect(savePrintQueue(storage, [])).toEqual({ ok: true });
    expect(loadPrintQueue(storage)).toEqual([]);
  });

  it("preserves every B5 cut size across additions, storage and continuous entry", () => {
    const entries = b5Papers.map((paper) =>
      makeQueueEntry({ ...createDocument(), paper }),
    );
    let saved = "";
    expect(
      savePrintQueue(
        {
          setItem: (_key, raw) => {
            saved = raw;
          },
        },
        entries,
      ),
    ).toEqual({ ok: true });
    const restored = loadPrintQueue({ getItem: () => saved });
    expect(restored.map((entry) => entry.doc.paper)).toEqual(b5Papers);
    for (const entry of restored)
      expect(nextProductDocument(entry.doc).paper).toBe(entry.doc.paper);
  });

  it("accepts queue and total-count boundaries and rejects exceeding them", () => {
    const entries = Array.from({ length: MAX_QUEUE_ENTRIES }, () =>
      makeQueueEntry(createDocument(), 2),
    );
    expect(entries.reduce((sum, entry) => sum + entry.copies, 0)).toBe(
      MAX_QUEUE_POPS,
    );
    expect(validatePrintQueue(entries)).toBe(true);
    expect(
      validatePrintQueue([...entries, makeQueueEntry(createDocument())]),
    ).toBe(false);
    expect(
      validatePrintQueue(
        entries.map((entry, i) => (i ? entry : { ...entry, copies: 3 })),
      ),
    ).toBe(false);
    expect(
      validatePrintQueue(
        Array.from({ length: 10 }, () => makeQueueEntry(createDocument(), 20)),
      ),
    ).toBe(true);
  });

  it.each([0, -1, 1.5, 21, NaN, Infinity, "2", null])(
    "rejects unsupported copies %s without storing a partial queue",
    (copies) => {
      const entry = makeQueueEntry(createDocument());
      const write = vi.fn();
      const bad = [{ ...entry, copies }];
      expect(validatePrintQueue(bad)).toBe(false);
      expect(
        savePrintQueue({ setItem: write }, bad as (typeof entry)[]).ok,
      ).toBe(false);
      expect(write).not.toHaveBeenCalled();
    },
  );

  it("rejects duplicate, empty, oversized or controlled entry IDs", () => {
    const entry = makeQueueEntry(createDocument());
    expect(validatePrintQueue([entry, { ...entry }])).toBe(false);
    for (const id of ["", " ", "a".repeat(101), "one\nline"])
      expect(validatePrintQueue([{ ...entry, id }])).toBe(false);
    expect(validatePrintQueue([null])).toBe(false);
    expect(validatePrintQueue([[]])).toBe(false);
  });

  it("rejects incomplete products, invalid saved documents, and invalid additions", () => {
    const entry = makeQueueEntry(createDocument());
    for (const doc of [
      { ...entry.doc, productName: " " },
      { ...entry.doc, price: "" },
      { ...entry.doc, price: "-1" },
      { ...entry.doc, image: "javascript:alert(1)" },
    ]) {
      expect(validatePrintQueue([{ ...entry, doc }])).toBe(false);
      expect(() => makeQueueEntry(doc)).toThrow("商品名と正しい本体価格");
    }
    expect(() => makeQueueEntry(entry.doc, 21)).toThrow("1〜20枚");
  });

  it("loads nothing for missing, malformed, oversized or partially invalid data", () => {
    const entry = makeQueueEntry(createDocument());
    expect(loadPrintQueue()).toEqual([]);
    for (const raw of [
      null,
      "",
      "{",
      "null",
      "{}",
      JSON.stringify([entry, { ...entry, id: "other", copies: 0 }]),
      " ".repeat(15_000_001),
    ])
      expect(loadPrintQueue({ getItem: () => raw })).toEqual([]);
    expect(
      loadPrintQueue({
        getItem: () => {
          throw new Error("denied");
        },
      }),
    ).toEqual([]);
  });

  it("reports denied or full storage without claiming successful persistence", () => {
    const result = savePrintQueue(
      {
        setItem: () => {
          throw new DOMException("quota", "QuotaExceededError");
        },
      },
      [makeQueueEntry(createDocument())],
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("印刷待ちを保存できません");
  });
});

describe("continuous product entry", () => {
  it("retains the design and print choices while clearing previous product facts", () => {
    const doc = {
      ...createDocument(),
      productName: "キャベツ",
      origin: "愛知県産",
      unit: "1玉",
      price: "198",
      memo1: "お一人様2点限り",
      memo2: "数量限定",
      image: "/images/oranges.svg",
      taxRate: 10 as const,
      taxRounding: "ceil" as const,
      fontScale: 0.9,
      showTax: false,
    };
    const next = nextProductDocument(doc);
    expect(next.id).not.toBe(doc.id);
    expect(next).toMatchObject({
      templateId: doc.templateId,
      theme: doc.theme,
      paper: doc.paper,
      orientation: doc.orientation,
      color: doc.color,
      badge: doc.badge,
      taxRate: 10,
      taxRounding: "ceil",
      fontScale: 0.9,
      showTax: false,
      name: "新しいPOP",
      productName: "",
      origin: "",
      unit: "",
      price: "",
      memo1: "",
      memo2: "",
      image: null,
    });
    expect(validateDocument(next)).toBe(true);
    expect(doc.productName).toBe("キャベツ");
    expect(doc.memo1).toBe("お一人様2点限り");
    expect(validatePrintQueue([{ ...makeQueueEntry(doc), doc: next }])).toBe(
      false,
    );
  });
});
