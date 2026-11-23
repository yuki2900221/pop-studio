import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Vitest stubs CSS imports to "", so read the stylesheet from disk.
const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

/** Rules (selector list → declarations) inside the first block for `query`. */
function mediaRules(query: string): { selectors: string[]; body: string }[] {
  const start = css.indexOf(`@media ${query} {`);
  expect(start).toBeGreaterThan(-1);
  let depth = 0;
  let end = start;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}" && --depth === 0) {
      end = i;
      break;
    }
  }
  const block = css.slice(css.indexOf("{", start) + 1, end);
  return [...block.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selectors: match[1].split(",").map((selector: string) => selector.trim()),
    body: match[2],
  }));
}

describe("collapsed sidebar on narrow windows", () => {
  // Regression: removing an unrelated selector merged this list into the
  // .brand-mark sizing rule, so labels overflowed the 76px sidebar.
  it.each([
    ".brand > span:last-child",
    ".workspace-label",
    ".sidebar-section",
    ".nav-item > span",
    ".nav-item > small",
    ".storage-card",
    ".sidebar-footer > div",
    ".help-link",
  ])("hides %s below 980px", (selector) => {
    const rule = mediaRules("(max-width: 980px)").find((candidate) =>
      candidate.selectors.includes(selector),
    );
    expect(rule?.body).toMatch(/display:\s*none/);
  });

  it("keeps the logo mark visible at a fixed size", () => {
    const rule = mediaRules("(max-width: 980px)").find((candidate) =>
      candidate.selectors.includes(".brand-mark"),
    );
    expect(rule?.selectors).toEqual([".brand-mark"]);
    expect(rule?.body).not.toMatch(/display:\s*none/);
  });
});
