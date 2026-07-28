import type { TripWorkspace } from "../../../data/contracts";

export type AiPromptScope = "trip" | "today" | "place";

export interface AiPromptSelection {
  scope: AiPromptScope;
  selectedId: string | null;
}

export function buildAiPrompt(
  workspace: TripWorkspace,
  selection: AiPromptSelection
): string {
  const sharedNotes = workspace.tools.notes
    .filter((note) => note.visibility === "shared")
    .map((note) => note.body);
  const sharedChecklist = workspace.tools.checkItems
    .filter((item) => item.scope === "shared")
    .map((item) => ({
      title: item.title,
      quantity: item.quantity,
      done: item.isDone
    }));
  const safeBookings = workspace.tools.bookings.map((booking) => ({
    type: booking.bookingType,
    provider: booking.provider,
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    paymentStatus: booking.paymentStatus,
    fixed: booking.isFixed
  }));
  const context = selection.scope === "today"
    ? {
        trip: tripSummary(workspace),
        today: {
          date: workspace.today.localDate,
          headline: workspace.today.headline,
          nextMovement: workspace.today.nextMovement,
          booking: workspace.today.booking,
          schedule: workspace.today.schedule.map(scheduleSummary)
        },
        sharedNotes
      }
    : selection.scope === "place"
      ? {
          trip: tripSummary(workspace),
          place: workspace.mapPreview.places.find(
            (place) => place.id === selection.selectedId
          ) ?? null,
          relatedSchedule: workspace.schedule.days.flatMap((day) =>
            day.items
              .filter((item) => item.placeId === selection.selectedId)
              .map(scheduleSummary)
          )
        }
      : {
          trip: tripSummary(workspace),
          schedule: workspace.schedule.days.map((day) => ({
            date: day.date,
            title: day.headline,
            items: day.items.map(scheduleSummary)
          })),
          places: workspace.mapPreview.places.map((place) => ({
            name: place.name,
            category: place.category,
            status: place.status,
            address: place.address,
            description: place.description
          })),
          bookings: safeBookings,
          sharedChecklist,
          sharedNotes
        };

  const scopeLabel = {
    trip: "여행 전체",
    today: "오늘 일정",
    place: "선택한 장소"
  }[selection.scope];
  const prompt = [
    "아래 여행 문맥을 바탕으로 실용적인 조언을 한국어로 정리해 주세요.",
    `질문 범위: ${scopeLabel}`,
    JSON.stringify(context, null, 2),
    "예약번호, 예약 메모, 개인 메모는 제공되지 않았습니다."
  ].join("\n\n");

  return removeSensitiveValues(prompt, workspace);
}

function tripSummary(workspace: TripWorkspace) {
  const trip = workspace.context.trip;
  return {
    title: trip.title,
    destination: trip.destination,
    country: trip.country,
    startDate: trip.startDate,
    endDate: trip.endDate,
    timeZone: trip.timeZone
  };
}

function scheduleSummary(item: TripWorkspace["today"]["schedule"][number]) {
  return {
    title: item.title,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    place: item.place,
    description: item.description,
    travelMode: item.travelMode,
    travelNote: item.travelNote,
    fixed: item.isFixed,
    done: item.isDone
  };
}

function removeSensitiveValues(prompt: string, workspace: TripWorkspace) {
  const sensitive = [
    ...workspace.tools.bookings.flatMap((booking) => [
      booking.reservationCode,
      booking.memo
    ]),
    ...workspace.tools.notes
      .filter((note) => note.visibility === "personal")
      .map((note) => note.body)
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .sort((left, right) => right.length - left.length);

  return sensitive.reduce(
    (safePrompt, value) => safePrompt.replaceAll(value, "[제외됨]"),
    prompt
  );
}
