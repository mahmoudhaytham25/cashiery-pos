import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { apiRequest } from "../api/api";
import { useAuth } from '../context/AuthContext';


function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Already authenticated — go straight to the role-appropriate page.
  if (user) {
    return <Navigate to={user.role === "admin" ? "/admin" : "/pos"} replace />;
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError("");
    setSubmitting(true);
    try {
      const data = await apiRequest("/auth/login", "POST", {
        username: username.trim(),
        password,
      });
      const loggedIn = login(data.token, data);
      navigate(loggedIn.role === "admin" ? "/admin" : "/pos", { replace: true });
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h2>Login</h2>
      <form onSubmit={handleLogin}>
        <div className="form-group">
          <label htmlFor="login-username">Username</label>
          <input
            id="login-username"
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        <button type="submit" disabled={submitting}>
          {submitting ? "Logging in..." : "Login"}
        </button>
      </form>
      {error && <div className="error-message">{error}</div>}
    </div>
  );
}

export default Login;
