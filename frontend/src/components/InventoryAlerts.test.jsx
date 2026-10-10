import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiRequest } from "../api/api";
import InventoryAlerts from "./InventoryAlerts";

// Keep the real normalizers; only the transport is mocked.
vi.mock("../api/api", async (importOriginal) => {
  const mod = await importOriginal();
  return { ...mod, apiRequest: vi.fn() };
});

describe("InventoryAlerts", () => {
  beforeEach(() => {
    apiRequest.mockReset();
  });

  it("shows the loading state while fetching", () => {
    apiRequest.mockReturnValue(new Promise(() => {}));
    render(<InventoryAlerts refreshTrigger={0} />);

    expect(
      screen.getByText("Loading inventory alerts...")
    ).toBeInTheDocument();
  });

  it("renders the low-stock items", async () => {
    apiRequest.mockResolvedValue([
      { id: 1, name: "Widget", stock: 3, SKU: "W-1" },
      { id: 2, name: "Gadget", stock: 8 },
    ]);
    render(<InventoryAlerts refreshTrigger={0} />);

    expect(await screen.findByText("Widget")).toBeInTheDocument();
    expect(screen.getByText("SKU W-1")).toBeInTheDocument();
    expect(screen.getByText("3 left")).toBeInTheDocument();
    expect(screen.getByText("Gadget")).toBeInTheDocument();
    expect(screen.getByText("8 left")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Low Stock Alerts" })
    ).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith(
      "/products/low-stock",
      "GET",
      null,
      { signal: expect.any(AbortSignal) }
    );
  });

  it("shows the empty state when nothing is low", async () => {
    apiRequest.mockResolvedValue({ products: [] });
    render(<InventoryAlerts refreshTrigger={0} />);

    expect(
      await screen.findByText("No products with critically low stock.")
    ).toBeInTheDocument();
  });

  it("shows the error and retries on click", async () => {
    const user = userEvent.setup();
    apiRequest
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValue([]);
    render(<InventoryAlerts refreshTrigger={0} />);

    expect(await screen.findByText("Error: down")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(
      await screen.findByText("No products with critically low stock.")
    ).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledTimes(2);
  });

  it("refetches when refreshTrigger changes", async () => {
    apiRequest.mockResolvedValue([]);
    const { rerender } = render(<InventoryAlerts refreshTrigger={0} />);
    await screen.findByText("No products with critically low stock.");

    rerender(<InventoryAlerts refreshTrigger={1} />);

    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(2));
  });
});
