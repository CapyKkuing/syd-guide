import { useMemo, useState, type CSSProperties } from "react";
import type { MapPlaceView, ScheduleDayView } from "../../data/contracts";
import { MapPlaceSheet } from "./MapPlaceSheet";

type CategoryFilter = "all" | MapPlaceView["category"];
type StatusFilter = "all" | MapPlaceView["status"];

const categories: Array<{ value: CategoryFilter; label: string }> = [
  { value: "all", label: "전체" },
  { value: "restaurant", label: "맛집" },
  { value: "cafe", label: "카페" },
  { value: "attraction", label: "관광" },
  { value: "lodging", label: "숙소" },
  { value: "transport", label: "교통" }
];

const statuses: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "전체" },
  { value: "saved", label: "저장" },
  { value: "maybe", label: "고민" },
  { value: "visited", label: "방문" }
];

const categoryLabels: Record<MapPlaceView["category"], string> = {
  restaurant: "맛집",
  cafe: "카페",
  attraction: "관광",
  lodging: "숙소",
  transport: "교통"
};

const statusLabels: Record<MapPlaceView["status"], string> = {
  saved: "저장",
  maybe: "고민",
  visited: "방문"
};

function bounded(value: number, maximum: number): number {
  return Number.isFinite(value) ? Math.min(Math.max(value, 0), maximum) : 0;
}

function markerStyle(place: MapPlaceView): CSSProperties {
  return {
    left: `${bounded(place.x, 100)}%`,
    top: `${bounded(place.y, 70) / 0.7}%`
  };
}

function markerDescriptionId(placeId: string): string {
  return `map-marker-description-${encodeURIComponent(placeId)}`;
}

export function MapPage({ places, days }: { places: MapPlaceView[]; days: ScheduleDayView[] }) {
  const [search, setSearch] = useState("");
  const [dayDate, setDayDate] = useState("all");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [selectedPlace, setSelectedPlace] = useState<MapPlaceView | null>(null);
  const [returnFocusTo, setReturnFocusTo] = useState<HTMLElement | null>(null);

  const filteredPlaces = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return places.filter((place) => (
      (dayDate === "all" || place.dayDate === dayDate)
      && (category === "all" || place.category === category)
      && (status === "all" || place.status === status)
      && (!normalizedSearch || `${place.name} ${place.address}`.toLocaleLowerCase().includes(normalizedSearch))
    ));
  }, [category, dayDate, places, search, status]);

  const dates = Array.from(new Set(days.map((day) => day.date)));
  const resetFilters = () => {
    setSearch("");
    setDayDate("all");
    setCategory("all");
    setStatus("all");
  };
  const openPlace = (place: MapPlaceView, opener: HTMLElement) => {
    setReturnFocusTo(opener);
    setSelectedPlace(place);
  };

  return (
    <section className="map-page" aria-labelledby="map-title">
      <header className="map-page__header">
        <h1 id="map-title">지도</h1>
        <p>저장한 장소를 조건에 맞게 확인합니다.</p>
      </header>

      <div className="map-filters">
        <label className="map-search">
          <span>장소 검색</span>
          <input aria-label="장소 검색" onChange={(event) => setSearch(event.target.value)} type="search" value={search} />
        </label>
        <fieldset className="map-filter-group">
          <legend>날짜</legend>
          <div>
            <button aria-pressed={dayDate === "all"} className={dayDate === "all" ? "is-selected" : undefined} onClick={() => setDayDate("all")} type="button">전체</button>
            {dates.map((date) => <button key={date} aria-pressed={dayDate === date} className={dayDate === date ? "is-selected" : undefined} onClick={() => setDayDate(date)} type="button">{date}</button>)}
          </div>
        </fieldset>
        <fieldset className="map-filter-group">
          <legend>분류</legend>
          <div>{categories.map((option) => <button key={option.value} aria-pressed={category === option.value} className={category === option.value ? "is-selected" : undefined} onClick={() => setCategory(option.value)} type="button">{option.label}</button>)}</div>
        </fieldset>
        <fieldset className="map-filter-group">
          <legend>장소 상태</legend>
          <div>{statuses.map((option) => <button key={option.value} aria-pressed={status === option.value} className={status === option.value ? "is-selected" : undefined} onClick={() => setStatus(option.value)} type="button">{option.label}</button>)}</div>
        </fieldset>
      </div>

      <p aria-live="polite" className="map-result-count">{filteredPlaces.length}개 장소</p>

      <div className="map-page__content">
        <div className="map-preview" aria-label="정적 지도 미리보기">
          <svg aria-label="선택한 장소의 정적 경로 미리보기" preserveAspectRatio="none" role="img" viewBox="0 0 100 70">
            <title>선택한 장소의 정적 경로 미리보기</title>
            <path className="map-preview__grid" d="M0 14H100M0 28H100M0 42H100M0 56H100M20 0V70M40 0V70M60 0V70M80 0V70" />
            {filteredPlaces.length > 1 ? <polyline className="map-preview__route" points={filteredPlaces.map((place) => `${bounded(place.x, 100)},${bounded(place.y, 70)}`).join(" ")} /> : null}
          </svg>
          {filteredPlaces.map((place) => (
            <button aria-describedby={markerDescriptionId(place.id)} aria-label={`${place.name} 상세 보기`} className="map-marker" key={place.id} onClick={(event) => openPlace(place, event.currentTarget)} style={markerStyle(place)} type="button">
              <span aria-hidden="true">{place.name.slice(0, 1)}</span>
              <span className="map-marker__description" id={markerDescriptionId(place.id)}>{categoryLabels[place.category]} · {statusLabels[place.status]} · {place.address}</span>
            </button>
          ))}
        </div>

        <section className="map-place-list-section" aria-labelledby="map-list-title">
          <h2 id="map-list-title">장소 목록</h2>
          <ol aria-label="장소 목록" className="map-place-list">
            {filteredPlaces.map((place) => (
              <li key={place.id}>
                <button aria-label={`${place.name}, ${categoryLabels[place.category]}, ${statusLabels[place.status]}, ${place.address}`} className="map-place-card" onClick={(event) => openPlace(place, event.currentTarget)} type="button">
                  <strong>{place.name}</strong>
                  <span>{categoryLabels[place.category]} · {statusLabels[place.status]}</span>
                  <span>{place.address}</span>
                </button>
              </li>
            ))}
          </ol>
          {filteredPlaces.length === 0 ? (
            <div className="map-empty" role="status">
              <p>조건에 맞는 장소가 없습니다</p>
              <button className="secondary-button" onClick={resetFilters} type="button">필터 초기화</button>
            </div>
          ) : null}
        </section>
      </div>

      {selectedPlace ? <MapPlaceSheet onClose={() => setSelectedPlace(null)} place={selectedPlace} returnFocusTo={returnFocusTo} /> : null}
    </section>
  );
}
