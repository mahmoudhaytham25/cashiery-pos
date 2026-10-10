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
    <div className="cart card">
      <h3>Cart ({cart.length} items)</h3>
      {message && <StatusMessage type="success">{message}</StatusMessage>}
      {error && <StatusMessage type="error">{error}</StatusMessage>}
      {cart.length === 0 ? (
        <p className="empty-state">Cart is empty</p>
      ) : (
        <>
          <ul className="cart-items scroll-list">
            {cart.map(item => (
              <li key={item.id} className="cart-item">
                <div className="cart-item-info">
                  <strong className="cart-item-name">{item.name}</strong>
                  <div className="cart-item-meta">
                    {formatCurrency(item.price)} each
                  </div>
                  <div className="qty-row">
                    <button
                      className="qty-btn"
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      aria-label={`Decrease quantity of ${item.name}`}
                    >
                      -
                    </button>
                    <span className="qty-value">{item.quantity}</span>
                    <button
                      className="qty-btn"
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
                </div>
                <div className="cart-item-side">
                  <span className="cart-item-subtotal">
                    {formatCurrency(item.price * item.quantity)}
                  </span>
                  <button
                    className="remove-btn btn-sm"
                    onClick={() => onRemove(item.id)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="cart-total">
            <span>Total</span>
            <span className="cart-total-amount">{formatCurrency(total)}</span>
          </div>
          <button
            className="pay-btn"
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
