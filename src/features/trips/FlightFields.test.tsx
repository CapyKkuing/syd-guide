import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FlightFields } from "./FlightFields";
import { emptyFlightDraft } from "./flightDraft";

function FlightFieldsHarness() {
  const [flight, setFlight] = useState(emptyFlightDraft());
  return (
    <FlightFields
      label="출국편"
      value={flight}
      onChange={setFlight}
      onRemove={vi.fn()}
    />
  );
}

describe("FlightFields search inputs", () => {
  it("uses consistent selectors, hides IATA inputs, and keeps manual entry available", async () => {
    render(<FlightFieldsHarness />);
    const flight = within(screen.getByRole("group", { name: "출국편" }));

    chooseOption(flight.getByRole("button", { name: /^항공사/ }), "KE", /KE · 대한항공/);
    expect(flight.getByRole("button", { name: /^항공사/ })).toHaveTextContent("대한항공");

    chooseOption(flight.getByRole("button", { name: /^출발 공항/ }), "ICN", /ICN · 인천국제공항/);
    expect(flight.getByText("ICN · Asia/Seoul 자동 적용")).toBeInTheDocument();

    chooseOption(flight.getByRole("button", { name: /^도착 공항/ }), "시드니", /SYD · 시드니 킹스포드/);
    expect(flight.getByText("SYD · Australia/Sydney 자동 적용")).toBeInTheDocument();

    expect(flight.queryByLabelText("IATA 코드")).not.toBeInTheDocument();
    expect(flight.queryByLabelText("예상 출발")).not.toBeInTheDocument();
    expect(flight.queryByLabelText("실제 출발")).not.toBeInTheDocument();
    expect(flight.getByLabelText("예정 출발 날짜")).toHaveAttribute("type", "text");
    expect(flight.queryByDisplayValue(/예상|실제/)).not.toBeInTheDocument();

    const departureTime = within(flight.getByRole("group", { name: "예정 출발 시간" }));
    const hourTrigger = departureTime.getByRole("combobox", { name: "시" });
    fireEvent.click(hourTrigger);
    const hourListboxId = hourTrigger.getAttribute("aria-controls");
    const hourListbox = hourListboxId ? document.getElementById(hourListboxId) : null;
    if (!hourListbox) throw new Error("시간 선택 목록을 찾지 못했습니다.");
    expect(within(hourListbox).getAllByRole("option", { hidden: true })).toHaveLength(12);
    expect(within(hourListbox).queryByRole("option", { name: "13", hidden: true })).not.toBeInTheDocument();

    openOptions(flight.getByRole("button", { name: /^도착 공항/ }), "직접 입력");
    expect(openListbox().getByRole("option", {
      name: /목록에 없음 · 직접 입력/,
      hidden: true,
    })).toBeInTheDocument();
  });
});

function chooseOption(
  trigger: HTMLElement,
  query: string,
  optionName: RegExp,
) {
  openOptions(trigger, query);
  fireEvent.click(openListbox().getByRole("option", { name: optionName, hidden: true }));
}

function openOptions(trigger: HTMLElement, query: string) {
  fireEvent.click(trigger);
  const search = document.querySelector<HTMLInputElement>(
    '[role="combobox"][aria-label="Search options"][aria-expanded="true"]',
  );
  if (!search) throw new Error("열린 검색 입력을 찾지 못했습니다.");
  fireEvent.change(search, { target: { value: query } });
}

function openListbox() {
  const search = document.querySelector<HTMLInputElement>(
    '[role="combobox"][aria-label="Search options"][aria-expanded="true"]',
  );
  if (!search) throw new Error("열린 검색 입력을 찾지 못했습니다.");
  const listboxId = search.getAttribute("aria-controls");
  const listbox = listboxId ? document.getElementById(listboxId) : null;
  if (!listbox) throw new Error("열린 검색 결과를 찾지 못했습니다.");
  return within(listbox);
}
