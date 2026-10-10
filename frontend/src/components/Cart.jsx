import React, { useState } from "react";
import { apiRequest } from "../api/api";
import { formatCurrency } from "../utils/format";

function Cart({ cart, onRemove, onProcessPayment, setCart }) {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleProcessPayment = async () => {
    if (cart.length === 0 || submitting) return;

    setSubmitting(true);
    setMessage("");
    setError("");
    try {
      // Send only what the server needs — prices/totals are computed server-side.
      await apiRequest("/transactions", "POST", {
        items: cart.map(item => ({
          productId: item.id,
          quantity: item.quantity
        }))
      });

      if (setCart) {
        setCart([]);
      }
      if (onProcessPayment) {
        onProcessPayment();
      }
      setMessage("Payment processed successfully!");
    } catch (err) {
      console.error("Payment failed:", err);
      setError("Payment failed: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const updateQuantity = (itemId, newQuantity) => {
    if (newQuantity <= 0) {
      onRemove(itemId);
      return;
    }

    if (setCart) {
      setCart(prev => prev.map(item =>
        item.id === itemId
          ? { ...item, quantity: Math.min(newQuantity, item.stock ?? newQuantity) }
          : item
      ));
    }
  };

  const atStockCap = (item) => item.stock != null && item.quantity >= item.stock;

  return (
    <div>
      <h3>Cart ({cart.length} items)</h3>
      {message && <div className="success-message">{message}</div>}
      {error && <div className="error-message">{error}</div>}
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
                    <span style={{ margin: '0 0.5rem' }}>{item.quantity}</span>
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
          <div style={{ fontSize: '1.2rem', fontWeight: 'bold', margin: '1rem 0' }}>
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

export default Cart;
