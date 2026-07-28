import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { BottomSheet } from "./BottomSheet";

function SheetHarness({ open, children }: { open: boolean; children?: ReactNode }) {
  const [opener, setOpener] = useState<HTMLButtonElement | null>(null);
  return (
    <>
      <button ref={setOpener} type="button">일정 열기</button>
      {open && opener ? (
        <BottomSheet ariaLabel="테스트 상세" onClose={() => undefined} returnFocusTo={opener}>
          {children}
        </BottomSheet>
      ) : null}
    </>
  );
}

afterEach(() => {
  document.body.style.overflow = "";
});

describe("BottomSheet", () => {
  it("restores the opener focus and a nonempty body overflow value after direct unmount", () => {
    document.body.style.overflow = "clip";
    const view = render(<SheetHarness open />);
    const opener = screen.getByRole("button", { name: "일정 열기" });

    expect(document.body.style.overflow).toBe("hidden");
    view.rerender(<SheetHarness open={false} />);

    expect(document.body.style.overflow).toBe("clip");
    expect(opener).toHaveFocus();
  });

  it("skips hidden descendants when cycling between visible tabbables", async () => {
    render(
      <SheetHarness open>
        <button type="button">보이는 동작</button>
        <span hidden><button type="button">숨긴 동작</button></span>
        <div aria-hidden="true"><button type="button">보조 동작</button></div>
      </SheetHarness>
    );

    const close = screen.getByRole("button", { name: "닫기" });
    const visible = screen.getByRole("button", { name: "보이는 동작" });
    expect(close).toHaveFocus();

    await userEvent.tab();
    expect(visible).toHaveFocus();
    await userEvent.tab();
    expect(close).toHaveFocus();
  });

  it("keeps focus in the dialog when Tab starts outside after the last target is removed", () => {
    const view = render(
      <SheetHarness open>
        <button type="button">남은 동작</button>
        <button type="button">제거될 동작</button>
      </SheetHarness>
    );
    const opener = screen.getByRole("button", { name: "일정 열기" });
    const removed = screen.getByRole("button", { name: "제거될 동작" });
    removed.focus();

    view.rerender(<SheetHarness open><button type="button">남은 동작</button></SheetHarness>);
    opener.focus();
    fireEvent.keyDown(document, { key: "Tab" });

    expect(screen.getByRole("button", { name: "닫기" })).toHaveFocus();
  });

  it("focuses the dialog fallback when no tabbables remain", () => {
    render(<SheetHarness open />);
    const dialog = screen.getByRole("dialog", { name: "테스트 상세" });
    const close = screen.getByRole("button", { name: "닫기" });
    close.tabIndex = -1;

    fireEvent.keyDown(document, { key: "Tab" });

    expect(dialog).toHaveFocus();
  });
});
