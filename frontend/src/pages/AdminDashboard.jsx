import React, { useCallback, useState } from "react";
import ProductManagement from "../components/ProductManagement";
import InventoryAlerts from "../components/InventoryAlerts";
import SalesSummary from "../components/SalesSummary";
import TransactionLog from "../components/TransactionLog";
import UserRegistration from "../components/UserRegistration";

function AdminDashboard() {
  // Bumped by ProductManagement whenever products change so InventoryAlerts
  // refetches low-stock data.
  const [refreshKey, setRefreshKey] = useState(0);

  const handleProductChange = useCallback(() => setRefreshKey(k => k + 1), []);

  return (
    <div>
      <h2 className="page-title">Admin Dashboard</h2>
      <p className="page-subtitle">Manage products and users, and review sales activity.</p>
      <div className="admin-layout">
        <InventoryAlerts refreshTrigger={refreshKey} />
        <SalesSummary />
        <ProductManagement onProductChange={handleProductChange} />
        <TransactionLog />
        <UserRegistration />
      </div>
    </div>
  );
}

export default AdminDashboard;
