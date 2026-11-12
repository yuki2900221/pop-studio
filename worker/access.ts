/**
 * Verifies the Cloudflare Access JWT (`Cf-Access-Jwt-Assertion`).
 *
 * Workers with Static Assets run behind Cloudflare's asset router, which does
 * not forward `ctx.access`, so the signed assertion header is the reliable
 * proof that a request passed Access. Uses WebCrypto only (no dependencies).
 */

export interface AccessConfig {
  /** e.g. https://<team>.cloudflareaccess.com */
  teamDomain: string;
  /** Access application AUD tag. */
  aud: string;
}

interface Jwk {
  kid?: string;
  kty?: string;
  alg?: string;
  n?: string;
  e?: string;
}

type FetchLike = (url: string) => Promise<Response>;

const KEY_TTL_MS = 60 * 60 * 1000;
const CLOCK_SKEW_S = 60;
let keyCache: { url: string; at: number; keys: Map<string, CryptoKey> } | null =
  null;

/** Test hook: forget cached signing keys. */
export function resetAccessKeyCache(): void {
  keyCache = null;
}

function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) throw new Error("base64url");
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeJson(segment: string): Record<string, unknown> {
  const value: unknown = JSON.parse(
    new TextDecoder().decode(base64UrlDecode(segment)),
  );
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("json");
  return value as Record<string, unknown>;
}

async function loadKeys(
  certsUrl: string,
  fetchImpl: FetchLike,
  force: boolean,
): Promise<Map<string, CryptoKey>> {
  if (
    !force &&
    keyCache &&
    keyCache.url === certsUrl &&
    Date.now() - keyCache.at < KEY_TTL_MS
  )
    return keyCache.keys;
  const response = await fetchImpl(certsUrl);
  if (!response.ok) throw new Error("certs");
  const body = (await response.json()) as { keys?: Jwk[] };
  const keys = new Map<string, CryptoKey>();
  for (const jwk of body.keys ?? []) {
    if (jwk.kty !== "RSA" || !jwk.kid || !jwk.n || !jwk.e) continue;
    keys.set(
      jwk.kid,
      await crypto.subtle.importKey(
        "jwk",
        { kty: "RSA", n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["verify"],
      ),
    );
  }
  keyCache = { url: certsUrl, at: Date.now(), keys };
  return keys;
}

/** Returns the verified email (or subject), or null when the token must be rejected. */
export async function verifyAccessJwt(
  token: string | null,
  config: AccessConfig,
  fetchImpl: FetchLike = (url) => fetch(url),
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<string | null> {
  if (!token || token.length > 8192 || !config.teamDomain || !config.aud)
    return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const header = decodeJson(parts[0]);
    const payload = decodeJson(parts[1]);
    if (header.alg !== "RS256" || typeof header.kid !== "string") return null;

    const issuer = config.teamDomain.replace(/\/+$/, "");
    if (payload.iss !== issuer) return null;
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audiences.includes(config.aud)) return null;
    if (
      typeof payload.exp !== "number" ||
      payload.exp < nowSeconds - CLOCK_SKEW_S
    )
      return null;
    if (
      typeof payload.nbf === "number" &&
      payload.nbf > nowSeconds + CLOCK_SKEW_S
    )
      return null;

    const certsUrl = `${issuer}/cdn-cgi/access/certs`;
    let keys = await loadKeys(certsUrl, fetchImpl, false);
    // Access rotates signing keys; refresh once when the kid is unknown.
    if (!keys.has(header.kid)) keys = await loadKeys(certsUrl, fetchImpl, true);
    const key = keys.get(header.kid);
    if (!key) return null;

    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      base64UrlDecode(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
    if (!valid) return null;
    const identity =
      typeof payload.email === "string"
        ? payload.email
        : typeof payload.sub === "string"
          ? payload.sub
          : "";
    return identity || null;
  } catch {
    return null;
  }
}
