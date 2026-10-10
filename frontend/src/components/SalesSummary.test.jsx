import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiRequest } from "../api/api";
import SalesSummary from "./SalesSummary";

vi.mock("../api/api", () => ({ apiRequest: vi.fn() }));

describe("SalesSummary", () => {
  beforeEach(() => {
    apiRequest.mockReset();
  });

  it("shows the loading state", () => {
    apiRequest.mockReturnValue(new Promise(() => {}));
    render(<SalesSummary />);

    expect(
      screen.getByText("Loading sales summary...")
    ).toBeInTheDocument();
  });

  it("renders the day's totals", async () => {
    apiRequest.mockResolvedValue({
      totalSales: "123.45",
      transactionCount: 7,
    });
    render(<SalesSummary />);

    expect(
      screen.getByRole("heading", { name: "Daily Sales Summary" })
    ).toBeInTheDocument();
    expect(await screen.findByText("$123.45")).toBeInTheDocument();
    expect(screen.getByText("Total Sales")).toBeInTheDocument();
    expect(screen.getByText("Transactions")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith(
      expect.stringMatching(/^\/transactions\/summary\?date=\d{4}-\d{2}-\d{2}$/),
      "GET",
      null,
      { signal: expect.any(AbortSignal) }
    );
  });

  it("shows zeroed stats when the summary is an empty object", async () => {
    apiRequest.mockResolvedValue({});
    render(<SalesSummary />);

    expect(await screen.findByText("$0.00")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("shows the empty state when there is no summary", async () => {
    apiRequest.mockResolvedValue(null);
    render(<SalesSummary />);

    expect(
      await screen.findByText(/No sales data available for/)
    ).toBeInTheDocument();
  });

  it("shows the error and retries on click", async () => {
    const user = userEvent.setup();
    apiRequest
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValue({ totalSales: 1, transactionCount: 1 });
    render(<SalesSummary />);

    expect(await screen.findByText("down")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Total Sales")).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledTimes(2);
  });

  it("refetches for the newly picked date", async () => {
    apiRequest.mockResolvedValue(null);
    render(<SalesSummary />);
    await screen.findByText(/No sales data available for/);

    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2024-06-15" },
    });

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith(
        "/transactions/summary?date=2024-06-15",
        "GET",
        null,
        { signal: expect.any(AbortSignal) }
      )
    );
  });
});
