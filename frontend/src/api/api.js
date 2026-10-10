import { clearAuth } from "../auth/authStorage";

const API_BASE_URL = "/api";

const getToken = () => localStorage.getItem("token");

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

// Accepts either a bare array or a { <key>: [...] } envelope.
const normalizeList = (data, key) => {
  const list = data?.[key] ?? data;
  return Array.isArray(list) ? list : [];
};

// Accepts either a bare array or a { products: [...] } envelope.
export const normalizeProducts = (data) =>
  normalizeList(data, "products").map(normalizeProduct);

export const normalizeTransactions = (data) =>
  normalizeList(data, "transactions");

// Generic fetch wrapper to handle API requests
export const apiRequest = async (endpoint, method = "GET", body = null, { signal } = {}) => {
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
  if (signal) {
    config.signal = signal;
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
    if (error.name !== "AbortError") {
      console.error("API Request Error:", error);
    }
    throw error;
  }
};
