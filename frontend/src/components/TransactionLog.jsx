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
    <div className="transaction-log card">
      <h4>Transaction Log</h4>
      {loading ? (
        <p className="empty-state">Loading transactions...</p>
      ) : error ? (
        <StatusMessage type="error">{error}</StatusMessage>
      ) : transactions.length === 0 ? (
        <p className="empty-state">No transactions yet.</p>
      ) : (
        <ul className="transaction-list scroll-list">
          {transactions.map(tx => (
            <li key={tx.id}>
              <div className="tx-info">
                <span className="tx-user">{tx.username}</span>
                <span className="tx-date">{formatDate(tx.timestamp)}</span>
              </div>
              <span className="tx-amount">{formatCurrency(tx.total)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default React.memo(TransactionLog);
