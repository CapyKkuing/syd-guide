export interface GoogleMapsPlace {
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
}

export function googleMapsSearchUrl(place: GoogleMapsPlace): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchQuery(place))}`;
}

export function googleMapsDirectionsUrl(place: GoogleMapsPlace): string {
  const destination = hasCoordinates(place)
    ? `${place.latitude},${place.longitude}`
    : searchQuery(place);
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

function searchQuery(place: GoogleMapsPlace): string {
  return [place.name, place.address].filter(Boolean).join(", ");
}

function hasCoordinates(place: GoogleMapsPlace): place is GoogleMapsPlace & {
  latitude: number;
  longitude: number;
} {
  return place.latitude !== null && place.longitude !== null
    && Number.isFinite(place.latitude) && Number.isFinite(place.longitude);
}
