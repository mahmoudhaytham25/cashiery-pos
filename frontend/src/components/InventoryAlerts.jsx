import React from "react";
import { normalizeProducts } from "../api/api";
import { useFetch } from "../hooks/useFetch";
import StatusMessage from "./StatusMessage";

function InventoryAlerts({ refreshTrigger }) {
  const { data, loading, error, refetch } = useFetch("/products/low-stock", {
    deps: [refreshTrigger],
    transform: normalizeProducts,
    pollInterval: 30000,
  });
  const alerts = data ?? [];

  if (loading && alerts.length === 0) {
    return (
      <div className="inventory-alerts card">
        <p className="empty-state">Loading inventory alerts...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="inventory-alerts card">
        <StatusMessage type="error" onRetry={refetch}>
          Error: {error}
        </StatusMessage>
      </div>
    );
  }

  return (
    <div className="inventory-alerts card">
      <h3>Low Stock Alerts</h3>
      {alerts.length === 0 ? (
        <p className="empty-state">No products with critically low stock.</p>
      ) : (
        <ul>
          {alerts.map(product => (
            <li key={product.id}>
              <span className="alert-text">
                <strong>{product.name}</strong>
                {product.sku && <span className="sku">SKU {product.sku}</span>}
              </span>
              <span className="badge badge-warn">{product.stock} left</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default React.memo(InventoryAlerts);
