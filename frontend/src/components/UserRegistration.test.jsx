import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiRequest } from "../api/api";
import UserRegistration from "./UserRegistration";

vi.mock("../api/api", () => ({ apiRequest: vi.fn() }));

describe("UserRegistration", () => {
  beforeEach(() => {
    apiRequest.mockReset();
  });

  it("defaults to the cashier role", () => {
    render(<UserRegistration />);

    expect(screen.getByLabelText("Role")).toHaveValue("cashier");
    expect(
      screen.getByRole("button", { name: "Register" })
    ).toBeEnabled();
  });

  it("registers a cashier and clears the form", async () => {
    const user = userEvent.setup();
    apiRequest.mockResolvedValue({ id: 3 });
    render(<UserRegistration />);

    // Leading/trailing spaces are trimmed before the request.
    await user.type(screen.getByLabelText("Username"), " newguy ");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Register" }));

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith("/auth/register", "POST", {
        username: "newguy",
        password: "secret",
        role: "cashier",
      })
    );
    expect(
      await screen.findByText("User registered successfully!")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toHaveValue("");
    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(screen.getByLabelText("Role")).toHaveValue("cashier");
  });

  it("sends the selected admin role", async () => {
    const user = userEvent.setup();
    apiRequest.mockResolvedValue({ id: 4 });
    render(<UserRegistration />);

    await user.type(screen.getByLabelText("Username"), "boss2");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.selectOptions(screen.getByLabelText("Role"), "admin");
    await user.click(screen.getByRole("button", { name: "Register" }));

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith("/auth/register", "POST", {
        username: "boss2",
        password: "secret",
        role: "admin",
      })
    );
  });

  it("shows the server error on failure", async () => {
    const user = userEvent.setup();
    apiRequest.mockRejectedValue(new Error("username already taken"));
    render(<UserRegistration />);

    await user.type(screen.getByLabelText("Username"), "newguy");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Register" }));

    expect(
      await screen.findByText("username already taken")
    ).toBeInTheDocument();
  });
});
