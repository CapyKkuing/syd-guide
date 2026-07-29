import type { TripSnapshot } from "../shared/api";

export function createTripSnapshot(): TripSnapshot {
  return {
    trip: {
      id: "trip-one",
      title: "시드니 여행",
      destination: "Sydney, Australia",
      startDate: "2026-09-10",
      endDate: "2026-09-11",
      timeZone: "Australia/Sydney",
      status: "active",
      coverImageUrl: "/images/sydney_harbour_bridge.jpg",
      journeyStartsAt: "2026-09-09T22:00:00+10:00",
      journeyEndsAt: "2026-09-14T20:00:00+09:00",
      outboundFlight: null,
      returnFlight: null,
      representativeMediaId: null,
      version: 2,
      syncVersion: 7,
      deletedAt: null,
      purgeAfter: null,
      createdBy: "owner",
      updatedBy: "owner",
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-09-09T00:00:00.000Z"
    },
    members: [
      { id: "owner", role: "owner", displayName: "연준" },
      { id: "partner", role: "partner", displayName: "민지" }
    ],
    days: [
      entity({
        id: "day-two",
        dayDate: "2026-09-11",
        title: "본다이 산책",
        position: 2
      }),
      entity({
        id: "day-one",
        dayDate: "2026-09-10",
        title: "하버 첫날",
        position: 1
      })
    ],
    scheduleItems: [
      entity({
        id: "schedule-dinner",
        tripDayId: "day-one",
        placeId: "place-dinner",
        bookingId: "booking-dinner",
        title: "하버 디너",
        startsAt: "2026-09-10T20:00:00+10:00",
        endsAt: "2026-09-10T22:00:00+10:00",
        memo: "예약 시간에 맞춰 도착",
        travelMode: null,
        travelNote: "",
        position: 2,
        isFixed: true,
        isDone: false
      }),
      entity({
        id: "schedule-movement",
        tripDayId: "day-one",
        placeId: "place-opera",
        bookingId: null,
        title: "오페라 하우스로 이동",
        startsAt: "2026-09-10T13:00:00+10:00",
        endsAt: "2026-09-10T13:30:00+10:00",
        memo: "서큘러 키 이동",
        travelMode: "transit",
        travelNote: "L2 경전철",
        position: 1,
        isFixed: false,
        isDone: false
      }),
      entity({
        id: "schedule-bondi",
        tripDayId: "day-two",
        placeId: "place-bondi",
        bookingId: null,
        title: "본다이 산책",
        startsAt: "2026-09-11T10:00:00+10:00",
        endsAt: null,
        memo: "해변 산책",
        travelMode: "walk",
        travelNote: "해변 산책로",
        position: 1,
        isFixed: false,
        isDone: true
      })
    ],
    places: [
      entity({
        id: "place-opera",
        name: "Sydney Opera House",
        category: "attraction",
        status: "saved",
        address: "Bennelong Point",
        latitude: -33.8568,
        longitude: 151.2153,
        mapUrl: "https://www.google.com/maps/search/?api=1&query=Sydney+Opera+House",
        sourceUrl: null,
        imageUrl: null,
        description: "하버 명소",
        savedBy: "owner"
      }),
      entity({
        id: "place-dinner",
        name: "Quay",
        category: "restaurant",
        status: "saved",
        address: "Overseas Passenger Terminal",
        latitude: null,
        longitude: null,
        mapUrl: "https://www.google.com/maps/search/?api=1&query=Quay+Sydney",
        sourceUrl: null,
        imageUrl: null,
        description: "하버 디너",
        savedBy: "partner"
      }),
      entity({
        id: "place-bondi",
        name: "Bondi Beach",
        category: "attraction",
        status: "visited",
        address: "Bondi Beach NSW",
        latitude: -33.8915,
        longitude: 151.2767,
        mapUrl: "https://www.google.com/maps/search/?api=1&query=Bondi+Beach",
        sourceUrl: null,
        imageUrl: null,
        description: "해변",
        savedBy: "owner"
      })
    ],
    bookings: [
      entity({
        id: "booking-dinner",
        placeId: "place-dinner",
        bookingType: "restaurant",
        provider: "Quay",
        startsAt: "2026-09-10T20:00:00+10:00",
        endsAt: "2026-09-10T22:00:00+10:00",
        reservationCode: "PRIVATE-CODE",
        paymentStatus: "paid",
        externalUrl: null,
        documentUrl: null,
        memo: "",
        isFixed: true,
        isRequired: true
      })
    ],
    checkItems: [],
    expenses: [],
    notes: [],
    votes: [],
    activity: [],
    syncVersion: 7
  };
}

function entity<T extends { id: string }>(
  value: T
): T & {
  tripId: string;
  version: number;
  updatedAt: string;
  updatedBy: string;
} {
  return {
    ...value,
    tripId: "trip-one",
    version: 1,
    updatedAt: "2026-09-09T00:00:00.000Z",
    updatedBy: "owner"
  };
}
