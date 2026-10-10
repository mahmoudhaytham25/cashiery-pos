import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import NotFound from "./NotFound";

describe("NotFound", () => {
  it("renders the 404 message with a link home", () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    );

    expect(screen.getByText("404 - Page Not Found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to home" })).toHaveAttribute(
      "href",
      "/"
    );
  });
});
