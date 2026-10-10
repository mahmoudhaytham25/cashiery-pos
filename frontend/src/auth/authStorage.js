export const AUTH_KEYS = ["token", "role", "user"];

export const clearAuth = () => {
  AUTH_KEYS.forEach((key) => localStorage.removeItem(key));
};

// Persist a fresh login — the JWT is authoritative, so the legacy
// user-editable `role` key stays cleared.
export const setAuth = (token, user) => {
  localStorage.setItem("token", token);
  localStorage.removeItem("role");
  localStorage.setItem("user", JSON.stringify(user));
};

export const homePathFor = (user) =>
  user?.role === "admin" ? "/admin" : "/pos";
