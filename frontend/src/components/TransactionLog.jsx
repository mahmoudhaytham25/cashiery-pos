import React, { useEffect, useState } from "react";
import { apiRequest } from "../api/api";
import { formatCurrency, formatDate } from "../utils/format";

function TransactionLog() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    apiRequest("/transactions")
      .then(data => {
        if (cancelled) return;
        setTransactions(Array.isArray(data) ? data : data?.transactions ?? []);
      })
      .catch(err => {
        if (cancelled) return;
        setTransactions([]);
        setError(err.message || "Failed to load transactions");
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  return (
    <div className="transaction-log">
      <h4>Transaction Log</h4>
      {loading ? (
        <p>Loading transactions...</p>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : transactions.length === 0 ? (
        <p className="empty-state">No transactions yet.</p>
      ) : (
        <ul>
          {transactions.map(tx => (
            <li key={tx.id}>
              {formatDate(tx.timestamp)}: {tx.username} completed a purchase
              transaction of items with a total value of {formatCurrency(tx.total)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default TransactionLog;
