import React, { useEffect, useState } from "react";
import { apiRequest, normalizeProducts } from "../api/api";

function InventoryAlerts({ refreshTrigger }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timeoutId;

    const load = async () => {
      try {
        const data = await apiRequest("/products/low-stock");
        if (cancelled) return;
        setAlerts(normalizeProducts(data));
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err.message || "Failed to load inventory alerts");
        console.error("API Error:", err);
      } finally {
        if (!cancelled) {
          setLoading(false);
          // Schedule the next poll only after this request settles, so
          // requests never overlap.
          timeoutId = setTimeout(load, 30000);
        }
      }
    };

    setLoading(true);
    load();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [refreshTrigger, reloadKey]);

  if (loading && alerts.length === 0) {
    return <div>Loading inventory alerts...</div>;
  }

  if (error) {
    return (
      <div className="error-message">
        Error: {error}
        <div style={{ marginTop: '10px' }}>
          <button onClick={() => setReloadKey(k => k + 1)}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="inventory-alerts">
      <h3>Low Stock Alerts</h3>
      {alerts.length === 0 ? (
        <p className="empty-state">No products with critically low stock.</p>
      ) : (
        <ul>
          {alerts.map(product => (
            <li key={product.id}>
              <strong>{product.name}</strong> - Only {product.stock} units left
              {product.sku && ` (SKU: ${product.sku})`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default InventoryAlerts;
