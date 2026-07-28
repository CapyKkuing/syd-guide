import { FixtureTravelGuideDataSource } from "./fixtureDataSource";

const fixedClock = () => new Date("2026-07-28T00:00:00.000Z");

describe("FixtureTravelGuideDataSource", () => {
  it("returns multiple trips covering all three phases", async () => {
    const dataSource = new FixtureTravelGuideDataSource(fixedClock);
    const trips = await dataSource.listTrips();

    expect(trips.map((trip) => trip.phase)).toEqual(
      expect.arrayContaining(["upcoming", "active", "completed"])
    );
  });

  it("returns a complete Sydney workspace through the data source", async () => {
    const dataSource = new FixtureTravelGuideDataSource(fixedClock);
    const [context, today, schedule, mapPreview, tools] = await Promise.all([
      dataSource.getTripContext("sydney-2026"),
      dataSource.getToday("sydney-2026"),
      dataSource.getSchedule("sydney-2026"),
      dataSource.getMapPreview("sydney-2026"),
      dataSource.getTools("sydney-2026")
    ]);

    expect(context?.trip.id).toBe("sydney-2026");
    expect(today?.weather.isSample).toBe(true);
    expect(schedule?.days.length).toBeGreaterThan(1);
    expect(mapPreview?.places.length).toBeGreaterThan(2);
    expect(tools?.groups).toHaveLength(3);
  });

  it("returns null for an unknown trip", async () => {
    const dataSource = new FixtureTravelGuideDataSource(fixedClock);

    await expect(
      Promise.all([
        dataSource.getTripContext("missing"),
        dataSource.getToday("missing"),
        dataSource.getSchedule("missing"),
        dataSource.getMapPreview("missing"),
        dataSource.getTools("missing")
      ])
    ).resolves.toEqual([null, null, null, null, null]);
  });

  it("derives Sydney local time, active countdown, and upcoming D-day from the injected clock", async () => {
    const dataSource = new FixtureTravelGuideDataSource(fixedClock);
    const [sydneyContext, sydneyToday, bondiToday] = await Promise.all([
      dataSource.getTripContext("sydney-2026"),
      dataSource.getToday("sydney-2026"),
      dataSource.getToday("bondi-weekend")
    ]);

    expect(sydneyContext?.trip.timeZone).toBe("Australia/Sydney");
    expect(sydneyContext?.localDate).toBe("2026-07-28");
    expect(sydneyToday?.localDate).toBe("2026-07-28");
    expect(sydneyToday?.dDay).toBe(0);
    expect(sydneyToday?.nextMovement).toMatchObject({
      departureTime: "11:30",
      countdownLabel: "1시간 30분 후"
    });
    expect(bondiToday?.dDay).toBe(14);
  });

  it.each([
    ["bondi-weekend", "2026-08-11", "8월 11일 화요일"],
    ["sydney-2026", "2026-07-28", "7월 28일 화요일"],
    ["blue-mountains-memory", "2026-07-01", "7월 1일 수요일"]
  ] as const)("uses the relevant schedule context date for %s Today data", async (
    tripId,
    expectedDate,
    expectedDayLabel
  ) => {
    const today = await new FixtureTravelGuideDataSource(fixedClock).getToday(tripId);

    expect(today?.localDate).toBe(expectedDate);
    expect(today?.dayLabel).toBe(expectedDayLabel);
  });

  it("keeps completed schedules within the trip period and marks every item done", async () => {
    const dataSource = new FixtureTravelGuideDataSource(fixedClock);
    const [context, schedule] = await Promise.all([
      dataSource.getTripContext("blue-mountains-memory"),
      dataSource.getSchedule("blue-mountains-memory")
    ]);

    expect(context).not.toBeNull();
    expect(schedule).not.toBeNull();
    expect(schedule?.days).toHaveLength(3);
    expect(schedule?.days.every((day) =>
      day.date >= context!.trip.startDate && day.date <= context!.trip.endDate
    )).toBe(true);
    expect(schedule?.days.flatMap((day) => day.items)).toHaveLength(6);
    expect(schedule?.days.flatMap((day) => day.items).every((item) => item.isDone)).toBe(true);
  });

  it.each([
    {
      tripId: "sydney-2026",
      expectedPlaces: [
        ["Meriton Sussex Street", "2026-07-27"],
        ["Sydney Opera House", "2026-07-28"],
        ["Sample Coffee", "2026-07-29"],
        ["Quay", "2026-07-28"]
      ],
      expectedDays: ["2026-07-27", "2026-07-28", "2026-07-29"]
    },
    {
      tripId: "bondi-weekend",
      expectedPlaces: [
        ["Meriton Sussex Street", "2026-08-11"],
        ["Sydney Opera House", "2026-08-12"],
        ["Sample Coffee", "2026-08-13"],
        ["Quay", "2026-08-12"]
      ],
      expectedDays: ["2026-08-11", "2026-08-12", "2026-08-13"]
    },
    {
      tripId: "blue-mountains-memory",
      expectedPlaces: [
        ["Meriton Sussex Street", "2026-06-28"],
        ["Sydney Opera House", "2026-06-29"],
        ["Sample Coffee", "2026-06-30"],
        ["Quay", "2026-06-29"]
      ],
      expectedDays: ["2026-06-28", "2026-06-29", "2026-06-30"]
    }
  ])("anchors every $tripId map place to its schedule and covers each offered day", async ({
    tripId,
    expectedPlaces,
    expectedDays
  }) => {
    const dataSource = new FixtureTravelGuideDataSource(fixedClock);
    const [schedule, mapPreview] = await Promise.all([
      dataSource.getSchedule(tripId),
      dataSource.getMapPreview(tripId)
    ]);

    expect(schedule?.days.map((day) => day.date)).toEqual(expectedDays);
    expect(mapPreview?.places.map((place) => [place.name, place.dayDate])).toEqual(expectedPlaces);
    expect([...new Set(mapPreview?.places.map((place) => place.dayDate))].sort())
      .toEqual(expectedDays);
  });

  it("returns the prescribed tool labels and availability", async () => {
    const dataSource = new FixtureTravelGuideDataSource(fixedClock);
    const tools = await dataSource.getTools("sydney-2026");

    expect(tools?.groups.map((group) => ({
      id: group.id,
      items: group.items.map((item) => ({ label: item.label, status: item.status }))
    }))).toEqual([
      {
        id: "essentials",
        items: [
          { label: "예약·바우처", status: "preview" },
          { label: "환율", status: "preview" },
          { label: "교통", status: "preview" },
          { label: "비상 연락처", status: "preview" }
        ]
      },
      {
        id: "places",
        items: [
          { label: "맛집", status: "preview" },
          { label: "카페", status: "preview" },
          { label: "저장 장소", status: "preview" }
        ]
      },
      {
        id: "planning",
        items: [
          { label: "체크리스트", status: "preview" },
          { label: "여행 메모", status: "preview" },
          { label: "주의사항", status: "preview" },
          { label: "AI 앱 연결", status: "preview" },
          { label: "파트너 연결", status: "preview" },
          { label: "연결 기기 관리", status: "available" },
          { label: "테마", status: "available" },
          { label: "오프라인·동기화 상태", status: "available" }
        ]
      }
    ]);
  });
});
