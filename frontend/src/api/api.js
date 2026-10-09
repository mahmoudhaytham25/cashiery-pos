const API_BASE_URL = "/api";

// Helper function to get the JWT token from localStorage
const getToken = () => localStorage.getItem("token");

// Helper function to set the JWT token in localStorage
const setToken = (token) => localStorage.setItem("token", token);

// Helper function to remove the JWT token from localStorage
const removeToken = () => localStorage.removeItem("token");

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
    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        // Token is expired/invalid - clear it and send the user to login
        removeToken();
        window.location.href = "/login";
      }
      throw new Error(data.error || data.message || "API request failed");
    }

    return data;
  } catch (error) {
    console.error('API Request Error:', error);
    throw error;
  }
};

// Authentication APIs
export const login = async (username, password) => {
  const data = await apiRequest("/auth/login", "POST", { username, password });
  setToken(data.token);
  return { token: data.token, role: data.role };
};

export const register = async (username, password, role) => {
  const data = await apiRequest("/auth/register", "POST", {
    username,
    password,
    role,
  });
  return data;
};

// Product APIs
export const getProducts = async () => {
  return apiRequest("/products");
};

export const searchProducts = async (searchTerm) => {
  try {
    return await apiRequest(`/products?search=${encodeURIComponent(searchTerm)}`);
  } catch (error) {
    // Fallback: get all products and filter locally
    const products = await getProducts();
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.sku && product.sku.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }
};

export const addProduct = async (productData) => {
  return apiRequest("/products", "POST", productData);
};

export const updateProduct = async (id, productData) => {
  return apiRequest(`/products/${id}`, "PUT", productData);
};

export const getLowStockProducts = async (threshold = 10) => {
  return apiRequest(`/products/low-stock?threshold=${threshold}`);
};

// Transaction APIs
export const createTransaction = async (transactionData) => {
  return apiRequest("/transactions", "POST", transactionData);
};

export const getTransactions = async () => {
  return apiRequest("/transactions");
};

export const getTransactionSummary = async () => {
  return apiRequest("/transactions/summary");
};

// Logout function to clear token
export const logout = () => {
  removeToken();
  localStorage.removeItem("role");
};