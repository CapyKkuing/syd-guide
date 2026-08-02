import { sydneyRoutePlaces } from "./sydney-route-places.mjs";

const IMPORT_KEY = "legacy-sydney-v1";
const TRIP_ID = "legacy-sydney-2026";
const IMPORTED_AT = "2026-07-28T00:00:00.000Z";
const guard =
  `WHERE NOT EXISTS (SELECT 1 FROM data_imports WHERE key = '${IMPORT_KEY}')`;

export function renderLegacySql(data) {
  const routePlaceByScheduleId = new Map(sydneyRoutePlaces.flatMap((place) =>
    place.scheduleIds.map((scheduleId) => [scheduleId, place])
  ));
  const statements = [
    "PRAGMA foreign_keys = ON;",
    "BEGIN TRANSACTION;",
    insert("trips", [
      "id", "title", "destination", "start_date", "end_date", "time_zone",
      "status", "cover_image_url", "version", "sync_version", "deleted_at",
      "purge_after", "created_by", "updated_by", "created_at", "updated_at"
    ], [
      TRIP_ID, "시드니 8일 여행", "Sydney, Australia", "2026-10-08",
      "2026-10-15", "Australia/Sydney", "upcoming",
      "images/sydney_harbour_bridge.jpg", 1, 0, null, null, "owner", "owner",
      IMPORTED_AT, IMPORTED_AT
    ]),
    insert("trip_members", ["trip_id", "member_id", "joined_at"], [
      TRIP_ID, "owner", IMPORTED_AT
    ]),
    insert("trip_members", ["trip_id", "member_id", "joined_at"], [
      TRIP_ID, "partner", IMPORTED_AT
    ])
  ];

  for (const place of sydneyRoutePlaces) {
    statements.push(insert("places", [
      "id", "trip_id", "name", "category", "status", "address", "latitude",
      "longitude", "map_url", "source_url", "image_url", "description",
      "saved_by", "is_recommended", "is_saved", "provider",
      "provider_place_id", "version", "updated_by", "updated_at"
    ], [
      place.id, TRIP_ID, place.name, place.category, "saved", place.address,
      place.latitude, place.longitude, place.mapUrl, null, null, "일정 동선 장소",
      "owner", 0, 1, null, null, 1, "owner", IMPORTED_AT
    ]));
  }

  for (const day of data.days) {
    statements.push(insert("trip_days", [
      "id", "trip_id", "day_date", "title", "position", "version",
      "updated_by", "updated_at"
    ], [
      day.id, TRIP_ID, day.date, day.title, day.position, 1, "owner", IMPORTED_AT
    ]));
    for (const item of day.items) {
      const routePlace = routePlaceByScheduleId.get(item.id);
      statements.push(insert("schedule_items", [
        "id", "trip_id", "trip_day_id", "place_id", "booking_id", "title",
        "starts_at", "ends_at", "memo", "travel_mode", "travel_note",
        "position", "is_fixed", "is_done", "version", "updated_by", "updated_at"
      ], [
        item.id, TRIP_ID, day.id, routePlace?.id ?? null, null, item.title, item.startsAt, null,
        item.memo, null, "", item.position, 0, 0, 1, "owner", IMPORTED_AT
      ]));
    }
  }

  for (const place of [...data.food, ...data.cafes]) {
    statements.push(insert("places", [
      "id", "trip_id", "name", "category", "status", "address", "latitude",
      "longitude", "map_url", "source_url", "image_url", "description",
      "saved_by", "is_recommended", "is_saved", "provider",
      "provider_place_id", "version", "updated_by", "updated_at"
    ], [
      place.id, TRIP_ID, place.name, place.category, "saved", null, null, null,
      place.mapUrl, null, place.imageUrl, place.description, null, 1, 0, null,
      null, 1, "owner", IMPORTED_AT
    ]));
  }

  for (const booking of data.bookings) {
    const memo = [
      booking.recommendation,
      booking.priceAndTime,
      booking.memo
    ].filter(Boolean).join(" · ");
    statements.push(insert("bookings", [
      "id", "trip_id", "place_id", "booking_type", "provider", "starts_at",
      "ends_at", "reservation_code", "payment_status", "external_url",
      "document_url", "memo", "is_fixed", "version", "updated_by", "updated_at"
    ], [
      booking.id, TRIP_ID, null, "ticket", booking.provider, booking.startsAt,
      null, null, "unpaid", booking.externalUrl, null, memo, 1, 1, "owner",
      IMPORTED_AT
    ]));
  }

  for (const tip of data.tips) {
    statements.push(insert("notes", [
      "id", "trip_id", "target_type", "target_id", "visibility",
      "author_member_id", "body", "attachment_url", "version", "updated_by",
      "updated_at"
    ], [
      tip.id, TRIP_ID, "trip", null, "shared", "owner",
      `${tip.title}: ${tip.body}`, null, 1, "owner", IMPORTED_AT
    ]));
  }

  statements.push(
    insert("data_imports", ["key", "imported_at"], [IMPORT_KEY, IMPORTED_AT]),
    "COMMIT;"
  );
  return `${statements.join("\n\n")}\n`;
}

function insert(table, columns, values) {
  return [
    `INSERT INTO ${table} (${columns.join(", ")})`,
    `SELECT ${values.map(sqlValue).join(", ")}`,
    `${guard};`
  ].join("\n");
}

function sqlValue(value) {
  if (value === null) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}
