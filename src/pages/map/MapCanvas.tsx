import { useEffect, useRef, useState, type Dispatch } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type * as MapLibre from "maplibre-gl";
import type { MapPlaceView } from "../../data/contracts";

export type MapRuntime = Pick<
  typeof MapLibre,
  "Map" | "Marker" | "NavigationControl"
>;

export type MapLoader = () => Promise<MapRuntime>;
export interface MapOpenRequest {
  place: MapPlaceView;
  opener: HTMLElement;
}

const defaultLoader: MapLoader = async () => {
  const [runtime, worker] = await Promise.all([
    import("maplibre-gl"),
    import("maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url")
  ]);
  runtime.setWorkerUrl(worker.default);
  return runtime;
};

export function MapCanvas({
  connectRoute = false,
  loader = defaultLoader,
  numberedMarkers = false,
  onOpenPlace,
  places
}: {
  connectRoute?: boolean;
  loader?: MapLoader;
  numberedMarkers?: boolean;
  onOpenPlace: Dispatch<MapOpenRequest>;
  places: MapPlaceView[];
}) {
  const container = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const failed = useRef(false);
  const hasLocatedPlaces = places.some(hasCoordinates);

  useEffect(() => {
    const retry = () => {
      if (failed.current) setAttempt((value) => value + 1);
    };
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, []);

  useEffect(() => {
    const located = places.filter(hasCoordinates);
    if (!navigator.onLine) {
      failed.current = true;
      return;
    }
    if (!container.current || located.length === 0) {
      return;
    }
    let active = true;
    let map: MapLibre.Map | null = null;
    void loader().then((module) => {
      if (!active || !container.current) return;
      const runtime = module as unknown as MapRuntime;
      const createdMap = new runtime.Map({
        container: container.current,
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: [located[0]!.longitude!, located[0]!.latitude!],
        zoom: 11
      });
      map = createdMap;
      createdMap.addControl(new runtime.NavigationControl());
      if (connectRoute && located.length > 1) {
        createdMap.once("load", () => {
          if (!active || !container.current) return;
          const routeColor = getComputedStyle(container.current)
            .getPropertyValue("--accent")
            .trim() || getComputedStyle(container.current).color;
          createdMap.addSource("schedule-route", {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: located.map((place) => [place.longitude!, place.latitude!]),
              },
            },
          });
          createdMap.addLayer({
            id: "schedule-route-line",
            type: "line",
            source: "schedule-route",
            layout: {
              "line-cap": "round",
              "line-join": "round",
            },
            paint: {
              "line-color": routeColor,
              "line-opacity": 0.72,
              "line-width": 4,
            },
          });
        });
      }
      located.forEach((place, index) => {
        const marker = document.createElement("button");
        marker.type = "button";
        marker.className = "maplibre-place-marker";
        marker.ariaLabel = numberedMarkers
          ? `${index + 1}번 ${place.name} 상세 보기`
          : `${place.name} 상세 보기`;
        marker.textContent = numberedMarkers ? String(index + 1) : place.name.slice(0, 1);
        marker.addEventListener("click", () => onOpenPlace({ place, opener: marker }));
        new runtime.Marker({ element: marker })
          .setLngLat([place.longitude!, place.latitude!])
          .addTo(createdMap);
      });
      failed.current = false;
      setStatus("ready");
    }).catch(() => {
      if (!active) return;
      failed.current = true;
      setStatus("error");
    });
    return () => {
      active = false;
      try {
        map?.remove();
      } catch {
        map = null;
      }
    };
  }, [attempt, connectRoute, loader, numberedMarkers, onOpenPlace, places]);

  return (
    <div className="map-canvas-shell">
      <div aria-label="온라인 지도" className="map-canvas" ref={container} />
      {!navigator.onLine ? <p aria-label="오프라인 지도" role="status">오프라인에서는 장소 목록을 이용하세요.</p> : null}
      {navigator.onLine && hasLocatedPlaces && status === "loading" ? <p role="status">온라인 지도를 불러오는 중입니다.</p> : null}
      {navigator.onLine && hasLocatedPlaces && status === "error" ? <p aria-label="온라인 지도를 불러오지 못했습니다" role="status">온라인 지도를 불러오지 못했습니다. 장소 목록은 계속 사용할 수 있습니다.</p> : null}
    </div>
  );
}

function hasCoordinates(place: MapPlaceView): boolean {
  return place.latitude !== null && place.longitude !== null
    && Number.isFinite(place.latitude) && Number.isFinite(place.longitude);
}
