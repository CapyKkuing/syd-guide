import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MapPlaceView } from "../../data/contracts";
import { MapCanvas } from "./MapCanvas";

const place = {
  id: "place-one",
  name: "Opera House",
  latitude: -33.8568,
  longitude: 151.2153
} as MapPlaceView;

describe("MapCanvas", () => {
  it("keeps an accessible failure status when the online map fails", async () => {
    render(
      <MapCanvas
        loader={() => Promise.reject(new Error("tiles unavailable"))}
        onOpenPlace={vi.fn()}
        places={[place]}
      />
    );

    expect(await screen.findByRole("status", {
      name: "온라인 지도를 불러오지 못했습니다"
    })).toBeVisible();
  });

  it("removes the map on unmount", async () => {
    const remove = vi.fn();
    class FakeMap {
      remove = remove;
      addControl() {}
    }
    class FakeMarker {
      setLngLat() { return this; }
      addTo() { return this; }
    }
    const loader = vi.fn().mockResolvedValue({
      Map: FakeMap,
      Marker: FakeMarker,
      NavigationControl: class {}
    });
    const view = render(<MapCanvas loader={loader} onOpenPlace={vi.fn()} places={[place]} />);

    await screen.findByLabelText("온라인 지도");
    view.unmount();
    expect(remove).toHaveBeenCalled();
  });
});
