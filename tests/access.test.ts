import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import worker, { type Env } from "../worker/index";
import { resetAccessKeyCache, verifyAccessJwt } from "../worker/access";

const TEAM = "https://team.cloudflareaccess.com";
const AUD = "test-aud";
const NOW = 1_800_000_000;

let signingKey: CryptoKey;
let otherKey: CryptoKey;
let publicJwk: JsonWebKey;

const base64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const encode = (value: unknown) =>
  base64Url(new TextEncoder().encode(JSON.stringify(value)));

async function token(
  payload: Record<string, unknown> = {},
  header: Record<string, unknown> = {},
  key: CryptoKey = signingKey,
): Promise<string> {
  const head = encode({ alg: "RS256", kid: "k1", ...header });
  const body = encode({
    iss: TEAM,
    aud: [AUD],
    email: "staff@example.com",
    exp: NOW + 600,
    nbf: NOW - 10,
    ...payload,
  });
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(`${head}.${body}`),
  );
  return `${head}.${body}.${base64Url(new Uint8Array(signature))}`;
}

function certsFetch() {
  return vi.fn(async (url: string) => {
    expect(url).toBe(`${TEAM}/cdn-cgi/access/certs`);
    return Response.json({ keys: [{ ...publicJwk, kid: "k1" }] });
  });
}

beforeAll(async () => {
  const algorithm = {
    name: "RSASSA-PKCS1-v1_5",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: "SHA-256",
  };
  const pair = (await crypto.subtle.generateKey(algorithm, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  signingKey = pair.privateKey;
  publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  otherKey = (
    (await crypto.subtle.generateKey(algorithm, true, [
      "sign",
      "verify",
    ])) as CryptoKeyPair
  ).privateKey;
});

afterEach(() => {
  resetAccessKeyCache();
  vi.unstubAllGlobals();
});

describe("Cloudflare Access JWT verification", () => {
  const config = { teamDomain: TEAM, aud: AUD };

  it("accepts a correctly signed token for this application", async () => {
    expect(
      await verifyAccessJwt(await token(), config, certsFetch(), NOW),
    ).toBe("staff@example.com");
  });

  it.each([
    ["missing token", async () => null],
    ["another application", async () => token({ aud: ["other"] })],
    ["another team", async () => token({ iss: "https://evil.example" })],
    ["expired", async () => token({ exp: NOW - 3600 })],
    ["not yet valid", async () => token({ nbf: NOW + 3600 })],
    ["unsigned alg", async () => token({}, { alg: "none" })],
    ["unknown key", async () => token({}, { kid: "k2" })],
    ["forged signature", async () => token({}, {}, otherKey)],
    ["malformed", async () => "a.b"],
  ])("rejects %s", async (_label, make) => {
    expect(await verifyAccessJwt(await make(), config, certsFetch(), NOW)).toBe(
      null,
    );
  });

  it("rejects everything when the Access settings are missing", async () => {
    const fetchImpl = certsFetch();
    expect(
      await verifyAccessJwt(
        await token(),
        { teamDomain: "", aud: "" },
        fetchImpl,
        NOW,
      ),
    ).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("caches signing keys between requests", async () => {
    const fetchImpl = certsFetch();
    await verifyAccessJwt(await token(), config, fetchImpl, NOW);
    await verifyAccessJwt(await token(), config, fetchImpl, NOW);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("fails closed when the key endpoint is unavailable", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 503 }));
    expect(await verifyAccessJwt(await token(), config, fetchImpl, NOW)).toBe(
      null,
    );
  });
});

describe("API protection behind Access", () => {
  function env(): Env {
    return {
      ASSETS: { fetch: vi.fn(async () => new Response("asset")) },
      AI: { run: vi.fn() },
      AI_RATE_LIMITER: { limit: vi.fn(async () => ({ success: true })) },
      ACCESS_REQUIRED: "true",
      ACCESS_TEAM_DOMAIN: TEAM,
      ACCESS_AUD: AUD,
    };
  }

  it("rejects API requests without a valid Access assertion", async () => {
    vi.stubGlobal("fetch", certsFetch());
    const e = env();
    const response = await worker.fetch(
      new Request("https://pop.example/api/ai/assist", { method: "POST" }),
      e,
    );
    expect(response.status).toBe(401);
    expect(e.AI!.run).not.toHaveBeenCalled();
    expect(e.AI_RATE_LIMITER!.limit).not.toHaveBeenCalled();
  });

  it("serves API requests that carry a valid Access assertion", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW * 1000);
    vi.stubGlobal("fetch", certsFetch());
    const response = await worker.fetch(
      new Request("https://pop.example/api/health", {
        headers: { "Cf-Access-Jwt-Assertion": await token() },
      }),
      env(),
    );
    vi.useRealTimers();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", ai: true });
  });

  it("does not check static assets, which Access protects directly", async () => {
    const e = env();
    const response = await worker.fetch(new Request("https://pop.example/"), e);
    expect(await response.text()).toBe("asset");
  });

  it("leaves the check off when ACCESS_REQUIRED is not set (local dev)", async () => {
    const response = await worker.fetch(
      new Request("https://pop.example/api/health"),
      { ...env(), ACCESS_REQUIRED: undefined },
    );
    expect(response.status).toBe(200);
  });
});
