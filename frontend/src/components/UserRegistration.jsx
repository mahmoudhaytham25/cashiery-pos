import React, { useState } from "react";
import { apiRequest } from "../api/api";

function UserRegistration() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("cashier");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setMessage("");
    setError("");
    setSubmitting(true);
    try {
      await apiRequest("/auth/register", "POST", {
        username: username.trim(),
        password,
        role,
      });
      setMessage("User registered successfully!");
      setUsername("");
      setPassword("");
      setRole("cashier");
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h3>Register New User</h3>
      <form onSubmit={handleRegister}>
        <div className="form-group">
          <label htmlFor="reg-username">Username</label>
          <input
            id="reg-username"
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoComplete="off"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="reg-password">Password</label>
          <input
            id="reg-password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="reg-role">Role</label>
          <select
            id="reg-role"
            value={role}
            onChange={e => setRole(e.target.value)}
          >
            <option value="cashier">Cashier</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button type="submit" disabled={submitting}>
          {submitting ? "Registering..." : "Register"}
        </button>
      </form>
      {message && <div className="success-message">{message}</div>}
      {error && <div className="error-message">{error}</div>}
    </div>
  );
}

export default UserRegistration;
