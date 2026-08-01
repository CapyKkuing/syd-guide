import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FlightDateTimeField } from "./FlightDateTimeField";

function Harness() {
  const [value, setValue] = useState("");
  return (
    <>
      <FlightDateTimeField label="예정 출발" value={value} onChange={setValue} />
      <output>{value}</output>
    </>
  );
}

describe("FlightDateTimeField", () => {
  it("combines a calendar date with a finite 12-hour time selection", () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("예정 출발 날짜"), {
      target: { value: "08/01/2026" },
    });

    const time = within(screen.getByRole("group", { name: "예정 출발 시간" }));
    select(time.getByRole("combobox", { name: "시" }), "11");
    select(time.getByRole("combobox", { name: "분" }), "55");
    select(time.getByRole("combobox", { name: "오전/오후" }), "오후");

    expect(screen.getByText("2026-08-01T23:55")).toBeInTheDocument();
  });
});

function select(trigger: HTMLElement, optionName: string) {
  fireEvent.click(trigger);
  const listboxId = trigger.getAttribute("aria-controls");
  const listbox = listboxId ? document.getElementById(listboxId) : null;
  if (!listbox) throw new Error("시간 선택 목록을 찾지 못했습니다.");
  fireEvent.click(within(listbox).getByRole("option", { name: optionName, hidden: true }));
}
