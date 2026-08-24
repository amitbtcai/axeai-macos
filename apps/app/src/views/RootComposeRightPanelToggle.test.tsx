// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RootComposeRightPanelToggle } from "./RootComposeView";

afterEach(cleanup);

describe("RootComposeRightPanelToggle", () => {
  it("places the Axe AI logo before the right-panel control", () => {
    render(<RootComposeRightPanelToggle isOpen={false} onToggle={vi.fn()} />);

    const logo = screen.getByRole("link", { name: "Visit Axe AI website" });
    const button = screen.getByRole("button", { name: "Show right panel" });

    expect(logo.getAttribute("href")).toBe("https://axeai.com");
    expect(logo.querySelector("svg")).not.toBeNull();

    expect(
      logo.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("uses a disclosure state without painting the whole click target as selected", () => {
    const onToggle = vi.fn();

    render(<RootComposeRightPanelToggle isOpen onToggle={onToggle} />);

    const button = screen.getByRole("button", { name: "Hide right panel" });
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(button.getAttribute("aria-pressed")).toBeNull();

    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
