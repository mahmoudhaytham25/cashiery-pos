import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiRequest } from "../api/api";
import ProductManagement from "./ProductManagement";

// Keep the real normalizers; only the transport is mocked.
vi.mock("../api/api", async (importOriginal) => {
  const mod = await importOriginal();
  return { ...mod, apiRequest: vi.fn() };
});

const product = (overrides = {}) => ({
  id: 1,
  name: "Widget",
  price: "9.99",
  stock: 5,
  SKU: "W-1",
  ...overrides,
});

// GETs resolve to `data`; every mutation resolves to a stub row.
const mockApi = (data) =>
  apiRequest.mockImplementation((endpoint, method = "GET") =>
    Promise.resolve(method === "GET" ? data : { ok: true })
  );

describe("ProductManagement", () => {
  beforeEach(() => {
    apiRequest.mockReset();
  });

  it("shows the loading state while the first fetch is in flight", () => {
    apiRequest.mockReturnValue(new Promise(() => {}));

    render(<ProductManagement />);

    expect(screen.getByText("Loading products...")).toBeInTheDocument();
  });

  it("renders fetched products sorted by name", async () => {
    // The endpoint may also return a { products: [...] } envelope.
    mockApi({
      products: [
        product({ id: 2, name: "Zebra", stock: 20 }),
        product({ id: 1, name: "Apple", stock: 30 }),
      ],
    });
    render(<ProductManagement />);

    const items = await screen.findAllByRole("listitem");
    expect(within(items[0]).getByText("Apple")).toBeInTheDocument();
    expect(within(items[1]).getByText("Zebra")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Current Products (2)" })
    ).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith("/products", "GET", null, {
      signal: expect.any(AbortSignal),
    });
  });

  it("flags products under the low-stock threshold", async () => {
    mockApi([
      product({ stock: 4 }),
      product({ id: 2, name: "Gadget", stock: 50 }),
    ]);
    render(<ProductManagement />);

    await screen.findByText("Gadget");

    // Only Widget (4 < 10) is flagged.
    expect(screen.getByText("Low stock")).toBeInTheDocument();
    expect(screen.getByText("$9.99 · 4 in stock")).toBeInTheDocument();
  });

  it("shows the empty state when no products exist", async () => {
    mockApi([]);
    render(<ProductManagement />);

    expect(await screen.findByText("No products found.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Current Products (0)" })
    ).toBeInTheDocument();
  });

  it("shows an error when the product fetch fails", async () => {
    apiRequest.mockRejectedValue(new Error("down"));
    render(<ProductManagement />);

    expect(
      await screen.findByText("Failed to fetch products: down")
    ).toBeInTheDocument();
  });

  it("adds a product, refetches, and fires onProductChange", async () => {
    const user = userEvent.setup();
    const onProductChange = vi.fn();
    mockApi([]);
    render(<ProductManagement onProductChange={onProductChange} />);
    await screen.findByText("No products found.");

    await user.type(screen.getByLabelText("Product Name"), "Widget");
    await user.type(screen.getByLabelText("Price"), "9.99");
    await user.type(screen.getByLabelText("Stock Quantity"), "5");
    await user.type(screen.getByLabelText("SKU (optional)"), "W-1");
    await user.click(screen.getByRole("button", { name: "Add Product" }));

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith(
        "/products",
        "POST",
        { name: "Widget", price: 9.99, stock: 5, SKU: "W-1" },
        { signal: expect.any(AbortSignal) }
      )
    );
    expect(
      await screen.findByText("Product added successfully.")
    ).toBeInTheDocument();
    expect(onProductChange).toHaveBeenCalledTimes(1);
    // initial GET + POST + refresh GET
    expect(apiRequest).toHaveBeenCalledTimes(3);
  });

  it("posts a null SKU when the field is left blank", async () => {
    const user = userEvent.setup();
    mockApi([]);
    render(<ProductManagement />);
    await screen.findByText("No products found.");

    await user.type(screen.getByLabelText("Product Name"), "Widget");
    await user.type(screen.getByLabelText("Price"), "9.99");
    await user.type(screen.getByLabelText("Stock Quantity"), "5");
    await user.click(screen.getByRole("button", { name: "Add Product" }));

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith(
        "/products",
        "POST",
        { name: "Widget", price: 9.99, stock: 5, SKU: null },
        { signal: expect.any(AbortSignal) }
      )
    );
  });

  it("rejects a whitespace-only name", async () => {
    const user = userEvent.setup();
    mockApi([]);
    render(<ProductManagement />);
    await screen.findByText("No products found.");

    // Spaces satisfy the `required` attribute but not the trimmed check.
    await user.type(screen.getByLabelText("Product Name"), "   ");
    await user.type(screen.getByLabelText("Price"), "9.99");
    await user.type(screen.getByLabelText("Stock Quantity"), "5");
    await user.click(screen.getByRole("button", { name: "Add Product" }));

    expect(
      await screen.findByText("Product name is required.")
    ).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledTimes(1); // only the initial GET
  });

  it("rejects a missing price", async () => {
    const user = userEvent.setup();
    mockApi([]);
    render(<ProductManagement />);
    await screen.findByText("No products found.");

    // `required` would block submission before the JS validation runs.
    screen.getByLabelText("Price").removeAttribute("required");
    await user.type(screen.getByLabelText("Product Name"), "Widget");
    await user.type(screen.getByLabelText("Stock Quantity"), "5");
    await user.click(screen.getByRole("button", { name: "Add Product" }));

    expect(
      await screen.findByText("Price must be a valid non-negative number.")
    ).toBeInTheDocument();
  });

  it("rejects a negative price", async () => {
    const user = userEvent.setup();
    mockApi([]);
    render(<ProductManagement />);
    await screen.findByText("No products found.");

    // Remove `min` so the browser validation lets our own check run.
    screen.getByLabelText("Price").removeAttribute("min");
    await user.type(screen.getByLabelText("Product Name"), "Widget");
    await user.type(screen.getByLabelText("Price"), "-1");
    await user.type(screen.getByLabelText("Stock Quantity"), "5");
    await user.click(screen.getByRole("button", { name: "Add Product" }));

    expect(
      await screen.findByText("Price must be a valid non-negative number.")
    ).toBeInTheDocument();
  });

  it("rejects a missing stock quantity", async () => {
    const user = userEvent.setup();
    mockApi([]);
    render(<ProductManagement />);
    await screen.findByText("No products found.");

    screen.getByLabelText("Stock Quantity").removeAttribute("required");
    await user.type(screen.getByLabelText("Product Name"), "Widget");
    await user.type(screen.getByLabelText("Price"), "9.99");
    await user.click(screen.getByRole("button", { name: "Add Product" }));

    expect(
      await screen.findByText("Stock must be a whole number (0 or greater).")
    ).toBeInTheDocument();
  });

  it("shows the server error when the add fails", async () => {
    const user = userEvent.setup();
    apiRequest.mockImplementation((endpoint, method = "GET") =>
      method === "GET"
        ? Promise.resolve([])
        : Promise.reject(new Error("duplicate SKU"))
    );
    render(<ProductManagement />);
    await screen.findByText("No products found.");

    await user.type(screen.getByLabelText("Product Name"), "Widget");
    await user.type(screen.getByLabelText("Price"), "9.99");
    await user.type(screen.getByLabelText("Stock Quantity"), "5");
    await user.click(screen.getByRole("button", { name: "Add Product" }));

    expect(await screen.findByText("duplicate SKU")).toBeInTheDocument();
  });

  it("populates the form on Edit and PUTs the update", async () => {
    const user = userEvent.setup();
    const onProductChange = vi.fn();
    mockApi([product()]);
    render(<ProductManagement onProductChange={onProductChange} />);
    await screen.findByText("Widget");

    await user.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByLabelText("Product Name")).toHaveValue("Widget");
    expect(screen.getByLabelText("Price")).toHaveValue(9.99);
    expect(screen.getByLabelText("Stock Quantity")).toHaveValue(5);
    expect(screen.getByLabelText("SKU (optional)")).toHaveValue("W-1");
    expect(
      screen.getByRole("button", { name: "Update Product" })
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText("Product Name"), " Pro");
    await user.click(screen.getByRole("button", { name: "Update Product" }));

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith(
        "/products/1",
        "PUT",
        { name: "Widget Pro", price: 9.99, stock: 5, SKU: "W-1" },
        { signal: expect.any(AbortSignal) }
      )
    );
    expect(
      await screen.findByText("Product updated successfully.")
    ).toBeInTheDocument();
    expect(onProductChange).toHaveBeenCalledTimes(1);
    // Form resets back to add-mode.
    expect(screen.getByLabelText("Product Name")).toHaveValue("");
    expect(
      screen.getByRole("button", { name: "Add Product" })
    ).toBeInTheDocument();
  });

  it("Cancel Edit restores the empty add form", async () => {
    const user = userEvent.setup();
    mockApi([product()]);
    render(<ProductManagement />);
    await screen.findByText("Widget");

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Cancel Edit" }));

    expect(screen.getByLabelText("Product Name")).toHaveValue("");
    expect(
      screen.getByRole("button", { name: "Add Product" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cancel Edit" })
    ).not.toBeInTheDocument();
  });

  it("requires a second click to confirm deletion", async () => {
    const user = userEvent.setup();
    const onProductChange = vi.fn();
    mockApi([product()]);
    render(<ProductManagement onProductChange={onProductChange} />);
    await screen.findByText("Widget");

    await user.click(screen.getByRole("button", { name: "Delete" }));

    // Inline confirm: the button flips to "Confirm?" — nothing sent yet.
    expect(
      screen.getByRole("button", { name: "Confirm?" })
    ).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledTimes(1); // only the initial GET

    await user.click(screen.getByRole("button", { name: "Confirm?" }));

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith("/products/1", "DELETE", null, {
        signal: expect.any(AbortSignal),
      })
    );
    expect(await screen.findByText("Product deleted.")).toBeInTheDocument();
    expect(onProductChange).toHaveBeenCalledTimes(1);
    // initial GET + DELETE + refresh GET
    expect(apiRequest).toHaveBeenCalledTimes(3);
  });

  it("shows an error when deletion fails", async () => {
    const user = userEvent.setup();
    apiRequest.mockImplementation((endpoint, method = "GET") =>
      method === "GET"
        ? Promise.resolve([product()])
        : Promise.reject(new Error("db gone"))
    );
    render(<ProductManagement />);
    await screen.findByText("Widget");

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Confirm?" }));

    expect(
      await screen.findByText("Failed to delete product: db gone")
    ).toBeInTheDocument();
  });
});
