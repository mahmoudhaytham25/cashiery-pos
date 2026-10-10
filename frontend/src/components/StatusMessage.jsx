import React from "react";

function StatusMessage({ type = "error", onRetry, children }) {
  return (
    <div className={type === "success" ? "success-message" : "error-message"}>
      {children}
      {onRetry && (
        <div className="status-retry">
          <button type="button" onClick={onRetry}>
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

export default StatusMessage;
