import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TripMutationController } from "../../services/mutations/controller";
import { createSampleDataSource } from "../../test/travelSamples";
import { TodayPage } from "./TodayPage";

async function todayProps(tripId: string) {
  const dataSource = createSampleDataSource(
    () => new Date("2026-07-28T00:00:00.000Z"),
  );
  const [context, today, tools] = await Promise.all([
    dataSource.getTripContext(tripId),
    dataSource.getToday(tripId),
    dataSource.getTools(tripId),
  ]);
  if (!context || !today || !tools) throw new Error("sample Today data missing");
  return {
    bookings: tools.bookings,
    checkItems: tools.checkItems,
    members: tools.members,
    today,
    trip: context.trip,
    viewerMemberId: context.viewer.memberId,
  };
}

afterEach(() => {
  vi.useRealTimers();
  window.localStorage.clear();
});

describe("TodayPage", () => {
  it.each([
    ["bondi-weekend", "D-14", "지금 확인할 준비", "준비 비용"],
    ["sydney-2026", "Sydney의 오늘", "다음 일정", "오늘 지출"],
  ] as const)("renders the %s experience phase home", async (tripId, hero, section, cost) => {
    render(<TodayPage {...await todayProps(tripId)} />);

    expect(screen.getByRole("heading", { name: hero })).toBeVisible();
    expect(screen.getByRole("heading", { name: section })).toBeVisible();
    expect(screen.getByRole("heading", { name: cost })).toBeVisible();
  });

  it("renders the approved during-trip priority order", async () => {
    const { container } = render(
      <TodayPage {...await todayProps("sydney-2026")} />,
    );

    expect(
      [...container.querySelectorAll<HTMLElement>("[data-section]")]
        .map((section) => section.dataset.section),
    ).toEqual(["schedule", "weather", "map", "nearby"]);
  });

  it("shows the two after-trip actions and hides completed settlement", async () => {
    render(<TodayPage {...await todayProps("blue-mountains-memory")} />);

    expect(screen.getByRole("heading", { name: "여행을 다시 봅니다" })).toBeVisible();
    expect(screen.getByRole("link", { name: "여행 기록 보기" })).toBeVisible();
    expect(screen.getByRole("link", { name: "다시 여행 보기" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "정산 완료" }))
      .not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "전체 비용" })).toBeVisible();
  });

  it("shows at most three urgent gaps in priority order", async () => {
    render(<TodayPage {...await todayProps("bondi-weekend")} />);

    const gaps = screen.getByRole("heading", { name: "지금 확인할 준비" })
      .closest("section")?.querySelectorAll(".urgent-gap-list > li");
    expect(gaps).toHaveLength(3);
    expect(gaps?.[0]).toHaveTextContent("항공편 확인");
    expect(gaps?.[1]).toHaveTextContent("숙소 예약");
    expect(gaps?.[2]).toHaveTextContent("여권 확인");
  });

  it("submits a preparation expense through the shared mutation controller", async () => {
    const user = userEvent.setup();
    const submit = vi.fn().mockResolvedValue({
      entity: "expense",
      entityId: "expense-1",
      version: 1,
      syncVersion: 1,
    });
    const controller: TripMutationController = { submit };
    render(<TodayPage {...await todayProps("bondi-weekend")} mutationController={controller} />);

    await user.click(screen.getByRole("button", { name: "준비 비용 추가" }));
    await user.type(screen.getByLabelText("항목"), "항공권");
    await user.clear(screen.getByLabelText("금액"));
    await user.type(screen.getByLabelText("금액"), "120000");
    await user.click(screen.getByRole("button", { name: "저장" }));

    expect(submit).toHaveBeenCalledWith(
      "expense",
      "create",
      expect.any(String),
      null,
      expect.objectContaining({
        phase: "pretrip",
        category: "reservation",
        title: "항공권",
        amountMinor: 120000,
        currency: "KRW",
        paidByMemberId: "preview-owner",
        isSettled: false,
      }),
    );
  });

  it("shows the destination-local nightly expense reminder once per day", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-28T11:00:00.000Z"));
    render(<TodayPage {...await todayProps("sydney-2026")} />);

    expect(screen.getByRole("dialog", { name: "오늘 지출 정리 알림" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "오늘은 닫기" }));
    expect(screen.queryByRole("dialog", { name: "오늘 지출 정리 알림" })).not.toBeInTheDocument();

    act(() => window.dispatchEvent(new Event("focus")));
    expect(screen.queryByRole("dialog", { name: "오늘 지출 정리 알림" })).not.toBeInTheDocument();
  });

  it("keeps the trip cover until a real AI-selected trip photo exists", async () => {
    render(<TodayPage {...await todayProps("blue-mountains-memory")} />);

    expect(screen.getByRole("img", { name: "Blue Mountains 여행 대표 사진" }))
      .toHaveAttribute("src", "/images/blue_mountains.jpg");
    expect(screen.getByText("사진을 올리면 기기 내 AI가 대표사진 후보를 추천합니다.")).toBeVisible();
  });
});
