import React from "react";
import { act, render, screen } from "@testing-library/react";
import POS from "./POS";

let cartProps;
let searchProps;

// Children are stubbed; tests drive the page's cart state through the
// callbacks it passes down and assert on the latest props.
vi.mock("../components/ProductSearch", () => ({
  default: (props) => {
    searchProps = props;
    return <div data-testid="search" />;
  },
}));
vi.mock("../components/Cart", () => ({
  default: (props) => {
    cartProps = props;
    return <div data-testid="cart" />;
  },
}));

const product = (overrides = {}) => ({
  id: 1,
  name: "Widget",
  price: 5,
  stock: 10,
  ...overrides,
});

const addToCart = (p) => act(() => searchProps.onAddToCart(p));

describe("POS", () => {
  beforeEach(() => {
    cartProps = undefined;
    searchProps = undefined;
  });

  it("renders the layout with an empty cart", () => {
    render(<POS />);

    expect(screen.getByText("Point of Sale System")).toBeInTheDocument();
    expect(cartProps.cart).toEqual([]);
  });

  it("adds a new product with quantity 1, then increments on re-add", () => {
    render(<POS />);

    addToCart(product());
    expect(cartProps.cart).toEqual([{ ...product(), quantity: 1 }]);

    addToCart(product());
    expect(cartProps.cart).toEqual([{ ...product(), quantity: 2 }]);
  });

  it("does not add beyond available stock", () => {
    render(<POS />);
    const limited = product({ stock: 1 });

    addToCart(limited);
    addToCart(limited);

    expect(cartProps.cart).toEqual([{ ...limited, quantity: 1 }]);
  });

  it("removes an item by id", () => {
    render(<POS />);
    addToCart(product());
    addToCart(product({ id: 2, name: "Gadget" }));

    act(() => cartProps.onRemove(1));

    expect(cartProps.cart).toEqual([
      { ...product({ id: 2, name: "Gadget" }), quantity: 1 },
    ]);
  });

  it("bumps ProductSearch's refreshKey after payment so stock refetches", () => {
    render(<POS />);
    const initial = searchProps.refreshKey;

    act(() => cartProps.onProcessPayment());

    expect(searchProps.refreshKey).toBe(initial + 1);
  });
});
