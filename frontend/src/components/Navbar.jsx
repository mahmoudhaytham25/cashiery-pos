import React from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from '../context/AuthContext';

function Navbar() {
  const { user, logout } = useAuth();

  if (!user) {
    return (
      <nav>
        <Link to="/" className="nav-brand">Cashiery</Link>
        <div className="nav-user">
          <NavLink to="/login">Login</NavLink>
        </div>
      </nav>
    );
  }

  return (
    <nav>
      <Link to="/" className="nav-brand">Cashiery</Link>
      <div className="nav-links">
        <NavLink to="/pos">POS</NavLink>
        {user.role === "admin" && <NavLink to="/admin">Admin Dashboard</NavLink>}
      </div>
      <div className="nav-user">
        <span className="nav-greeting">Welcome, {user.username || user.role}!</span>
        <button className="nav-logout" onClick={logout}>Logout</button>
      </div>
    </nav>
  );
}

export default Navbar;
