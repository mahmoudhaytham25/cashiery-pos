import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Navbar from "./Navbar";

vi.mock("../context/AuthContext", () => ({ useAuth: vi.fn() }));

const renderNav = (auth) => {
  useAuth.mockReturnValue(auth);
  return render(
    <MemoryRouter>
      <Navbar />
    </MemoryRouter>
  );
};

describe("Navbar", () => {
  beforeEach(() => {
    useAuth.mockReset();
  });

  it("shows only the brand and Login link when logged out", () => {
    renderNav({ user: null });

    expect(screen.getByRole("link", { name: "Login" })).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "POS" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Logout" })
    ).not.toBeInTheDocument();
  });

  it("shows POS but not the admin link for a cashier", () => {
    renderNav({ user: { username: "sam", role: "cashier" } });

    expect(screen.getByRole("link", { name: "POS" })).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Admin Dashboard" })
    ).not.toBeInTheDocument();
    expect(screen.getByText("Welcome, sam!")).toBeInTheDocument();
  });

  it("shows the admin link for an admin", () => {
    renderNav({ user: { username: "boss", role: "admin" } });

    expect(
      screen.getByRole("link", { name: "Admin Dashboard" })
    ).toBeInTheDocument();
  });

  it("calls logout when the Logout button is clicked", async () => {
    const user = userEvent.setup();
    const logout = vi.fn();
    renderNav({ user: { username: "sam", role: "cashier" }, logout });

    await user.click(screen.getByRole("button", { name: "Logout" }));

    expect(logout).toHaveBeenCalledTimes(1);
  });
});
