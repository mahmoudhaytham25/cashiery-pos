import React from "react";
import { render, screen } from "@testing-library/react";
import { apiRequest } from "../api/api";
import TransactionLog from "./TransactionLog";

// Keep the real normalizers; only the transport is mocked.
vi.mock("../api/api", async (importOriginal) => {
  const mod = await importOriginal();
  return { ...mod, apiRequest: vi.fn() };
});

describe("TransactionLog", () => {
  beforeEach(() => {
    apiRequest.mockReset();
  });

  it("shows the loading state", () => {
    apiRequest.mockReturnValue(new Promise(() => {}));
    render(<TransactionLog />);

    expect(screen.getByText("Loading transactions...")).toBeInTheDocument();
  });

  it("renders transaction rows", async () => {
    apiRequest.mockResolvedValue([
      {
        id: 1,
        username: "boss",
        timestamp: "2024-06-15T10:30:00Z",
        total: "25.50",
      },
      { id: 2, username: "till", timestamp: "2024-06-15T11:00:00Z", total: 10 },
    ]);
    render(<TransactionLog />);

    expect(await screen.findByText("boss")).toBeInTheDocument();
    expect(screen.getByText("till")).toBeInTheDocument();
    expect(screen.getByText("$25.50")).toBeInTheDocument();
    expect(screen.getByText("$10.00")).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith("/transactions", "GET", null, {
      signal: expect.any(AbortSignal),
    });
  });

  it("shows the empty state", async () => {
    // The endpoint may return a { transactions: [...] } envelope.
    apiRequest.mockResolvedValue({ transactions: [] });
    render(<TransactionLog />);

    expect(await screen.findByText("No transactions yet.")).toBeInTheDocument();
  });

  it("shows the error message when the fetch fails", async () => {
    apiRequest.mockRejectedValue(new Error("down"));
    render(<TransactionLog />);

    expect(await screen.findByText("down")).toBeInTheDocument();
  });
});
