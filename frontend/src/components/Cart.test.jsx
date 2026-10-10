import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiRequest } from "../api/api";
import Cart from "./Cart";

vi.mock("../api/api", () => ({ apiRequest: vi.fn() }));

const item = (overrides = {}) => ({
  id: 1,
  name: "Widget",
  price: 12.5,
  quantity: 1,
  stock: 5,
  ...overrides,
});

const renderCart = ({
  cart = [],
  onRemove = vi.fn(),
  onProcessPayment = vi.fn(),
  setCart = vi.fn(),
} = {}) => {
  const props = { cart, onRemove, onProcessPayment, setCart };
  render(<Cart {...props} />);
  return props;
};

describe("Cart", () => {
  beforeEach(() => {
    apiRequest.mockReset();
  });

  it("shows the empty-cart state", () => {
    renderCart();

    expect(screen.getByText("Cart (0 items)")).toBeInTheDocument();
    expect(screen.getByText("Cart is empty")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Process Payment" })
    ).not.toBeInTheDocument();
  });

  it("lists items and shows the formatted total", () => {
    renderCart({
      cart: [
        item({ price: 12.5, quantity: 2 }),
        item({ id: 2, name: "Gadget", price: 5, quantity: 1 }),
      ],
    });

    expect(screen.getByText("Cart (2 items)")).toBeInTheDocument();
    expect(screen.getByText("Widget")).toBeInTheDocument();
    expect(screen.getByText("Gadget")).toBeInTheDocument();
    // 12.50 * 2 + 5 * 1
    expect(screen.getByText("$30.00")).toBeInTheDocument();
  });

  it("increases quantity via the + button", async () => {
    const user = userEvent.setup();
    const { setCart } = renderCart({ cart: [item()] });

    await user.click(
      screen.getByRole("button", { name: "Increase quantity of Widget" })
    );

    const updater = setCart.mock.calls[0][0];
    expect(updater([item()])).toEqual([item({ quantity: 2 })]);
  });

  it("decreases quantity via the - button", async () => {
    const user = userEvent.setup();
    const { setCart } = renderCart({ cart: [item({ quantity: 2 })] });

    await user.click(
      screen.getByRole("button", { name: "Decrease quantity of Widget" })
    );

    const updater = setCart.mock.calls[0][0];
    expect(updater([item({ quantity: 2 })])).toEqual([item({ quantity: 1 })]);
  });

  it("removes the item when quantity drops to zero", async () => {
    const user = userEvent.setup();
    const { onRemove, setCart } = renderCart({ cart: [item({ quantity: 1 })] });

    await user.click(
      screen.getByRole("button", { name: "Decrease quantity of Widget" })
    );

    expect(onRemove).toHaveBeenCalledWith(1);
    expect(setCart).not.toHaveBeenCalled();
  });

  it("caps quantity at stock and disables +", async () => {
    const user = userEvent.setup();
    const { setCart } = renderCart({ cart: [item({ quantity: 5, stock: 5 })] });

    const increase = screen.getByRole("button", {
      name: "Increase quantity of Widget",
    });
    expect(increase).toBeDisabled();
    expect(screen.getByText("Only 5 in stock")).toBeInTheDocument();

    await user.click(increase);
    // Disabled — clicking must not change the cart.
    expect(setCart).not.toHaveBeenCalled();
  });

  it("calls onRemove from the Remove button", async () => {
    const user = userEvent.setup();
    const { onRemove } = renderCart({ cart: [item()] });

    await user.click(screen.getByRole("button", { name: "Remove" }));

    expect(onRemove).toHaveBeenCalledWith(1);
  });

  it("posts the transaction and clears the cart on Process Payment", async () => {
    const user = userEvent.setup();
    apiRequest.mockResolvedValue({ id: 9 });
    const { setCart, onProcessPayment } = renderCart({
      cart: [
        item({ quantity: 2 }),
        item({ id: 2, name: "Gadget", price: 5, quantity: 1 }),
      ],
    });

    await user.click(
      screen.getByRole("button", { name: "Process Payment" })
    );

    expect(apiRequest).toHaveBeenCalledWith("/transactions", "POST", {
      items: [
        { productId: 1, quantity: 2 },
        { productId: 2, quantity: 1 },
      ],
    });
    expect(setCart).toHaveBeenCalledWith([]);
    expect(onProcessPayment).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText("Payment processed successfully!")
    ).toBeInTheDocument();
  });

  it("shows the failure message when payment fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    apiRequest.mockRejectedValue(new Error("insufficient stock"));
    const { setCart, onProcessPayment } = renderCart({ cart: [item()] });

    await user.click(
      screen.getByRole("button", { name: "Process Payment" })
    );

    expect(
      await screen.findByText("Payment failed: insufficient stock")
    ).toBeInTheDocument();
    expect(setCart).not.toHaveBeenCalledWith([]);
    expect(onProcessPayment).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
