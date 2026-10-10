import { useState } from "react";

// Shared submit flow: guard against re-entry, clear feedback, run fn, and
// capture errors. `formatError` maps a caught error to the shown message.
export function useSubmit() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const submit = async (fn, formatError = (err) => err.message) => {
    if (submitting) return;
    setError("");
    setMessage("");
    setSubmitting(true);
    try {
      await fn();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const clear = () => {
    setError("");
    setMessage("");
  };

  return { submitting, error, setError, message, setMessage, submit, clear };
}
