import { formatCurrency, formatDate } from "./format";

describe("formatCurrency", () => {
  it("formats string DECIMAL input", () => {
    expect(formatCurrency("12.5")).toBe("$12.50");
    expect(formatCurrency("0.1")).toBe("$0.10");
  });

  it("formats numeric input", () => {
    expect(formatCurrency(0)).toBe("$0.00");
    expect(formatCurrency(1234.5)).toBe("$1,234.50");
  });

  it("falls back to $0.00 for non-finite input", () => {
    expect(formatCurrency("not-a-number")).toBe("$0.00");
    expect(formatCurrency(undefined)).toBe("$0.00");
    expect(formatCurrency(NaN)).toBe("$0.00");
    expect(formatCurrency(Infinity)).toBe("$0.00");
  });
});

describe("formatDate", () => {
  it("returns an empty string for invalid input", () => {
    expect(formatDate("not-a-date")).toBe("");
    expect(formatDate(undefined)).toBe("");
    expect(formatDate(null)).toBe("");
  });

  it("formats a valid date", () => {
    const iso = "2024-01-15T10:30:00Z";
    expect(formatDate(iso)).toBe(new Date(iso).toLocaleString());
  });
});
