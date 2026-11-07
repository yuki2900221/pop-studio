import { afterEach, describe, expect, it, vi } from "vitest";
import worker, {
  AI_MODEL,
  isGrounded,
  parseExtraction,
  type Env,
} from "../worker/index";

const validResult = {
  productName: "りんご",
  origin: "青森県産",
  unit: "1袋",
  price: 398,
};
function environment(): Env {
  return {
    ASSETS: {
      fetch: vi.fn(
        async () =>
          new Response('<html lang="ja">POP</html>', {
            headers: { "Content-Type": "text/html" },
          }),
      ),
    },
    AI: {
      run: vi.fn(async () => ({
        choices: [{ message: { content: JSON.stringify(validResult) } }],
      })),
    },
    AI_RATE_LIMITER: { limit: vi.fn(async () => ({ success: true })) },
  };
}
function request(
  body: unknown = { task: "extract", text: "青森県産 りんご 1袋 398円" },
  init: RequestInit = {},
): Request {
  return new Request("https://pop.example/api/ai/assist", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      Origin: "https://pop.example",
      "Content-Type": "application/json",
      "CF-Connecting-IP": "192.0.2.10",
    },
    ...init,
  });
}
afterEach(() => vi.useRealTimers());

describe("API routing and response protection", () => {
  it("reports actual AI binding availability without caching", async () => {
    const env = environment();
    const response = await worker.fetch(
      new Request("https://pop.example/api/health"),
      env,
    );
    expect(await response.json()).toEqual({ status: "ok", ai: true });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    delete env.AI_RATE_LIMITER;
    expect(
      await (
        await worker.fetch(new Request("https://pop.example/api/health"), env)
      ).json(),
    ).toEqual({ status: "ok", ai: false });
  });
  it("restricts health endpoint to GET", async () => {
    const response = await worker.fetch(
      new Request("https://pop.example/api/health", { method: "POST" }),
      environment(),
    );
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET");
  });
  it("does not send unknown API paths to the SPA", async () => {
    expect(
      (
        await worker.fetch(
          new Request("https://pop.example/api/missing"),
          environment(),
        )
      ).status,
    ).toBe(404);
  });
  it("preserves assets and applies security headers", async () => {
    const response = await worker.fetch(
      new Request("https://pop.example/"),
      environment(),
    );
    expect(await response.text()).toContain("POP");
    expect(response.headers.get("Content-Type")).toBe("text/html");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "frame-ancestors 'none'",
    );
    expect(response.headers.get("Permissions-Policy")).toContain("camera=()");
  });
});

describe("AI input and abuse controls", () => {
  it("uses the bound model with user data separated from instructions", async () => {
    const env = environment();
    const response = await worker.fetch(request(), env);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(validResult);
    expect(env.AI?.run).toHaveBeenCalledWith(
      AI_MODEL,
      expect.objectContaining({
        max_completion_tokens: 350,
        stream: false,
        chat_template_kwargs: { enable_thinking: false },
        response_format: { type: "json_object" },
      }),
    );
    expect(env.AI_RATE_LIMITER?.limit).toHaveBeenCalledWith({
      key: "192.0.2.10",
    });
    expect(response.headers.get("Content-Security-Policy")).toBeTruthy();
  });
  it("rejects GET without calling the model", async () => {
    const env = environment();
    const response = await worker.fetch(
      new Request("https://pop.example/api/ai/assist"),
      env,
    );
    expect(response.status).toBe(405);
    expect(env.AI?.run).not.toHaveBeenCalled();
  });
  it.each([undefined, "https://untrusted.example", "null"])(
    "rejects foreign or absent Origin (%s)",
    async (origin) => {
      const env = environment();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (origin) headers.Origin = origin;
      expect(
        (await worker.fetch(request(undefined, { headers }), env)).status,
      ).toBe(403);
      expect(env.AI?.run).not.toHaveBeenCalled();
    },
  );
  it("rejects cross-site requests even with a matching Origin header", async () => {
    expect(
      (
        await worker.fetch(
          request(undefined, {
            headers: {
              Origin: "https://pop.example",
              "Content-Type": "application/json",
              "Sec-Fetch-Site": "cross-site",
            },
          }),
          environment(),
        )
      ).status,
    ).toBe(403);
  });
  it("requires application/json", async () => {
    expect(
      (
        await worker.fetch(
          request(undefined, {
            headers: {
              Origin: "https://pop.example",
              "Content-Type": "text/plain",
            },
          }),
          environment(),
        )
      ).status,
    ).toBe(415);
  });
  it.each([
    null,
    [],
    {},
    { task: "description", text: "りんご" },
    { task: "extract", text: "" },
    { task: "extract", text: "  " },
    { task: "extract", text: 1 },
    { task: "extract", text: "あ".repeat(1001) },
    { task: "extract", text: "りんご", extra: true },
    { task: "extract", text: "\u0000" },
  ])("rejects invalid input (%j)", async (body) => {
    const env = environment();
    expect((await worker.fetch(request(body), env)).status).toBe(400);
    expect(env.AI?.run).not.toHaveBeenCalled();
  });
  it("rejects malformed JSON", async () => {
    expect(
      (
        await worker.fetch(
          request(undefined, { body: "{bad json" }),
          environment(),
        )
      ).status,
    ).toBe(400);
  });
  it("limits streamed request bytes even without a Content-Length", async () => {
    expect(
      (
        await worker.fetch(
          request(undefined, { body: "a".repeat(8193) }),
          environment(),
        )
      ).status,
    ).toBe(413);
  });
  it("rejects oversized declared bodies before parsing", async () => {
    expect(
      (
        await worker.fetch(
          request(undefined, {
            headers: {
              Origin: "https://pop.example",
              "Content-Type": "application/json",
              "Content-Length": "9000",
            },
          }),
          environment(),
        )
      ).status,
    ).toBe(413);
  });
  it.each(["AI", "AI_RATE_LIMITER"] as const)(
    "fails closed without %s",
    async (binding) => {
      const env = environment();
      delete env[binding];
      expect((await worker.fetch(request(), env)).status).toBe(503);
    },
  );
  it("returns 429 without calling AI after rate limit exhaustion", async () => {
    const env = environment();
    env.AI_RATE_LIMITER!.limit = vi.fn(async () => ({ success: false }));
    const response = await worker.fetch(request(), env);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(env.AI?.run).not.toHaveBeenCalled();
  });
  it("fails closed when the limiter fails", async () => {
    const env = environment();
    env.AI_RATE_LIMITER!.limit = vi.fn(async () => {
      throw new Error("internal details");
    });
    const response = await worker.fetch(request(), env);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("internal details");
    expect(env.AI?.run).not.toHaveBeenCalled();
  });
  it("uses a shared rate bucket if the client address is absent", async () => {
    const env = environment();
    await worker.fetch(
      request(undefined, {
        headers: {
          Origin: "https://pop.example",
          "Content-Type": "application/json",
        },
      }),
      env,
    );
    expect(env.AI_RATE_LIMITER?.limit).toHaveBeenCalledWith({
      key: "shared-unknown-client",
    });
  });
  it("does not leak provider failures or return fake extracted values", async () => {
    const env = environment();
    env.AI!.run = vi.fn(async () => {
      throw new Error("sensitive provider details");
    });
    const response = await worker.fetch(request(), env);
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("sensitive provider details");
  });
  it("ends a stalled model request", async () => {
    vi.useFakeTimers();
    const env = environment();
    env.AI!.run = vi.fn(() => new Promise(() => {}));
    const pending = worker.fetch(request(), env);
    await vi.advanceTimersByTimeAsync(20_001);
    expect((await pending).status).toBe(502);
  });
  it("rejects malformed model output", async () => {
    const env = environment();
    env.AI!.run = vi.fn(async () => ({
      choices: [{ message: { content: "not JSON" } }],
    }));
    expect((await worker.fetch(request(), env)).status).toBe(502);
  });
  it("rejects model-invented values absent from the input", async () => {
    const env = environment();
    expect(
      (
        await worker.fetch(
          request({ task: "extract", text: "りんご 1袋" }),
          env,
        )
      ).status,
    ).toBe(502);
  });
});

describe("model output validation", () => {
  const output = (value: unknown) => ({
    choices: [{ message: { content: JSON.stringify(value) } }],
  });
  it("preserves missing information as null", () => {
    const allNull = {
      productName: null,
      origin: null,
      unit: null,
      price: null,
    };
    expect(parseExtraction(output(allNull))).toEqual(allNull);
  });
  it("supports model JSON fenced output and trims fields", () => {
    expect(
      parseExtraction({
        response:
          "```json\n" +
          JSON.stringify({ ...validResult, productName: " りんご " }) +
          "\n```",
      }),
    ).toEqual(validResult);
  });
  it.each([
    {},
    { ...validResult, extra: true },
    { ...validResult, price: -1 },
    { ...validResult, price: 1.5 },
    { ...validResult, price: 1_000_001 },
    { ...validResult, price: "398" },
    { ...validResult, origin: 123 },
    { ...validResult, unit: "" },
    { ...validResult, productName: "あ".repeat(41) },
    { ...validResult, origin: "青森\n県" },
  ])("rejects unexpected or invalid fields (%j)", (value) => {
    expect(parseExtraction(output(value))).toBeNull();
  });
  it.each([
    null,
    [],
    {},
    { choices: [] },
    { choices: [{ message: { content: "x".repeat(3001) } }] },
  ])("handles untrusted provider envelopes (%j)", (value) => {
    expect(parseExtraction(value)).toBeNull();
  });
  it.each([
    ["productName", 40],
    ["origin", 40],
    ["unit", 30],
  ] as const)("accepts document-model boundary for %s", (field, max) => {
    const value = { ...validResult, [field]: "あ".repeat(max) };
    expect(parseExtraction(output(value))).toEqual(value);
    expect(
      parseExtraction(output({ ...value, [field]: "あ".repeat(max + 1) })),
    ).toBeNull();
  });
  it("grounds extracted values across full-width characters and spacing", () => {
    expect(isGrounded(validResult, "青森県産 りんご １ 袋 ３９８円")).toBe(
      true,
    );
  });
  it("does not treat a price as a substring of a different amount", () => {
    expect(isGrounded(validResult, "青森県産 りんご 1袋 1,398円")).toBe(false);
  });
  it("accepts null fields without inventing missing information", () => {
    expect(
      isGrounded(
        { productName: "りんご", origin: null, unit: null, price: null },
        "りんご",
      ),
    ).toBe(true);
  });
});
