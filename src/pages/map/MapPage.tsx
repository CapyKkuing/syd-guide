import { useCallback, useEffect, useMemo, useState } from "react";
import type { MapPlaceView, ScheduleDayView } from "../../data/contracts";
import { orderScheduleItems, placesInScheduleOrder } from "../../domain/scheduleOrder";
import type { TripMutationController } from "../../services/mutations/controller";
import { MapCanvas, type MapLoader } from "./MapCanvas";
import { MapPlaceSheet } from "./MapPlaceSheet";
import { PlaceEditorDialog } from "./PlaceEditorDialog";

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

export function MapPage({
  days,
  mapLoader,
  mutationController,
  places,
  viewerMemberId = ""
}: {
  days: ScheduleDayView[];
  mapLoader?: MapLoader;
  mutationController?: TripMutationController;
  places: MapPlaceView[];
  viewerMemberId?: string;
}) {
  const [search, setSearch] = useState("");
  const [dayDate, setDayDate] = useState("all");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [selectedPlace, setSelectedPlace] = useState<MapPlaceView | null>(null);
  const [editingPlace, setEditingPlace] = useState<MapPlaceView | null | undefined>();
  const [returnFocusTo, setReturnFocusTo] = useState<HTMLElement | null>(null);
  const [online, setOnline] = useState(() => window.navigator.onLine);

  useEffect(() => {
    const updateOnlineStatus = () => setOnline(window.navigator.onLine);
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  const filteredPlaces = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    const selectedDay = dayDate === "all"
      ? null
      : days.find((day) => day.date === dayDate) ?? null;
    const scheduledPlaces = selectedDay
      ? placesInScheduleOrder(orderScheduleItems(selectedDay.items), places)
      : [];
    const scheduledIds = new Set(scheduledPlaces.map((place) => place.id));
    const orderedPlaces = selectedDay
      ? [...scheduledPlaces, ...places.filter((place) => !scheduledIds.has(place.id))]
      : places;
    return orderedPlaces.filter((place) => (
      (dayDate === "all" || place.dayDate === dayDate)
      && (category === "all" || place.category === category)
      && (status === "all" || place.status === status)
      && (!normalizedSearch || `${place.name} ${place.address}`.toLocaleLowerCase().includes(normalizedSearch))
    ));
  }, [category, dayDate, days, places, search, status]);

  const dates = Array.from(new Set(days.map((day) => day.date)));
  const resetFilters = () => {
    setSearch("");
    setDayDate("all");
    setCategory("all");
    setStatus("all");
  };
  const openPlace = useCallback(({ place, opener }: { place: MapPlaceView; opener: HTMLElement }) => {
    setReturnFocusTo(opener);
    setSelectedPlace(place);
  }, []);

  return (
    <section className="map-page" aria-labelledby="map-title">
      <header className="map-page__header">
        <div>
          <h1 id="map-title">지도</h1>
          <p>저장한 장소를 조건에 맞게 확인합니다.</p>
        </div>
        <button
          className="primary-button"
          disabled={!mutationController}
          onClick={() => setEditingPlace(null)}
          type="button"
        >
          장소 추가
        </button>
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
        {online ? (
          <MapCanvas
            connectRoute={dayDate !== "all"}
            loader={mapLoader}
            numberedMarkers={dayDate !== "all"}
            onOpenPlace={openPlace}
            places={filteredPlaces}
          />
        ) : (
          <p className="map-offline-status" role="status">오프라인 — 저장된 장소 목록을 표시합니다.</p>
        )}
        <section className="map-place-list-section" aria-labelledby="map-list-title">
          <h2 id="map-list-title">장소 목록</h2>
          <ol aria-label="장소 목록" className="map-place-list">
            {filteredPlaces.map((place) => (
              <li key={place.id}>
                <button aria-label={`${place.name}, ${categoryLabels[place.category]}, ${statusLabels[place.status]}, ${place.address}`} className="map-place-card" onClick={(event) => openPlace({ place, opener: event.currentTarget })} type="button">
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

      {selectedPlace ? (
        <MapPlaceSheet
          controller={mutationController}
          onClose={() => setSelectedPlace(null)}
          onEdit={() => {
            setEditingPlace(selectedPlace);
            setSelectedPlace(null);
          }}
          place={selectedPlace}
          returnFocusTo={returnFocusTo}
          viewerMemberId={viewerMemberId}
        />
      ) : null}
      {editingPlace !== undefined && mutationController ? (
        <PlaceEditorDialog
          controller={mutationController}
          onClose={() => setEditingPlace(undefined)}
          place={editingPlace}
          viewerMemberId={viewerMemberId}
        />
      ) : null}
    </section>
  );
}
