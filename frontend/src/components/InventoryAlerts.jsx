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
    return <div>Loading inventory alerts...</div>;
  }

  if (error) {
    return (
      <StatusMessage type="error" onRetry={refetch}>
        Error: {error}
      </StatusMessage>
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

export default React.memo(InventoryAlerts);
