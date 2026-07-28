import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";

const tabbableSelector = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "[contenteditable='true']",
  "[tabindex]"
].join(", ");

function isTabbable(element: HTMLElement): boolean {
  if (!element.isConnected || element.matches(":disabled")) return false;
  const tabindex = element.getAttribute("tabindex");
  if (tabindex !== null && Number(tabindex) < 0) return false;

  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    if (current.hidden || current.getAttribute("aria-hidden") === "true" || current.hasAttribute("inert")) {
      return false;
    }
    const style = window.getComputedStyle(current);
    if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") {
      return false;
    }
  }
  return true;
}

function tabbableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(tabbableSelector)).filter(isTabbable);
}

export function BottomSheet({
  ariaLabel,
  onClose,
  returnFocusTo,
  children
}: {
  ariaLabel: string;
  onClose: () => void;
  returnFocusTo: HTMLElement | null;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef(returnFocusTo);

  useEffect(() => {
    returnFocusRef.current = returnFocusTo;
  }, [returnFocusTo]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus();
    };
  }, []);

  useEffect(() => {
    const captureKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const tabbables = tabbableElements(dialog);
      const first = tabbables[0];
      const last = tabbables.at(-1);
      if (!first || !last) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const activeElement = document.activeElement;
      if (!dialog.contains(activeElement) || !tabbables.includes(activeElement as HTMLElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", captureKeyboard, true);
    return () => document.removeEventListener("keydown", captureKeyboard, true);
  }, [onClose]);

  return (
    <div
      className="sheet-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        aria-label={ariaLabel}
        aria-modal="true"
        className="sheet"
        role="dialog"
        tabIndex={-1}
      >
        <button ref={closeRef} aria-label="닫기" className="sheet__close" onClick={onClose} type="button">
          <Icon name="close" />
        </button>
        {children}
      </section>
    </div>
  );
}
