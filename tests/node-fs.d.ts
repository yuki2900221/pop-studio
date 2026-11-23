// Minimal typing for the one Node API the CSS layout test uses; the project
// intentionally has no @types/node dependency.
declare module "node:fs" {
  export function readFileSync(path: URL | string, encoding: "utf8"): string;
}
