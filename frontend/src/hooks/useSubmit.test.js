import { act, renderHook } from "@testing-library/react";
import { useSubmit } from "./useSubmit";

describe("useSubmit", () => {
  it("toggles submitting while the function runs", async () => {
    const { result } = renderHook(() => useSubmit());
    let resolve;
    const fn = vi.fn(() => new Promise((r) => (resolve = r)));

    let pending;
    await act(async () => {
      pending = result.current.submit(fn);
    });
    expect(result.current.submitting).toBe(true);

    await act(async () => {
      resolve();
      await pending;
    });
    expect(result.current.submitting).toBe(false);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("captures errors through formatError", async () => {
    const { result } = renderHook(() => useSubmit());

    await act(async () => {
      await result.current.submit(
        async () => {
          throw new Error("nope");
        },
        (err) => `ERR:${err.message}`
      );
    });

    expect(result.current.error).toBe("ERR:nope");
    expect(result.current.submitting).toBe(false);
  });

  it("uses err.message by default", async () => {
    const { result } = renderHook(() => useSubmit());

    await act(async () => {
      await result.current.submit(async () => {
        throw new Error("plain failure");
      });
    });

    expect(result.current.error).toBe("plain failure");
  });

  it("clears feedback before each run", async () => {
    const { result } = renderHook(() => useSubmit());
    act(() => {
      result.current.setError("old error");
      result.current.setMessage("old message");
    });

    await act(async () => {
      await result.current.submit(async () => {});
    });

    expect(result.current.error).toBe("");
    expect(result.current.message).toBe("");
  });

  it("clear() resets error and message", async () => {
    const { result } = renderHook(() => useSubmit());
    act(() => {
      result.current.setError("err");
      result.current.setMessage("msg");
    });

    act(() => result.current.clear());

    expect(result.current.error).toBe("");
    expect(result.current.message).toBe("");
  });

  it("ignores a second submit while one is in flight", async () => {
    const { result } = renderHook(() => useSubmit());
    let resolve;
    const first = vi.fn(() => new Promise((r) => (resolve = r)));
    const second = vi.fn();

    let pending;
    await act(async () => {
      pending = result.current.submit(first);
    });
    await act(async () => {
      await result.current.submit(second);
    });

    expect(second).not.toHaveBeenCalled();

    await act(async () => {
      resolve();
      await pending;
    });
    expect(first).toHaveBeenCalledTimes(1);
  });
});
