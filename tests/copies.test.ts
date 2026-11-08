import { describe, expect, it } from "vitest";
import { settledCopies, typedCopies } from "../src/lib/copies";

describe("print count input", () => {
  it("applies only complete in-range whole numbers while typing", () => {
    expect(typedCopies("5")).toBe(5);
    expect(typedCopies("20")).toBe(20);
    // Clearing the field must not insert 1 and turn a typed "5" into "15".
    expect(typedCopies("")).toBeNull();
    expect(typedCopies("0")).toBeNull();
    expect(typedCopies("21")).toBeNull();
    expect(typedCopies("2.5")).toBeNull();
    expect(typedCopies("-3")).toBeNull();
    expect(typedCopies("1e1")).toBeNull();
  });

  it("settles blank, out-of-range, or fractional input on blur", () => {
    expect(settledCopies("", 4)).toBe(4);
    expect(settledCopies("  ", 4)).toBe(4);
    expect(settledCopies("abc", 4)).toBe(4);
    expect(settledCopies("0", 4)).toBe(1);
    expect(settledCopies("-2", 4)).toBe(1);
    expect(settledCopies("99", 4)).toBe(20);
    expect(settledCopies("2.7", 4)).toBe(2);
    expect(settledCopies("7", 4)).toBe(7);
  });
});
