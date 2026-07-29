import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FixtureTravelGuideDataSource } from "../../data/fixture/fixtureDataSource";
import { LibraryPage } from "../../pages/library/LibraryPage";
import {
  ApiRequestError,
  apiTripLibraryClient,
  createApiTripLibraryClient,
  createFixturePreviewTripLibraryClient,
  type TripInput,
  type TripLibraryClient,
  type TripLibrarySummary,
  tripInputSchema
} from "./api";
import { TripForm } from "./TripForm";

const tripInput: TripInput = {
  title: "시드니 여행",
  destination: "Sydney",
  startDate: "2026-09-01",
  endDate: "2026-09-05",
  timeZone: "Australia/Sydney",
  status: "upcoming",
  coverImageUrl: "https://images.example/sydney.jpg",
  outboundFlight: null,
  returnFlight: null
};

const activeTrip: TripLibrarySummary = {
  id: "active-trip",
  title: "시드니 여행",
  country: null,
  destination: "Sydney",
  startDate: "2026-09-01",
  endDate: "2026-09-05",
  timeZone: "Australia/Sydney",
  status: "active",
  coverImageUrl: "https://images.example/sydney.jpg",
  journeyStartsAt: null,
  journeyEndsAt: null,
  outboundFlight: null,
  returnFlight: null,
  representativeMediaId: null,
  version: 3,
  syncVersion: 0,
  deletedAt: null,
  purgeAfter: null,
  createdBy: "owner",
  updatedBy: "partner",
  createdAt: "2026-07-20T00:00:00.000Z",
  updatedAt: "2026-07-28T02:00:00.000Z",
  travelerCount: 2,
  bookingCount: 3,
  scheduleItemCount: 8
};

function summary(
  overrides: Partial<TripLibrarySummary>
): TripLibrarySummary {
  return { ...activeTrip, ...overrides };
}

function libraryClient(options: {
  active?: TripLibrarySummary[];
  trash?: TripLibrarySummary[];
  listError?: unknown;
  readOnlyReason?: string;
} = {}): TripLibraryClient & {
  list: ReturnType<typeof vi.fn<TripLibraryClient["list"]>>;
  create: ReturnType<typeof vi.fn<TripLibraryClient["create"]>>;
  update: ReturnType<typeof vi.fn<TripLibraryClient["update"]>>;
  trash: ReturnType<typeof vi.fn<TripLibraryClient["trash"]>>;
  restore: ReturnType<typeof vi.fn<TripLibraryClient["restore"]>>;
} {
  const active = options.active ?? [activeTrip];
  const trash = options.trash ?? [];
  return {
    readOnlyReason: options.readOnlyReason,
    list: vi.fn<TripLibraryClient["list"]>().mockImplementation(async (view) => {
      if (options.listError) throw options.listError;
      return view === "active" ? active : trash;
    }),
    create: vi.fn<TripLibraryClient["create"]>().mockResolvedValue(activeTrip),
    update: vi.fn<TripLibraryClient["update"]>().mockResolvedValue(activeTrip),
    trash: vi.fn<TripLibraryClient["trash"]>().mockResolvedValue(undefined),
    restore: vi.fn<TripLibraryClient["restore"]>().mockResolvedValue(activeTrip)
  };
}

async function fillFlight(
  group: HTMLElement,
  values: {
    airline: string;
    flightNumber: string;
    departureAirport: string;
    departureCode: string;
    departureTimeZone: string;
    scheduledDepartureAt: string;
    actualDepartureAt?: string;
    arrivalAirport: string;
    arrivalCode: string;
    arrivalTimeZone: string;
    scheduledArrivalAt: string;
    estimatedArrivalAt?: string;
  }
) {
  const fields = within(group);
  const airports = fields.getAllByLabelText("공항");
  const codes = fields.getAllByLabelText("IATA 코드");
  const timeZones = fields.getAllByLabelText("현지 시간대");
  await userEvent.type(fields.getByLabelText("항공사"), values.airline);
  await userEvent.type(fields.getByLabelText("편명"), values.flightNumber);
  await userEvent.type(airports[0]!, values.departureAirport);
  await userEvent.type(codes[0]!, values.departureCode);
  await userEvent.type(timeZones[0]!, values.departureTimeZone);
  fireEvent.change(fields.getByLabelText("예정 출발"), {
    target: { value: values.scheduledDepartureAt }
  });
  if (values.actualDepartureAt) {
    fireEvent.change(fields.getByLabelText("실제 출발"), {
      target: { value: values.actualDepartureAt }
    });
  }
  await userEvent.type(airports[1]!, values.arrivalAirport);
  await userEvent.type(codes[1]!, values.arrivalCode);
  await userEvent.type(timeZones[1]!, values.arrivalTimeZone);
  fireEvent.change(fields.getByLabelText("예정 도착"), {
    target: { value: values.scheduledArrivalAt }
  });
  if (values.estimatedArrivalAt) {
    fireEvent.change(fields.getByLabelText("예상 도착"), {
      target: { value: values.estimatedArrivalAt }
    });
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("trip library API", () => {
  it("uses the exact list query and local owner development principal", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ trips: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await apiTripLibraryClient.list("trash");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/trips?view=trash");
    expect(new Headers(init?.headers).get("X-Dev-Principal")).toBe("owner");
  });

  it("uses the partner development principal only when locally selected", async () => {
    window.localStorage.setItem("couple_dev_principal", "partner");
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ trips: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await apiTripLibraryClient.list("active");

    const [, init] = fetchMock.mock.calls[0]!;
    expect(new Headers(init?.headers).get("X-Dev-Principal")).toBe("partner");
  });

  it("never sends a development principal on a production hostname", async () => {
    window.localStorage.setItem("couple_dev_principal", "partner");
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ trips: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await createApiTripLibraryClient(() => "travel.example").list("active");

    const [, init] = fetchMock.mock.calls[0]!;
    expect(new Headers(init?.headers).has("X-Dev-Principal")).toBe(false);
  });

  it("sends exact create, update, trash, and restore requests", async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ trip: { id: "trip-1" } }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ trip: { id: "trip-1" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ trip: { id: "trip-1" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await apiTripLibraryClient.create(tripInput);
    await apiTripLibraryClient.update("trip / 1", tripInput, 3);
    await apiTripLibraryClient.trash("trip / 1", 4);
    await apiTripLibraryClient.restore("trip / 1", 5);

    expect(fetchMock.mock.calls.map(([url, init]) => [
      url,
      init?.method,
      init?.body
    ])).toEqual([
      ["/api/trips", "POST", JSON.stringify(tripInput)],
      [
        "/api/trips/trip%20%2F%201",
        "PATCH",
        JSON.stringify({ ...tripInput, baseVersion: 3 })
      ],
      [
        "/api/trips/trip%20%2F%201",
        "DELETE",
        JSON.stringify({ baseVersion: 4 })
      ],
      [
        "/api/trips/trip%20%2F%201/restore",
        "POST",
        JSON.stringify({ baseVersion: 5 })
      ]
    ]);
  });

  it("preserves JSON API error code, status, and conflict details", async () => {
    const current = { id: "trip-1", version: 4 };
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({
        error: {
          code: "VERSION_CONFLICT",
          message: "다른 기기에서 여행이 수정되었습니다.",
          details: { current }
        }
      }), {
        status: 409,
        headers: { "Content-Type": "application/json" }
      })
    ));

    const error = await apiTripLibraryClient.update("trip-1", tripInput, 3)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({
      status: 409,
      code: "VERSION_CONFLICT",
      message: "다른 기기에서 여행이 수정되었습니다.",
      details: { current }
    });
  });

  it("normalizes a non-JSON failure without hiding its HTTP status", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(
      new Response("<html>upstream failure</html>", {
        status: 502,
        headers: { "Content-Type": "text/html" }
      })
    ));

    const error = await apiTripLibraryClient.list("active")
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({
      status: 502,
      code: "HTTP_ERROR",
      message: "요청을 처리하지 못했습니다."
    });
  });

  it.each([
    ["an empty object", {}],
    ["a null error", { error: null }],
    ["malformed error fields", { error: { code: 42, message: false } }]
  ])("safely normalizes %s while preserving its HTTP status", async (_label, body) => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(body), {
        status: 503,
        headers: { "Content-Type": "application/json" }
      })
    ));

    const error = await apiTripLibraryClient.list("active")
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({
      status: 503,
      code: "HTTP_ERROR",
      message: "요청을 처리하지 못했습니다."
    });
  });

  it("derives preview schedule counts from fixture data instead of inventing them", async () => {
    const fixture = new FixtureTravelGuideDataSource(
      () => new Date("2026-07-28T00:00:00.000Z")
    );

    const trips = await createFixturePreviewTripLibraryClient(fixture).list("active");

    expect(trips.find((trip) => trip.id === "sydney-2026")?.scheduleItemCount)
      .toBe(6);
  });

  it("validates date order, IANA time zones, and allowed cover URL schemes", () => {
    expect(tripInputSchema.safeParse({
      ...tripInput,
      startDate: "2026-09-05",
      endDate: "2026-09-01"
    }).success).toBe(false);
    expect(tripInputSchema.safeParse({
      ...tripInput,
      timeZone: "Sydney/local"
    }).success).toBe(false);
    expect(tripInputSchema.safeParse({
      ...tripInput,
      coverImageUrl: "http://images.example/sydney.jpg"
    }).success).toBe(false);
    expect(tripInputSchema.safeParse({
      ...tripInput,
      coverImageUrl: "/images/sydney.jpg"
    }).success).toBe(true);
  });
});

describe("shared trip library UI", () => {
  it("submits manually entered flights with each airport local offset", async () => {
    const onSubmit = vi.fn<ComponentProps<typeof TripForm>["onSubmit"]>()
      .mockResolvedValue(true);
    const view = render(
      <TripForm
        submitting={false}
        onSubmit={onSubmit}
        onClose={vi.fn()}
        returnFocusTo={null}
      />
    );

    const dialog = screen.getByRole("dialog", { name: "새 여행 만들기" });
    await userEvent.type(within(dialog).getByLabelText("여행 제목"), "시드니 여행");
    await userEvent.type(within(dialog).getByLabelText("여행지"), "Sydney");
    await userEvent.type(within(dialog).getByLabelText("시작일"), "2026-09-10");
    await userEvent.type(within(dialog).getByLabelText("종료일"), "2026-09-14");

    await userEvent.click(within(dialog).getByRole("button", { name: "출국편 입력" }));
    await fillFlight(within(dialog).getByRole("group", { name: "출국편" }), {
      airline: "대한항공",
      flightNumber: "KE401",
      departureAirport: "인천국제공항",
      departureCode: "ICN",
      departureTimeZone: "Asia/Seoul",
      scheduledDepartureAt: "2026-09-09T22:00",
      actualDepartureAt: "2026-09-09T22:30",
      arrivalAirport: "시드니 공항",
      arrivalCode: "SYD",
      arrivalTimeZone: "Australia/Sydney",
      scheduledArrivalAt: "2026-09-10T09:00"
    });

    await userEvent.click(within(dialog).getByRole("button", { name: "귀국편 입력" }));
    await fillFlight(within(dialog).getByRole("group", { name: "귀국편" }), {
      airline: "대한항공",
      flightNumber: "KE402",
      departureAirport: "시드니 공항",
      departureCode: "SYD",
      departureTimeZone: "Australia/Sydney",
      scheduledDepartureAt: "2026-09-14T09:00",
      arrivalAirport: "인천국제공항",
      arrivalCode: "ICN",
      arrivalTimeZone: "Asia/Seoul",
      scheduledArrivalAt: "2026-09-14T20:00",
      estimatedArrivalAt: "2026-09-14T20:30"
    });

    await userEvent.click(within(dialog).getByRole("button", { name: "여행 만들기" }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      outboundFlight: expect.objectContaining({
        flightNumber: "KE401",
        scheduledDepartureAt: "2026-09-09T22:00:00+09:00",
        actualDepartureAt: "2026-09-09T22:30:00+09:00",
        scheduledArrivalAt: "2026-09-10T09:00:00+10:00"
      }),
      returnFlight: expect.objectContaining({
        flightNumber: "KE402",
        scheduledDepartureAt: "2026-09-14T09:00:00+10:00",
        scheduledArrivalAt: "2026-09-14T20:00:00+09:00",
        estimatedArrivalAt: "2026-09-14T20:30:00+09:00"
      })
    }));

    const saved = onSubmit.mock.calls[0]![0];
    view.unmount();
    render(
      <TripForm
        trip={summary({ ...saved })}
        submitting={false}
        onSubmit={vi.fn().mockResolvedValue(true)}
        onClose={vi.fn()}
        returnFocusTo={null}
      />
    );
    const reopened = screen.getByRole("dialog", { name: "여행 수정" });
    const reopenedOutbound = within(reopened).getByRole("group", { name: "출국편" });
    expect(within(reopenedOutbound).getByLabelText("편명")).toHaveValue("KE401");
    expect(within(reopenedOutbound).getByLabelText("실제 출발"))
      .toHaveValue("2026-09-09T22:30");
  });

  it("groups each status and sorts cards by the latest update", async () => {
    const client = libraryClient({
      active: [
        summary({
          id: "completed",
          title: "완료 여행",
          status: "completed",
          updatedAt: "2026-07-20T00:00:00.000Z"
        }),
        summary({
          id: "upcoming-old",
          title: "예정 여행 이전",
          status: "upcoming",
          updatedAt: "2026-07-21T00:00:00.000Z"
        }),
        summary({
          id: "upcoming-new",
          title: "예정 여행 최신",
          status: "upcoming",
          updatedAt: "2026-07-28T00:00:00.000Z"
        }),
        activeTrip
      ]
    });
    render(<LibraryPage client={client} />);

    expect(await screen.findByRole("heading", { name: "여행 중" })).toBeVisible();
    const upcoming = screen.getByRole("region", { name: "예정 여행" });
    expect(within(upcoming).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent))
      .toEqual(["예정 여행 최신", "예정 여행 이전"]);

    await userEvent.click(screen.getByRole("button", { name: "완료" }));
    expect(screen.getByText("완료 여행")).toBeVisible();
    expect(screen.queryByText("시드니 여행")).not.toBeInTheDocument();
  });

  it("creates a trip from a validated destination preset and refreshes the active list", async () => {
    const client = libraryClient();
    render(<LibraryPage client={client} />);

    await userEvent.click(await screen.findByRole("button", { name: "새 여행 만들기" }));
    const dialog = screen.getByRole("dialog", { name: "새 여행 만들기" });
    await userEvent.type(within(dialog).getByRole("textbox", { name: "여행 제목" }), "도쿄 여행");
    await userEvent.type(within(dialog).getByLabelText("여행지"), "Tokyo");
    expect(within(dialog).getByRole("textbox", { name: "시간대" }))
      .toHaveValue("Asia/Tokyo");
    await userEvent.type(within(dialog).getByLabelText("시작일"), "2026-10-01");
    await userEvent.type(within(dialog).getByLabelText("종료일"), "2026-10-04");
    await userEvent.click(within(dialog).getByRole("button", { name: "여행 만들기" }));

    expect(client.create).toHaveBeenCalledWith({
      title: "도쿄 여행",
      destination: "Tokyo",
      startDate: "2026-10-01",
      endDate: "2026-10-04",
      timeZone: "Asia/Tokyo",
      status: "upcoming",
      coverImageUrl: null,
      outboundFlight: null,
      returnFlight: null
    });
    expect(client.list).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("dialog", { name: "새 여행 만들기" })).not.toBeInTheDocument();
  });

  it("keeps conflict input open and silently refreshes the version for a later retry", async () => {
    const currentTrip = summary({ version: 4 });
    const client = libraryClient();
    client.list
      .mockResolvedValueOnce([activeTrip])
      .mockResolvedValueOnce([currentTrip])
      .mockResolvedValue([currentTrip]);
    client.update.mockRejectedValueOnce(
      new ApiRequestError(
        409,
        "VERSION_CONFLICT",
        "다른 기기에서 여행이 수정되었습니다.",
        { current: summary({ version: 99 }) }
      )
    );
    render(<LibraryPage client={client} />);

    await userEvent.click(await screen.findByRole("button", { name: "시드니 여행 메뉴" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "시드니 여행 수정" }));
    const dialog = screen.getByRole("dialog", { name: "여행 수정" });
    const title = within(dialog).getByRole("textbox", { name: "여행 제목" });
    await userEvent.clear(title);
    await userEvent.type(title, "수정 중인 시드니");
    await userEvent.click(within(dialog).getByRole("button", { name: "변경 저장" }));

    expect(await within(dialog).findByRole("alert"))
      .toHaveTextContent("다른 기기에서 여행이 수정되었습니다.");
    expect(title).toHaveValue("수정 중인 시드니");
    expect(client.update).toHaveBeenCalledOnce();
    expect(client.update).toHaveBeenCalledWith(
      "active-trip",
      expect.objectContaining({ title: "수정 중인 시드니" }),
      3
    );
    await waitFor(() => expect(client.list).toHaveBeenCalledTimes(2));
    expect(client.list).toHaveBeenLastCalledWith("active");
    expect(client.update).toHaveBeenCalledOnce();

    await userEvent.click(within(dialog).getByRole("button", { name: "취소" }));
    await userEvent.click(screen.getByRole("button", { name: "시드니 여행 메뉴" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "시드니 여행 수정" }));
    const reopened = screen.getByRole("dialog", { name: "여행 수정" });
    await userEvent.click(within(reopened).getByRole("button", { name: "변경 저장" }));

    expect(client.update).toHaveBeenLastCalledWith(
      "active-trip",
      expect.objectContaining({ title: "시드니 여행" }),
      4
    );
  });

  it("keeps the active library and conflict form intact when silent refresh fails", async () => {
    const client = libraryClient();
    client.list
      .mockResolvedValueOnce([activeTrip])
      .mockRejectedValueOnce(new Error("background refresh failed"));
    client.update.mockRejectedValueOnce(
      new ApiRequestError(409, "VERSION_CONFLICT", "다른 기기에서 여행이 수정되었습니다.")
    );
    render(<LibraryPage client={client} />);

    await userEvent.click(await screen.findByRole("button", { name: "시드니 여행 메뉴" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "시드니 여행 수정" }));
    const dialog = screen.getByRole("dialog", { name: "여행 수정" });
    const title = within(dialog).getByRole("textbox", { name: "여행 제목" });
    await userEvent.clear(title);
    await userEvent.type(title, "보존할 입력");
    await userEvent.click(within(dialog).getByRole("button", { name: "변경 저장" }));

    expect(await within(dialog).findByRole("alert"))
      .toHaveTextContent("다른 기기에서 여행이 수정되었습니다.");
    await waitFor(() => expect(client.list).toHaveBeenCalledTimes(2));
    expect(title).toHaveValue("보존할 입력");
    await userEvent.click(within(dialog).getByRole("button", { name: "취소" }));
    expect(screen.getByRole("heading", { name: "여행 서재" })).toBeVisible();
    expect(screen.getByText("시드니 여행")).toBeVisible();
    expect(screen.queryByText("background refresh failed")).not.toBeInTheDocument();
  });

  it("blocks duplicate create submissions while the first request is pending", async () => {
    let finishCreate!: () => void;
    const pending = new Promise<typeof activeTrip>((resolve) => {
      finishCreate = () => resolve(activeTrip);
    });
    const client = libraryClient();
    client.create.mockReturnValue(pending);
    render(<LibraryPage client={client} />);

    await userEvent.click(await screen.findByRole("button", { name: "새 여행 만들기" }));
    const dialog = screen.getByRole("dialog", { name: "새 여행 만들기" });
    await userEvent.type(within(dialog).getByRole("textbox", { name: "여행 제목" }), "도쿄 여행");
    await userEvent.type(within(dialog).getByLabelText("여행지"), "Tokyo");
    await userEvent.type(within(dialog).getByLabelText("시작일"), "2026-10-01");
    await userEvent.type(within(dialog).getByLabelText("종료일"), "2026-10-04");
    const submit = within(dialog).getByRole("button", { name: "여행 만들기" });

    await userEvent.click(submit);
    await userEvent.click(submit);

    expect(client.create).toHaveBeenCalledOnce();
    expect(within(dialog).getByRole("button", { name: "저장 중…" })).toBeDisabled();
    await act(async () => finishCreate());
  });

  it("keeps a pending form open until its own mutation completes", async () => {
    let finishCreate!: () => void;
    const pending = new Promise<typeof activeTrip>((resolve) => {
      finishCreate = () => resolve(activeTrip);
    });
    const client = libraryClient();
    client.create.mockReturnValue(pending);
    render(<LibraryPage client={client} deviceManagement={<p>기기 관리</p>} />);

    await userEvent.click(await screen.findByRole("button", { name: "새 여행 만들기" }));
    const dialog = screen.getByRole("dialog", { name: "새 여행 만들기" });
    await userEvent.type(within(dialog).getByRole("textbox", { name: "여행 제목" }), "도쿄 여행");
    await userEvent.type(within(dialog).getByLabelText("여행지"), "Tokyo");
    await userEvent.type(within(dialog).getByLabelText("시작일"), "2026-10-01");
    await userEvent.type(within(dialog).getByLabelText("종료일"), "2026-10-04");
    await userEvent.click(within(dialog).getByRole("button", { name: "여행 만들기" }));

    expect(within(dialog).getByRole("button", { name: "취소" })).toBeDisabled();
    await userEvent.keyboard("{Escape}");
    expect(dialog).toBeVisible();
    await userEvent.click(within(dialog).getByRole("button", { name: "취소" }));
    expect(dialog).toBeVisible();

    await act(async () => finishCreate());
    expect(screen.queryByRole("dialog", { name: "새 여행 만들기" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "연결 기기" }));
    expect(screen.getByRole("dialog", { name: "연결 기기 관리" })).toHaveTextContent("기기 관리");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not refresh or update the library after a pending mutation unmounts", async () => {
    let finishCreate!: () => void;
    const pending = new Promise<typeof activeTrip>((resolve) => {
      finishCreate = () => resolve(activeTrip);
    });
    const client = libraryClient();
    client.create.mockReturnValue(pending);
    const view = render(<LibraryPage client={client} />);

    await userEvent.click(await screen.findByRole("button", { name: "새 여행 만들기" }));
    const dialog = screen.getByRole("dialog", { name: "새 여행 만들기" });
    await userEvent.type(within(dialog).getByRole("textbox", { name: "여행 제목" }), "도쿄 여행");
    await userEvent.type(within(dialog).getByLabelText("여행지"), "Tokyo");
    await userEvent.type(within(dialog).getByLabelText("시작일"), "2026-10-01");
    await userEvent.type(within(dialog).getByLabelText("종료일"), "2026-10-04");
    await userEvent.click(within(dialog).getByRole("button", { name: "여행 만들기" }));

    view.unmount();
    await act(async () => finishCreate());

    expect(client.list).toHaveBeenCalledTimes(1);
  });

  it("accepts an app-local cover path that the server contract allows", async () => {
    const client = libraryClient();
    render(<LibraryPage client={client} />);

    await userEvent.click(await screen.findByRole("button", { name: "새 여행 만들기" }));
    const dialog = screen.getByRole("dialog", { name: "새 여행 만들기" });
    await userEvent.type(within(dialog).getByRole("textbox", { name: "여행 제목" }), "도쿄 여행");
    await userEvent.type(within(dialog).getByLabelText("여행지"), "Tokyo");
    await userEvent.type(within(dialog).getByLabelText("시작일"), "2026-10-01");
    await userEvent.type(within(dialog).getByLabelText("종료일"), "2026-10-04");
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: "대표 이미지 주소" }),
      "/images/tokyo.jpg"
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "여행 만들기" }));

    expect(client.create).toHaveBeenCalledWith(
      expect.objectContaining({ coverImageUrl: "/images/tokyo.jpg" })
    );
  });

  it("requires a titled confirmation and cancel never trashes the trip", async () => {
    const client = libraryClient();
    render(<LibraryPage client={client} />);

    await userEvent.click(await screen.findByRole("button", { name: "시드니 여행 메뉴" }));
    await userEvent.click(
      screen.getByRole("menuitem", { name: "시드니 여행 휴지통으로 이동" })
    );
    const dialog = screen.getByRole("dialog", { name: "여행 휴지통 이동 확인" });
    expect(within(dialog).getByText(/시드니 여행/)).toBeVisible();
    await userEvent.click(within(dialog).getByRole("button", { name: "취소" }));

    expect(client.trash).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "여행 휴지통 이동 확인" }))
      .not.toBeInTheDocument();
  });

  it("closes an edit sheet with Escape and restores focus to the card menu trigger", async () => {
    const client = libraryClient();
    render(<LibraryPage client={client} />);

    const trigger = await screen.findByRole("button", { name: "시드니 여행 메뉴" });
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole("menuitem", { name: "시드니 여행 수정" }));
    expect(screen.getByRole("dialog", { name: "여행 수정" })).toBeVisible();

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "여행 수정" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("supports full keyboard navigation in a card action menu", async () => {
    render(<LibraryPage client={libraryClient()} />);

    const trigger = await screen.findByRole("button", { name: "시드니 여행 메뉴" });
    await userEvent.click(trigger);
    const edit = screen.getByRole("menuitem", { name: "시드니 여행 수정" });
    const trash = screen.getByRole("menuitem", { name: "시드니 여행 휴지통으로 이동" });
    expect(edit).toHaveFocus();

    await userEvent.keyboard("{ArrowDown}");
    expect(trash).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(edit).toHaveFocus();
    await userEvent.keyboard("{ArrowUp}");
    expect(trash).toHaveFocus();
    await userEvent.keyboard("{Home}");
    expect(edit).toHaveFocus();
    await userEvent.keyboard("{End}");
    expect(trash).toHaveFocus();
    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("closes the card menu after normal Tab focus leaves it in either direction", async () => {
    render(<LibraryPage client={libraryClient()} />);

    const trigger = await screen.findByRole("button", { name: "시드니 여행 메뉴" });
    await userEvent.click(trigger);
    expect(screen.getByRole("menuitem", { name: "시드니 여행 수정" })).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(trigger).toHaveFocus();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await userEvent.click(trigger);
    await userEvent.keyboard("{End}");
    expect(screen.getByRole("menuitem", { name: "시드니 여행 휴지통으로 이동" }))
      .toHaveFocus();
    await userEvent.tab();

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /새 여행 만들기.*날짜와 여행지를/ }))
      .toHaveFocus();
  });

  it("closes a card action menu when focus moves to an outside click", async () => {
    render(<LibraryPage client={libraryClient()} />);

    await userEvent.click(await screen.findByRole("button", { name: "시드니 여행 메뉴" }));
    expect(screen.getByRole("menu")).toBeVisible();
    await userEvent.click(screen.getByRole("heading", { name: "여행 서재" }));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("loads trash details and restores with the current version", async () => {
    const trashed = summary({
      id: "trashed",
      title: "휴지통 여행",
      status: "completed",
      version: 7,
      deletedAt: "2026-07-28T00:00:00.000Z",
      purgeAfter: "2026-08-27T00:00:00.000Z"
    });
    const client = libraryClient({ trash: [trashed] });
    render(
      <LibraryPage
        client={client}
        now={() => new Date("2026-07-30T00:00:00.000Z")}
      />
    );

    await userEvent.click(await screen.findByRole("button", { name: "휴지통" }));
    const dialog = screen.getByRole("dialog", { name: "휴지통" });
    expect(await within(dialog).findByText("휴지통 여행")).toBeVisible();
    expect(within(dialog).getByText(/28일 남음/)).toBeVisible();
    await userEvent.click(within(dialog).getByRole("button", { name: "휴지통 여행 복구" }));

    expect(client.restore).toHaveBeenCalledWith("trashed", 7);
    expect(client.list).toHaveBeenCalledWith("trash");
    expect(client.list).toHaveBeenCalledWith("active");
  });

  it("disables restore at the purge deadline or for an invalid deadline", async () => {
    const deadline = summary({
      id: "deadline",
      title: "기한 종료 여행",
      deletedAt: "2026-07-28T00:00:00.000Z",
      purgeAfter: "2026-08-27T00:00:00.000Z"
    });
    const invalid = summary({
      id: "invalid",
      title: "기한 오류 여행",
      deletedAt: "2026-07-28T00:00:00.000Z",
      purgeAfter: "not-a-date"
    });
    const future = summary({
      id: "future",
      title: "복구 가능 여행",
      deletedAt: "2026-07-28T00:00:00.000Z",
      purgeAfter: "2026-08-27T00:00:01.000Z"
    });
    render(
      <LibraryPage
        client={libraryClient({ trash: [deadline, invalid, future] })}
        now={() => new Date("2026-08-27T00:00:00.000Z")}
      />
    );

    await userEvent.click(await screen.findByRole("button", { name: "휴지통" }));
    const dialog = screen.getByRole("dialog", { name: "휴지통" });
    const expired = await within(dialog).findByRole("button", { name: "기한 종료 여행 복구" });
    const malformed = within(dialog).getByRole("button", { name: "기한 오류 여행 복구" });
    const available = within(dialog).getByRole("button", { name: "복구 가능 여행 복구" });

    expect(expired).toBeDisabled();
    expect(expired).toHaveAccessibleDescription("복구 기간이 만료되었습니다.");
    expect(malformed).toBeDisabled();
    expect(malformed).toHaveAccessibleDescription("복구 기간이 만료되었습니다.");
    expect(available).toBeEnabled();
  });

  it("keeps the trash panel open when restore finds a version conflict", async () => {
    const trashed = summary({
      id: "trashed",
      title: "휴지통 여행",
      version: 7,
      deletedAt: "2026-07-28T00:00:00.000Z",
      purgeAfter: "2026-08-27T00:00:00.000Z"
    });
    const client = libraryClient({ trash: [trashed] });
    client.restore.mockRejectedValueOnce(
      new ApiRequestError(409, "VERSION_CONFLICT", "다른 기기에서 여행이 수정되었습니다.")
    );
    render(<LibraryPage client={client} />);

    await userEvent.click(await screen.findByRole("button", { name: "휴지통" }));
    const dialog = screen.getByRole("dialog", { name: "휴지통" });
    await userEvent.click(
      await within(dialog).findByRole("button", { name: "휴지통 여행 복구" })
    );

    expect(await within(dialog).findByRole("alert"))
      .toHaveTextContent("다른 기기에서 여행이 수정되었습니다.");
    expect(dialog).toBeVisible();
    expect(client.restore).toHaveBeenCalledOnce();
  });

  it.each([
    [
      "SESSION_EXPIRED",
      "Device session is not valid",
      "기기 연결이 만료되었습니다. 관리자에게 새 연결 링크를 요청해 다시 연결해 주세요."
    ],
    [
      "ACCESS_REQUIRED",
      "Cloudflare Access identity required",
      "관리자 로그인이 필요합니다. Cloudflare Access 로그인을 다시 진행해 주세요."
    ]
  ])("shows Korean recovery guidance for %s dialog failures", async (
    code,
    workerMessage,
    recoveryMessage
  ) => {
    const client = libraryClient();
    client.trash.mockRejectedValueOnce(new ApiRequestError(401, code, workerMessage));
    render(<LibraryPage client={client} />);

    await userEvent.click(await screen.findByRole("button", { name: "시드니 여행 메뉴" }));
    await userEvent.click(
      screen.getByRole("menuitem", { name: "시드니 여행 휴지통으로 이동" })
    );
    const dialog = screen.getByRole("dialog", { name: "여행 휴지통 이동 확인" });
    await userEvent.click(within(dialog).getByRole("button", { name: "휴지통으로 이동" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(recoveryMessage);
    expect(dialog).not.toHaveTextContent(workerMessage);
  });

  it("distinguishes an expired partner session from a general request error", async () => {
    const client = libraryClient({
      listError: new ApiRequestError(
        401,
        "SESSION_EXPIRED",
        "Device session is not valid"
      )
    });
    render(<LibraryPage client={client} />);

    expect(await screen.findByRole("heading", { name: "기기 연결이 필요합니다" }))
      .toBeVisible();
    expect(screen.getByText(/관리자에게 새 연결 링크를 요청/)).toBeVisible();
  });

  it("labels the GitHub Pages fixture and disables every mutation entry", async () => {
    const reason = "GitHub Pages 미리보기에서는 여행을 조회만 할 수 있습니다.";
    const deviceMount = vi.fn();
    function DeviceProbe() {
      deviceMount();
      return <p>기기 API</p>;
    }
    render(
      <LibraryPage
        client={libraryClient({ readOnlyReason: reason })}
        deviceManagement={<DeviceProbe />}
      />
    );

    expect(await screen.findByText(reason)).toBeVisible();
    expect(screen.getByRole("button", { name: "새 여행 만들기" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "시드니 여행 메뉴" })).toBeDisabled();
    const devices = screen.getByRole("button", { name: "연결 기기" });
    expect(devices).toBeDisabled();
    expect(devices).toHaveAttribute("title", reason);
    await userEvent.click(devices);
    expect(screen.queryByRole("dialog", { name: "연결 기기 관리" })).not.toBeInTheDocument();
    expect(deviceMount).not.toHaveBeenCalled();
  });

  it("uses a text fallback instead of a broken image when the cover is null", async () => {
    const client = libraryClient({
      active: [summary({ coverImageUrl: null, destination: "Sydney" })]
    });
    render(<LibraryPage client={client} />);

    const card = await screen.findByRole("article");
    expect(within(card).queryByRole("img")).not.toBeInTheDocument();
    expect(within(card).getByText("S")).toBeVisible();
  });

  it("keeps exactly one create card when active and completed trips have no upcoming group", async () => {
    const client = libraryClient({
      active: [
        activeTrip,
        summary({ id: "completed", title: "완료 여행", status: "completed" })
      ]
    });
    const { container } = render(<LibraryPage client={client} />);

    expect(await screen.findByRole("heading", { name: "여행 중" })).toBeVisible();
    expect(container.querySelectorAll(".library-create-card")).toHaveLength(1);
    expect(screen.queryByRole("region", { name: "예정 여행" })).not.toBeInTheDocument();
  });
});
