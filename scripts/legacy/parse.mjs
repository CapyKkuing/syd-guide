import { load } from "cheerio";

const LEGACY_YEAR = 2026;

export function parseLegacySources(sources) {
  return {
    days: parseSchedule(requiredSource(sources, "schedule.html")),
    food: parsePlaces(requiredSource(sources, "food.html"), "food"),
    cafes: parsePlaces(requiredSource(sources, "cafe.html"), "cafe"),
    bookings: parseBookings(requiredSource(sources, "booking.html")),
    tips: parseTips(requiredSource(sources, "tips.html"))
  };
}

function parseSchedule(html) {
  const $ = load(html);
  return $(".day-card").map((dayIndex, element) => {
    const card = $(element);
    const heading = text(card.find(".day-head h2"));
    const dateMatch = heading.match(/(\d{1,2})\/(\d{1,2})/);
    if (!dateMatch) throw new Error(`일정 날짜를 읽을 수 없습니다: ${heading}`);
    const date = [
      LEGACY_YEAR,
      String(Number(dateMatch[1])).padStart(2, "0"),
      String(Number(dateMatch[2])).padStart(2, "0")
    ].join("-");
    return {
      id: `legacy-day-${String(dayIndex + 1).padStart(2, "0")}`,
      date,
      title: text(card.find(".day-head span")),
      position: dayIndex + 1,
      items: card.find(".timeline-item").map((itemIndex, itemElement) => {
        const item = $(itemElement);
        const time = text(item.find(".timeline-time"));
        return {
          id: `legacy-schedule-${String(dayIndex + 1).padStart(2, "0")}-${String(itemIndex + 1).padStart(2, "0")}`,
          title: text(item.find("strong")),
          startsAt: `${date}T${time}:00+11:00`,
          memo: text(item.find("p")),
          position: itemIndex + 1
        };
      }).get()
    };
  }).get();
}

function parsePlaces(html, kind) {
  const $ = load(html);
  return $(".card").map((index, element) => {
    const card = $(element);
    const prefix = kind === "food" ? "food" : "cafe";
    const description = card.find(".card-body p")
      .map((_, paragraph) => text($(paragraph)))
      .get()
      .join(" ");
    return {
      id: `legacy-${prefix}-${String(index + 1).padStart(3, "0")}`,
      name: text(card.find("h3")),
      category: kind === "food" ? "restaurant" : "cafe",
      legacyCategory: card.attr("data-category") ?? "",
      description,
      mapUrl: card.find('a[href*="google.com/maps"]').attr("href") ?? null,
      imageUrl: card.find("img").attr("src") ?? null
    };
  }).get();
}

function parseBookings(html) {
  const $ = load(html);
  return $(".booking-table tbody tr").map((index, element) => {
    const row = $(element);
    const cells = row.find("td").map((_, cell) => text($(cell))).get();
    return {
      id: `legacy-booking-${String(index + 1).padStart(2, "0")}`,
      provider: cells[0] ?? "",
      recommendation: cells[1] ?? "",
      priceAndTime: cells[2] ?? "",
      externalUrl: row.find("a[href]").attr("href") ?? null,
      memo: cells[4] ?? "",
      startsAt: `2026-10-${String(8 + index).padStart(2, "0")}T09:00:00+11:00`
    };
  }).get();
}

function parseTips(html) {
  const $ = load(html);
  return $(".card").map((index, element) => {
    const card = $(element);
    return {
      id: `legacy-tip-${String(index + 1).padStart(2, "0")}`,
      title: text(card.find("h3")),
      body: text(card.find("p"))
    };
  }).get();
}

function requiredSource(sources, name) {
  const value = sources[name];
  if (typeof value !== "string") throw new Error(`${name} 원본이 필요합니다.`);
  return value;
}

function text(element) {
  return element.text().replace(/\s+/g, " ").trim();
}
