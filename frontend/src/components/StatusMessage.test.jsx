import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StatusMessage from "./StatusMessage";

describe("StatusMessage", () => {
  it("renders children with the error class by default", () => {
    render(<StatusMessage>Something went wrong</StatusMessage>);

    expect(screen.getByText("Something went wrong")).toHaveClass(
      "error-message"
    );
  });

  it("uses the success class for type=success", () => {
    render(<StatusMessage type="success">All good</StatusMessage>);

    expect(screen.getByText("All good")).toHaveClass("success-message");
  });

  it("renders a Retry button that calls onRetry", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<StatusMessage onRetry={onRetry}>Failed</StatusMessage>);

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders no button when onRetry isn't provided", () => {
    render(<StatusMessage>Failed</StatusMessage>);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
