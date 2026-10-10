import { act, renderHook, waitFor } from "@testing-library/react";
import { apiRequest } from "../api/api";
import { useFetch, useApiCall } from "./useFetch";

vi.mock("../api/api", () => ({ apiRequest: vi.fn() }));

describe("useFetch", () => {
  beforeEach(() => {
    apiRequest.mockReset();
  });

  it("loads data and clears loading", async () => {
    apiRequest.mockResolvedValue({ items: [1, 2] });

    const { result } = renderHook(() => useFetch("/products"));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual({ items: [1, 2] });
    expect(result.current.error).toBeNull();
    expect(apiRequest).toHaveBeenCalledWith("/products", "GET", null, {
      signal: expect.any(AbortSignal),
    });
  });

  it("applies the transform to the response", async () => {
    apiRequest.mockResolvedValue({ items: [1] });

    const { result } = renderHook(() =>
      useFetch("/products", { transform: (d) => d.items })
    );

    await waitFor(() => expect(result.current.data).toEqual([1]));
  });

  it("exposes the error message on failure", async () => {
    apiRequest.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useFetch("/products"));

    await waitFor(() => expect(result.current.error).toBe("boom"));
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("does not fetch when skip is true", () => {
    const { result } = renderHook(() => useFetch("/products", { skip: true }));

    expect(result.current.loading).toBe(false);
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it("refetch triggers a fresh request", async () => {
    apiRequest.mockResolvedValue({ n: 1 });
    const { result } = renderHook(() => useFetch("/products"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    apiRequest.mockResolvedValue({ n: 2 });
    act(() => result.current.refetch());

    await waitFor(() => expect(result.current.data).toEqual({ n: 2 }));
    expect(apiRequest).toHaveBeenCalledTimes(2);
  });

  it("refetches when the endpoint changes", async () => {
    apiRequest.mockResolvedValue({});
    const { result, rerender } = renderHook(({ ep }) => useFetch(ep), {
      initialProps: { ep: "/a" },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    rerender({ ep: "/b" });

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith("/b", "GET", null, {
        signal: expect.any(AbortSignal),
      })
    );
    expect(apiRequest).toHaveBeenCalledTimes(2);
  });

  it("ignores AbortError rejections without setting error", async () => {
    const abortError = Object.assign(new Error("aborted"), {
      name: "AbortError",
    });
    apiRequest.mockRejectedValue(abortError);

    const { result } = renderHook(() => useFetch("/products"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.data).toBeNull();
  });
});

describe("useApiCall", () => {
  beforeEach(() => {
    apiRequest.mockReset();
  });

  it("run() issues the request and returns the data", async () => {
    apiRequest.mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useApiCall());

    let data;
    await act(async () => {
      data = await result.current.run("/x", "POST", { a: 1 });
    });

    expect(data).toEqual({ ok: true });
    expect(apiRequest).toHaveBeenCalledWith("/x", "POST", { a: 1 }, {
      signal: expect.any(AbortSignal),
    });
    expect(result.current.loading).toBe(false);
  });

  it("run() resolves to undefined on abort instead of throwing", async () => {
    const abortError = Object.assign(new Error("aborted"), {
      name: "AbortError",
    });
    apiRequest.mockRejectedValue(abortError);
    const { result } = renderHook(() => useApiCall());

    let value;
    await act(async () => {
      value = await result.current.run("/x");
    });

    expect(value).toBeUndefined();
  });

  it("run() rethrows non-abort errors", async () => {
    apiRequest.mockRejectedValue(new Error("fail"));
    const { result } = renderHook(() => useApiCall());

    await expect(
      act(async () => {
        await result.current.run("/x");
      })
    ).rejects.toThrow("fail");
    expect(result.current.loading).toBe(false);
  });
});
