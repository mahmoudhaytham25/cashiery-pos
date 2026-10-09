import React, { useEffect, useState } from "react";
import { apiRequest } from "../api/api";

function SalesSummary() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get today's date in YYYY-MM-DD format
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    apiRequest(`/transactions/summary?date=${todayStr}`, "GET")
      .then(data => setSummary(data))
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading sales summary...</div>;
  if (!summary) return <div><h3>Daily Sales Summary</h3>No sales data available.</div>;

  return (
    <div>
      <h3>Daily Sales Summary</h3>
      <div>Total Sales: ${summary.totalSales || 0}</div>
      <div>Transactions: {summary.transactionCount || 0}</div>
    </div>
  );
}

export default SalesSummary;