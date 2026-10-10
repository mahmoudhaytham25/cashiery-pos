import React, { useState } from "react";
import ProductManagement from "../components/ProductManagement";
import InventoryAlerts from "../components/InventoryAlerts";
import SalesSummary from "../components/SalesSummary";
import TransactionLog from "../components/TransactionLog";
import UserRegistration from "../components/UserRegistration";

function AdminDashboard() {
  // Bumped by ProductManagement whenever products change so InventoryAlerts
  // refetches low-stock data.
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div>
      <h2>Admin Dashboard</h2>
      <div className="admin-layout">
        <InventoryAlerts refreshTrigger={refreshKey} />
        <SalesSummary />
        <ProductManagement onProductChange={() => setRefreshKey(k => k + 1)} />
        <TransactionLog />
        <UserRegistration />
      </div>
    </div>
  );
}

export default AdminDashboard;
