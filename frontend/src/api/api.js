const API_BASE_URL = "/api";

const AUTH_KEYS = ["token", "role", "user"];

const getToken = () => localStorage.getItem("token");

const clearAuth = () => {
  AUTH_KEYS.forEach((key) => localStorage.removeItem(key));
};

// Optional callback (registered by AuthContext) invoked when the server
// rejects our credentials, so auth state can be cleared via React instead
// of a hard navigation.
let onUnauthorized = null;
export const setOnUnauthorized = (callback) => {
  onUnauthorized = callback;
};

// Postgres returns lowercase column names; the rest of the app uses `sku`.
export const normalizeProduct = (product) => ({
  ...product,
  sku: product.sku ?? product.SKU ?? null,
});

// Accepts either a bare array or a { products: [...] } envelope.
export const normalizeProducts = (data) => {
  const list = data?.products ?? data;
  return Array.isArray(list) ? list.map(normalizeProduct) : [];
};

// Generic fetch wrapper to handle API requests
export const apiRequest = async (endpoint, method = "GET", body = null) => {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const config = {
    method,
    headers,
  };
  if (body) {
    config.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    // Error responses may be HTML (e.g. nginx 502) — don't crash parsing.
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      if (response.status === 401) {
        // Token is expired/invalid — clear all auth keys and sign out.
        clearAuth();
        if (onUnauthorized) {
          onUnauthorized();
        } else {
          window.location.href = "/login";
        }
      }
      throw new Error(
        data?.error || data?.message || `Request failed (${response.status})`
      );
    }

    return data;
  } catch (error) {
    console.error("API Request Error:", error);
    throw error;
  }
};
