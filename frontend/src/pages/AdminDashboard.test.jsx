import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminDashboard from "./AdminDashboard";

// Every refreshTrigger value InventoryAlerts is rendered with.
const { triggers } = vi.hoisted(() => ({ triggers: [] }));

// Stub the five section components — each has its own test file; here we
// only check that the dashboard mounts them and wires the refresh key.
vi.mock("../components/ProductManagement", () => ({
  default: ({ onProductChange }) => (
    <button data-testid="product-management" onClick={onProductChange}>
      ProductManagement
    </button>
  ),
}));

vi.mock("../components/InventoryAlerts", () => ({
  default: ({ refreshTrigger }) => {
    triggers.push(refreshTrigger);
    return <div data-testid="inventory-alerts" />;
  },
}));

vi.mock("../components/SalesSummary", () => ({
  default: () => <div data-testid="sales-summary" />,
}));

vi.mock("../components/TransactionLog", () => ({
  default: () => <div data-testid="transaction-log" />,
}));

vi.mock("../components/UserRegistration", () => ({
  default: () => <div data-testid="user-registration" />,
}));

describe("AdminDashboard", () => {
  beforeEach(() => {
    triggers.length = 0;
  });

  it("renders the heading and all admin sections", () => {
    render(<AdminDashboard />);

    expect(
      screen.getByRole("heading", { name: "Admin Dashboard" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Manage products and users, and review sales activity."
      )
    ).toBeInTheDocument();
    expect(screen.getByTestId("inventory-alerts")).toBeInTheDocument();
    expect(screen.getByTestId("sales-summary")).toBeInTheDocument();
    expect(screen.getByTestId("product-management")).toBeInTheDocument();
    expect(screen.getByTestId("transaction-log")).toBeInTheDocument();
    expect(screen.getByTestId("user-registration")).toBeInTheDocument();
    expect(triggers).toEqual([0]);
  });

  it("bumps the InventoryAlerts refreshTrigger on product changes", async () => {
    const user = userEvent.setup();
    render(<AdminDashboard />);

    await user.click(screen.getByTestId("product-management"));
    await user.click(screen.getByTestId("product-management"));

    expect(triggers).toEqual([0, 1, 2]);
  });
});
