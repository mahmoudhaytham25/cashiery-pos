import React, { useState } from "react";
import { apiRequest } from "../api/api";
import { useSubmit } from "../hooks/useSubmit";
import FormField from "./FormField";
import StatusMessage from "./StatusMessage";

function UserRegistration() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("cashier");
  const { submitting, error, message, setMessage, submit } = useSubmit();

  const handleRegister = async (e) => {
    e.preventDefault();
    await submit(async () => {
      await apiRequest("/auth/register", "POST", {
        username: username.trim(),
        password,
        role,
      });
      setMessage("User registered successfully!");
      setUsername("");
      setPassword("");
      setRole("cashier");
    }, (err) => err.message || "Registration failed");
  };

  return (
    <div className="user-registration card">
      <h3>Register New User</h3>
      <form onSubmit={handleRegister}>
        <FormField
          id="reg-username"
          label="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          autoComplete="off"
          required
          className="form-input"
        />
        <FormField
          id="reg-password"
          label="Password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete="new-password"
          required
          className="form-input"
        />
        <div className="form-group">
          <label htmlFor="reg-role">Role</label>
          <select
            id="reg-role"
            className="form-input"
            value={role}
            onChange={e => setRole(e.target.value)}
          >
            <option value="cashier">Cashier</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button type="submit" className="submit-btn" disabled={submitting}>
          {submitting ? "Registering..." : "Register"}
        </button>
      </form>
      {message && <StatusMessage type="success">{message}</StatusMessage>}
      {error && <StatusMessage type="error">{error}</StatusMessage>}
    </div>
  );
}

export default React.memo(UserRegistration);
