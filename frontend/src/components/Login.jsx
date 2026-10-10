import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { apiRequest } from "../api/api";
import { useAuth } from '../context/AuthContext';
import { homePathFor } from "../auth/authStorage";
import { useSubmit } from "../hooks/useSubmit";
import FormField from "./FormField";
import StatusMessage from "./StatusMessage";


function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { submitting, error, submit } = useSubmit();

  // Already authenticated — go straight to the role-appropriate page.
  if (user) {
    return <Navigate to={homePathFor(user)} replace />;
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    await submit(async () => {
      const data = await apiRequest("/auth/login", "POST", {
        username: username.trim(),
        password,
      });
      const loggedIn = login(data.token, data);
      navigate(homePathFor(loggedIn), { replace: true });
    }, (err) => err.message || "Login failed");
  };

  return (
    <div>
      <h2>Login</h2>
      <form onSubmit={handleLogin}>
        <FormField
          id="login-username"
          label="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          autoComplete="username"
          required
        />
        <FormField
          id="login-password"
          label="Password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        <button type="submit" disabled={submitting}>
          {submitting ? "Logging in..." : "Login"}
        </button>
      </form>
      {error && <StatusMessage type="error">{error}</StatusMessage>}
    </div>
  );
}

export default Login;
