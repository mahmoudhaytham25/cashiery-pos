import React, { useMemo } from "react";
import { apiRequest } from "../api/api";
import { useSubmit } from "../hooks/useSubmit";
import { formatCurrency } from "../utils/format";
import StatusMessage from "./StatusMessage";

function Cart({ cart, onRemove, onProcessPayment, setCart }) {
  const { submitting, error, message, setMessage, submit } = useSubmit();

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart]
  );

  const handleProcessPayment = async () => {
    if (cart.length === 0) return;

    await submit(async () => {
      // Send only what the server needs — prices/totals are computed server-side.
      await apiRequest("/transactions", "POST", {
        items: cart.map(item => ({
          productId: item.id,
          quantity: item.quantity
        }))
      });

      setCart([]);
      onProcessPayment();
      setMessage("Payment processed successfully!");
    }, (err) => {
      console.error("Payment failed:", err);
      return "Payment failed: " + err.message;
    });
  };

  const updateQuantity = (itemId, newQuantity) => {
    if (newQuantity <= 0) {
      onRemove(itemId);
      return;
    }

    setCart(prev => prev.map(item =>
      item.id === itemId
        ? { ...item, quantity: Math.min(newQuantity, item.stock ?? newQuantity) }
        : item
    ));
  };

  const atStockCap = (item) => item.stock != null && item.quantity >= item.stock;

  return (
    <div>
      <h3>Cart ({cart.length} items)</h3>
      {message && <StatusMessage type="success">{message}</StatusMessage>}
      {error && <StatusMessage type="error">{error}</StatusMessage>}
      {cart.length === 0 ? (
        <p className="empty-state">Cart is empty</p>
      ) : (
        <>
          <ul>
            {cart.map(item => (
              <li key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <div>
                    Price: {formatCurrency(item.price)} each
                  </div>
                  <div>
                    Quantity:
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      aria-label={`Decrease quantity of ${item.name}`}
                    >
                      -
                    </button>
                    <span className="qty-value">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      disabled={atStockCap(item)}
                      aria-label={`Increase quantity of ${item.name}`}
                    >
                      +
                    </button>
                  </div>
                  {atStockCap(item) && (
                    <div className="stock-note">Only {item.stock} in stock</div>
                  )}
                  <div>
                    Subtotal: {formatCurrency(item.price * item.quantity)}
                  </div>
                </div>
                <button onClick={() => onRemove(item.id)}>Remove</button>
              </li>
            ))}
          </ul>
          <div className="cart-total">
            Total: {formatCurrency(total)}
          </div>
          <button
            onClick={handleProcessPayment}
            disabled={cart.length === 0 || submitting}
          >
            {submitting ? "Processing..." : "Process Payment"}
          </button>
        </>
      )}
    </div>
  );
}

export default React.memo(Cart);
