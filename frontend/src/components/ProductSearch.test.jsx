import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiRequest } from "../api/api";
import ProductSearch from "./ProductSearch";

// Keep the real normalizers; only the transport is mocked.
vi.mock("../api/api", async (importOriginal) => {
  const mod = await importOriginal();
  return { ...mod, apiRequest: vi.fn() };
});

describe("ProductSearch", () => {
  beforeEach(() => {
    apiRequest.mockReset();
  });

  it("loads all products via Show All Products", async () => {
    const user = userEvent.setup();
    apiRequest.mockResolvedValue([
      { id: 1, name: "Widget", price: "9.99", stock: 5, SKU: "W-1" },
    ]);
    render(<ProductSearch onAddToCart={vi.fn()} />);

    await user.click(
      screen.getByRole("button", { name: /show all products/i })
    );

    expect(apiRequest).toHaveBeenCalledWith(
      "/products",
      "GET",
      null,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(await screen.findByText("Widget")).toBeInTheDocument();
    expect(screen.getByText(/W-1/)).toBeInTheDocument();
  });

  it("searches with an encoded query", async () => {
    const user = userEvent.setup();
    apiRequest.mockResolvedValue([]);
    render(<ProductSearch onAddToCart={vi.fn()} />);

    await user.type(
      screen.getByLabelText("Product name or barcode"),
      "wid get"
    );
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(apiRequest).toHaveBeenCalledWith(
      "/products?search=wid%20get",
      "GET",
      null,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(
      await screen.findByText('No products found for "wid get".')
    ).toBeInTheDocument();
  });

  it("does not search on an empty query", async () => {
    const user = userEvent.setup();
    render(<ProductSearch onAddToCart={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(apiRequest).not.toHaveBeenCalled();
  });

  it("calls onAddToCart and disables out-of-stock items", async () => {
    const user = userEvent.setup();
    apiRequest.mockResolvedValue([
      { id: 1, name: "Widget", price: "9.99", stock: 3 },
      { id: 2, name: "Gadget", price: "5.00", stock: 0 },
    ]);
    const onAddToCart = vi.fn();
    render(<ProductSearch onAddToCart={onAddToCart} />);

    await user.click(
      screen.getByRole("button", { name: /show all products/i })
    );
    await screen.findByText("Widget");

    expect(
      screen.getByRole("button", { name: "Out of Stock" })
    ).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Add to Cart" }));

    expect(onAddToCart).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, name: "Widget" })
    );
  });

  it("shows an error message when the fetch fails", async () => {
    const user = userEvent.setup();
    apiRequest.mockRejectedValue(new Error("down"));
    render(<ProductSearch onAddToCart={vi.fn()} />);

    await user.click(
      screen.getByRole("button", { name: /show all products/i })
    );

    expect(
      await screen.findByText("Failed to load products: down")
    ).toBeInTheDocument();
  });
});
