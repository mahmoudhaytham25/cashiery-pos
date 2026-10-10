const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

// Postgres returns DECIMAL columns as strings — coerce before formatting.
export const formatCurrency = (value) => {
  const num = Number(value);
  return currencyFormatter.format(Number.isFinite(num) ? num : 0);
};

export const formatDate = (value) => {
  if (value == null) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
};
