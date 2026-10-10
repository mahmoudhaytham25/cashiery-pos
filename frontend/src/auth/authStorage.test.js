import { AUTH_KEYS, clearAuth, setAuth, homePathFor } from "./authStorage";

describe("authStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("setAuth stores the token and JSON user, and clears the legacy role key", () => {
    localStorage.setItem("role", "admin");

    setAuth("tok-123", { id: 1, username: "sam", role: "admin" });

    expect(localStorage.getItem("token")).toBe("tok-123");
    expect(localStorage.getItem("role")).toBeNull();
    expect(JSON.parse(localStorage.getItem("user"))).toEqual({
      id: 1,
      username: "sam",
      role: "admin",
    });
  });

  it("clearAuth removes every auth key", () => {
    AUTH_KEYS.forEach((key) => localStorage.setItem(key, "value"));

    clearAuth();

    AUTH_KEYS.forEach((key) =>
      expect(localStorage.getItem(key)).toBeNull()
    );
  });

  it("clearAuth is a no-op when storage is already empty", () => {
    expect(() => clearAuth()).not.toThrow();
  });
});

describe("homePathFor", () => {
  it("sends admins to /admin", () => {
    expect(homePathFor({ role: "admin" })).toBe("/admin");
  });

  it("sends cashiers and unknown users to /pos", () => {
    expect(homePathFor({ role: "cashier" })).toBe("/pos");
    expect(homePathFor({})).toBe("/pos");
    expect(homePathFor(null)).toBe("/pos");
  });
});
