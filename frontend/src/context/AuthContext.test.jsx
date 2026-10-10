import React from "react";
import { act, renderHook } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthContext";

// Build a structurally valid JWT — decodeJwt only splits and base64-decodes
// the payload, so the signature segment can be anything.
const makeToken = (payload) => {
  const segment = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `header.${segment}.signature`;
};

const futureExp = () => Math.floor(Date.now() / 1000) + 3600;
const pastExp = () => Math.floor(Date.now() / 1000) - 3600;

describe("useAuth", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("throws outside an AuthProvider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useAuth())).toThrow(
      "useAuth must be used within an AuthProvider"
    );
    vi.restoreAllMocks();
  });

  it("starts logged out when no token is stored", () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    expect(result.current.user).toBeNull();
  });

  it("restores the user from a valid stored token", () => {
    localStorage.setItem(
      "token",
      makeToken({ sub: 3, username: "lee", role: "cashier", exp: futureExp() })
    );

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    expect(result.current.user).toEqual({
      id: 3,
      username: "lee",
      role: "cashier",
    });
  });

  it("drops an expired stored token and clears auth storage", () => {
    localStorage.setItem(
      "token",
      makeToken({ id: 1, username: "sam", role: "admin", exp: pastExp() })
    );
    localStorage.setItem("user", "{}");

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    expect(result.current.user).toBeNull();
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
  });

  it("drops a malformed stored token", () => {
    localStorage.setItem("token", "not-a-jwt");

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    expect(result.current.user).toBeNull();
    expect(localStorage.getItem("token")).toBeNull();
  });

  it("login() decodes token claims and persists auth storage", () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    const token = makeToken({
      id: 7,
      username: "boss",
      role: "admin",
      exp: futureExp(),
    });

    act(() => result.current.login(token));

    expect(result.current.user).toEqual({
      id: 7,
      username: "boss",
      role: "admin",
    });
    expect(localStorage.getItem("token")).toBe(token);
    expect(JSON.parse(localStorage.getItem("user"))).toEqual({
      id: 7,
      username: "boss",
      role: "admin",
    });
    expect(localStorage.getItem("role")).toBeNull();
  });

  it("login() falls back to the passed user data for an undecodable token", () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    act(() =>
      result.current.login("not-a-jwt", {
        id: 2,
        username: "cash",
        role: "cashier",
      })
    );

    expect(result.current.user).toEqual({
      id: 2,
      username: "cash",
      role: "cashier",
    });
  });

  it("logout() clears the user and auth storage", () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    act(() =>
      result.current.login(
        makeToken({ id: 1, username: "sam", role: "admin", exp: futureExp() })
      )
    );

    // logout also assigns window.location.href — a no-op under jsdom.
    act(() => result.current.logout());

    expect(result.current.user).toBeNull();
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
  });
});
