import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FormField from "./FormField";

describe("FormField", () => {
  it("associates the label with the input via id", () => {
    render(<FormField id="username-input" label="Username" />);

    const input = screen.getByLabelText("Username");
    expect(input).toHaveAttribute("id", "username-input");
    expect(input).toHaveAttribute("type", "text");
  });

  it("honours the type prop", () => {
    render(<FormField id="pw" label="Password" type="password" />);

    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "type",
      "password"
    );
  });

  it("forwards extra input props", () => {
    render(
      <FormField id="f1" label="Name" placeholder="Enter name" required />
    );

    const input = screen.getByLabelText("Name");
    expect(input).toHaveAttribute("placeholder", "Enter name");
    expect(input).toBeRequired();
  });

  it("calls onChange as the user types", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FormField id="f2" label="Name" value="" onChange={onChange} />);

    await user.type(screen.getByLabelText("Name"), "ab");

    expect(onChange).toHaveBeenCalled();
  });
});
