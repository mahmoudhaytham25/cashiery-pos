import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { setOnUnauthorized } from '../api/api';

const AuthContext = createContext();

const AUTH_KEYS = ["token", "role", "user"];

const clearAuthKeys = () => {
  AUTH_KEYS.forEach((key) => localStorage.removeItem(key));
};

// Decode the payload segment of a JWT. Returns null for malformed tokens.
const decodeJwt = (token) => {
  try {
    const segment = token.split(".")[1];
    if (!segment) return null;
    const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
};

// Derive the user object from the token itself — never trust the
// user-editable `role` localStorage key.
const userFromToken = (token) => {
  const payload = decodeJwt(token);
  if (!payload || !payload.role) return null;
  // `exp` is in seconds; reject expired tokens at load time.
  if (payload.exp && payload.exp * 1000 <= Date.now()) return null;
  return {
    id: payload.id ?? payload.sub ?? null,
    username: payload.username ?? null,
    role: payload.role,
  };
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem("token");
    if (!token) return null;
    const parsed = userFromToken(token);
    if (!parsed) clearAuthKeys(); // malformed or expired token
    return parsed;
  });

  const logout = useCallback(() => {
    clearAuthKeys();
    setUser(null);
    window.location.href = "/login";
  }, []);

  // 401s from apiRequest should sign the user out through React state.
  useEffect(() => {
    setOnUnauthorized(logout);
    return () => setOnUnauthorized(null);
  }, [logout]);

  const login = (token, userData = {}) => {
    localStorage.setItem("token", token);
    localStorage.removeItem("role"); // no longer authoritative
    const parsed = userFromToken(token);
    const nextUser = parsed || {
      id: userData.id ?? null,
      username: userData.username ?? null,
      role: userData.role ?? null,
    };
    localStorage.setItem("user", JSON.stringify(nextUser));
    setUser(nextUser);
    return nextUser;
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
