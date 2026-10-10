import {
  apiRequest,
  normalizeProduct,
  normalizeProducts,
  normalizeTransactions,
  setOnUnauthorized,
} from "./api";

const mockFetch = vi.fn();

const stubResponse = ({ ok = true, status = 200, body = {} } = {}) =>
  Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(body),
  });

describe("normalizeProduct", () => {
  it("keeps a lowercase sku", () => {
    expect(normalizeProduct({ id: 1, sku: "W-1" }).sku).toBe("W-1");
  });

  it("maps a Postgres-style uppercase SKU to sku", () => {
    expect(normalizeProduct({ id: 1, SKU: "W-1" }).sku).toBe("W-1");
  });

  it("prefers sku over SKU and defaults to null", () => {
    expect(normalizeProduct({ sku: "a", SKU: "b" }).sku).toBe("a");
    expect(normalizeProduct({ id: 1 }).sku).toBeNull();
  });
});

describe("normalizeProducts", () => {
  it("accepts a bare array", () => {
    const result = normalizeProducts([{ id: 1, SKU: "W-1" }]);
    expect(result).toEqual([{ id: 1, SKU: "W-1", sku: "W-1" }]);
  });

  it("accepts a { products: [...] } envelope", () => {
    const result = normalizeProducts({ products: [{ id: 2 }] });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  it("returns [] for garbage input", () => {
    expect(normalizeProducts(null)).toEqual([]);
    expect(normalizeProducts({ other: [] })).toEqual([]);
    expect(normalizeProducts("nope")).toEqual([]);
  });
});

describe("normalizeTransactions", () => {
  it("accepts bare arrays and envelopes", () => {
    expect(normalizeTransactions([{ id: 1 }])).toEqual([{ id: 1 }]);
    expect(normalizeTransactions({ transactions: [{ id: 2 }] })).toEqual([
      { id: 2 },
    ]);
  });

  it("returns [] for garbage input", () => {
    expect(normalizeTransactions(null)).toEqual([]);
    expect(normalizeTransactions(42)).toEqual([]);
  });
});

describe("apiRequest", () => {
  beforeEach(() => {
    localStorage.clear();
    setOnUnauthorized(null);
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("attaches the Bearer token from localStorage", async () => {
    localStorage.setItem("token", "tok-123");
    mockFetch.mockReturnValue(stubResponse({ body: { ok: true } }));

    await apiRequest("/products");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/products",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer tok-123",
          "Content-Type": "application/json",
        }),
      })
    );
  });

  it("omits the Authorization header when there is no token", async () => {
    mockFetch.mockReturnValue(stubResponse());

    await apiRequest("/products");

    const [, config] = mockFetch.mock.calls[0];
    expect(config.headers.Authorization).toBeUndefined();
  });

  it("serializes the body as JSON for write requests", async () => {
    mockFetch.mockReturnValue(stubResponse());

    await apiRequest("/transactions", "POST", { items: [] });

    const [, config] = mockFetch.mock.calls[0];
    expect(config.method).toBe("POST");
    expect(config.body).toBe(JSON.stringify({ items: [] }));
  });

  it("returns the parsed JSON on success", async () => {
    mockFetch.mockReturnValue(stubResponse({ body: [{ id: 1 }] }));

    await expect(apiRequest("/products")).resolves.toEqual([{ id: 1 }]);
  });

  it("throws the server's error message from the envelope", async () => {
    mockFetch.mockReturnValue(
      stubResponse({ ok: false, status: 400, body: { error: "Invalid role" } })
    );

    await expect(apiRequest("/auth/register", "POST", {})).rejects.toThrow(
      "Invalid role"
    );
  });

  it("falls back to the status code when the body isn't JSON", async () => {
    mockFetch.mockReturnValue(
      Promise.resolve({
        ok: false,
        status: 502,
        json: () => Promise.reject(new Error("not json")),
      })
    );

    await expect(apiRequest("/products")).rejects.toThrow(
      "Request failed (502)"
    );
  });

  it("clears auth and invokes the onUnauthorized callback on 401", async () => {
    localStorage.setItem("token", "expired");
    localStorage.setItem("user", "{}");
    const onUnauthorized = vi.fn();
    setOnUnauthorized(onUnauthorized);
    mockFetch.mockReturnValue(
      stubResponse({ ok: false, status: 401, body: { error: "Invalid token" } })
    );

    await expect(apiRequest("/products")).rejects.toThrow("Invalid token");

    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("clears auth on 401 even without a registered callback", async () => {
    localStorage.setItem("token", "expired");
    mockFetch.mockReturnValue(
      stubResponse({ ok: false, status: 401, body: {} })
    );

    // No onUnauthorized registered — apiRequest falls back to a
    // window.location navigation (a no-op under jsdom).
    await expect(apiRequest("/products")).rejects.toThrow(
      "Request failed (401)"
    );
    expect(localStorage.getItem("token")).toBeNull();
  });

  it("rethrows AbortError without logging to console.error", async () => {
    const abortError = Object.assign(new Error("aborted"), {
      name: "AbortError",
    });
    mockFetch.mockRejectedValue(abortError);

    await expect(apiRequest("/products")).rejects.toBe(abortError);
    expect(console.error).not.toHaveBeenCalled();
  });
});
