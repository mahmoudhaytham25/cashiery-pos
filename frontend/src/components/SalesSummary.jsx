import React, { useState } from "react";
import { useFetch } from "../hooks/useFetch";
import { formatCurrency } from "../utils/format";
import FormField from "./FormField";
import StatusMessage from "./StatusMessage";

// Today's date in YYYY-MM-DD format
const todayString = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

function SalesSummary() {
  const [date, setDate] = useState(todayString);
  const { data: summary, loading, error, refetch } = useFetch(
    `/transactions/summary?date=${date}`,
    { deps: [date] }
  );

  return (
    <div className="sales-summary card">
      <h3>Daily Sales Summary</h3>
      <FormField
        id="sales-date"
        label="Date"
        type="date"
        value={date}
        max={todayString()}
        onChange={e => setDate(e.target.value)}
        className="form-input"
      />
      {loading ? (
        <p className="empty-state">Loading sales summary...</p>
      ) : error ? (
        <StatusMessage type="error" onRetry={refetch}>
          {error}
        </StatusMessage>
      ) : !summary ? (
        <p className="empty-state">No sales data available for {date}.</p>
      ) : (
        <div className="summary-stats">
          <div className="stat">
            <span className="stat-label">Total Sales</span>
            <span className="stat-value">
              {formatCurrency(summary.totalSales || 0)}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Transactions</span>
            <span className="stat-value">{summary.transactionCount || 0}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(SalesSummary);
