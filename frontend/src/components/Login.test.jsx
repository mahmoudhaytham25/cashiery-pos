import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { apiRequest } from "../api/api";
import { AuthProvider } from "../context/AuthContext";
import Login from "./Login";

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));

// AuthContext imports setOnUnauthorized from this module too — it must
// exist on the mock even though only apiRequest is exercised here.
vi.mock("../api/api", () => ({
  apiRequest: vi.fn(),
  setOnUnauthorized: vi.fn(),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const mod = await importOriginal();
  return { ...mod, useNavigate: () => mockNavigate };
});

const makeToken = (payload) => {
  const segment = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `header.${segment}.signature`;
};

const futureExp = () => Math.floor(Date.now() / 1000) + 3600;

const renderLogin = () =>
  render(
    <MemoryRouter>
      <AuthProvider>
        <Login />
      </AuthProvider>
    </MemoryRouter>
  );

describe("Login", () => {
  beforeEach(() => {
    localStorage.clear();
    apiRequest.mockReset();
    mockNavigate.mockReset();
  });

  it("posts credentials, stores the token and navigates admin home", async () => {
    const user = userEvent.setup();
    const token = makeToken({
      id: 1,
      username: "boss",
      role: "admin",
      exp: futureExp(),
    });
    apiRequest.mockResolvedValue({
      token,
      id: 1,
      username: "boss",
      role: "admin",
    });
    renderLogin();

    // Leading/trailing spaces are trimmed before the request.
    await user.type(screen.getByLabelText("Username"), " boss ");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Login" }));

    expect(apiRequest).toHaveBeenCalledWith("/auth/login", "POST", {
      username: "boss",
      password: "password123",
    });
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/admin", { replace: true })
    );
    expect(localStorage.getItem("token")).toBe(token);
  });

  it("navigates a cashier to /pos", async () => {
    const user = userEvent.setup();
    apiRequest.mockResolvedValue({
      token: makeToken({
        id: 2,
        username: "till",
        role: "cashier",
        exp: futureExp(),
      }),
    });
    renderLogin();

    await user.type(screen.getByLabelText("Username"), "till");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/pos", { replace: true })
    );
  });

  it("shows the server error on a failed login", async () => {
    const user = userEvent.setup();
    apiRequest.mockRejectedValue(new Error("Invalid credentials"));
    renderLogin();

    await user.type(screen.getByLabelText("Username"), "boss");
    await user.type(screen.getByLabelText("Password"), "wrong-pass");
    await user.click(screen.getByRole("button", { name: "Login" }));

    expect(
      await screen.findByText("Invalid credentials")
    ).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(localStorage.getItem("token")).toBeNull();
  });
});
