export interface PlaceIdentity {
  address: string;
  latitude: number | null;
  longitude: number | null;
  name: string;
  providerPlaceId: string | null;
}

export function isSamePlace(left: PlaceIdentity, right: PlaceIdentity) {
  if (left.providerPlaceId && right.providerPlaceId) {
    return left.providerPlaceId === right.providerPlaceId;
  }

  if (normalize(left.name) !== normalize(right.name)) return false;

  const leftAddress = normalize(left.address);
  const rightAddress = normalize(right.address);
  if (leftAddress && rightAddress && leftAddress === rightAddress) return true;

  return hasCoordinates(left)
    && hasCoordinates(right)
    && Math.abs(left.latitude - right.latitude) < 0.0001
    && Math.abs(left.longitude - right.longitude) < 0.0001;
}

function hasCoordinates(
  place: PlaceIdentity
): place is PlaceIdentity & { latitude: number; longitude: number } {
  return place.latitude !== null
    && place.longitude !== null
    && Number.isFinite(place.latitude)
    && Number.isFinite(place.longitude);
}

function normalize(value: string) {
  return value.normalize("NFKD").toLocaleLowerCase().replace(/[^a-z0-9가-힣]/g, "");
}
