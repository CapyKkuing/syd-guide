import { describe, expect, it } from "vitest";
import { mapSnapshotToWorkspace } from "../../../data/api/snapshotMappers";
import { createTripSnapshot } from "../../../test/snapshotSamples";
import { searchTrip } from "./searchTrip";

describe("searchTrip", () => {
  it("never indexes reservation codes and ignores one-character queries", () => {
    const workspace = mapSnapshotToWorkspace(
      createTripSnapshot(),
      { memberId: "owner", role: "owner" },
      new Date("2026-09-10T01:00:00Z")
    );

    expect(searchTrip(workspace, "PRIVATE-CODE")).toEqual([]);
    expect(searchTrip(workspace, "Q")).toEqual([]);
    expect(searchTrip(workspace, "Quay")[0]).toMatchObject({
      kind: "booking",
      title: "Quay"
    });
  });
});
