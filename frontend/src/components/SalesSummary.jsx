import React, { useEffect, useState } from "react";
import { apiRequest } from "../api/api";
import { formatCurrency } from "../utils/format";

// Today's date in YYYY-MM-DD format
const todayString = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

function SalesSummary() {
  const [summary, setSummary] = useState(null);
  const [date, setDate] = useState(todayString);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiRequest(`/transactions/summary?date=${date}`, "GET")
      .then(data => { if (!cancelled) setSummary(data); })
      .catch(err => {
        if (!cancelled) {
          setSummary(null);
          setError(err.message || "Failed to load sales summary");
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [date, reloadKey]);

  return (
    <div className="sales-summary">
      <h3>Daily Sales Summary</h3>
      <div className="form-group">
        <label htmlFor="sales-date">Date</label>
        <input
          id="sales-date"
          type="date"
          value={date}
          max={todayString()}
          onChange={e => setDate(e.target.value)}
        />
      </div>
      {loading ? (
        <p>Loading sales summary...</p>
      ) : error ? (
        <div className="error-message">
          {error}
          <div style={{ marginTop: '10px' }}>
            <button type="button" onClick={() => setReloadKey(k => k + 1)}>
              Retry
            </button>
          </div>
        </div>
      ) : !summary ? (
        <p className="empty-state">No sales data available for {date}.</p>
      ) : (
        <div>
          <div>Total Sales: {formatCurrency(summary.totalSales || 0)}</div>
          <div>Transactions: {summary.transactionCount || 0}</div>
        </div>
      )}
    </div>
  );
}

export default SalesSummary;
