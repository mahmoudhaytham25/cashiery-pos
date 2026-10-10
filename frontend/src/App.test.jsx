import React from "react";
import { render, screen } from "@testing-library/react";
import { useAuth } from "./context/AuthContext";
import App from "./App";

// AuthProvider is stubbed to a passthrough; routes/pages are stubbed so each
// test only asserts which route rendered for a given auth state.
vi.mock("./context/AuthContext", () => ({
  AuthProvider: ({ children }) => children,
  useAuth: vi.fn(),
}));
vi.mock("./components/Navbar", () => ({
  default: () => <div data-testid="navbar" />,
}));
vi.mock("./components/Login", () => ({ default: () => <div>Login Page</div> }));
vi.mock("./pages/POS", () => ({ default: () => <div>POS Page</div> }));
vi.mock("./pages/AdminDashboard", () => ({
  default: () => <div>Admin Page</div>,
}));
vi.mock("./pages/NotFound", () => ({ default: () => <div>404 Page</div> }));

const user = (role) => ({ id: 1, username: "u", role });

const renderAt = (path, u) => {
  useAuth.mockReturnValue({ user: u });
  window.history.pushState({}, "", path);
  return render(<App />);
};

describe("App routing", () => {
  beforeEach(() => {
    useAuth.mockReset();
    window.history.pushState({}, "", "/");
  });

  it("sends / to /login when logged out", () => {
    renderAt("/", null);
    expect(screen.getByText("Login Page")).toBeInTheDocument();
  });

  it("sends / to /pos for a cashier", () => {
    renderAt("/", user("cashier"));
    expect(screen.getByText("POS Page")).toBeInTheDocument();
  });

  it("sends / to /admin for an admin", () => {
    renderAt("/", user("admin"));
    expect(screen.getByText("Admin Page")).toBeInTheDocument();
  });

  it("redirects a logged-out user away from /pos", () => {
    renderAt("/pos", null);
    expect(screen.getByText("Login Page")).toBeInTheDocument();
  });

  it("lets a cashier into /pos", () => {
    renderAt("/pos", user("cashier"));
    expect(screen.getByText("POS Page")).toBeInTheDocument();
  });

  it("bounces a cashier off /admin to their own home page", () => {
    renderAt("/admin", user("cashier"));
    expect(screen.getByText("POS Page")).toBeInTheDocument();
  });

  it("lets an admin into /admin", () => {
    renderAt("/admin", user("admin"));
    expect(screen.getByText("Admin Page")).toBeInTheDocument();
  });

  it("renders NotFound for unknown paths", () => {
    renderAt("/no-such-page", user("cashier"));
    expect(screen.getByText("404 Page")).toBeInTheDocument();
  });
});
