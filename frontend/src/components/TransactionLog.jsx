import React from "react";
import { normalizeTransactions } from "../api/api";
import { useFetch } from "../hooks/useFetch";
import { formatCurrency, formatDate } from "../utils/format";
import StatusMessage from "./StatusMessage";

function TransactionLog() {
  const { data, loading, error } = useFetch("/transactions", {
    transform: normalizeTransactions,
  });
  const transactions = data ?? [];

  return (
    <div className="transaction-log">
      <h4>Transaction Log</h4>
      {loading ? (
        <p>Loading transactions...</p>
      ) : error ? (
        <StatusMessage type="error">{error}</StatusMessage>
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

export default React.memo(TransactionLog);
