import { describe, expect, it } from "vitest";
import type { MutationRequest } from "../../shared/mutations";
import { ApiClient } from "./client";
import { ApiClientError } from "./errors";

const mutation: MutationRequest<"vote"> = {
  idempotencyKey: "vote-key",
  entity: "vote",
  action: "create",
  entityId: "vote-one",
  baseVersion: null,
  payload: {
    targetType: "place",
    targetId: "place-one",
    choice: "must",
  },
};

function captured(value: Request | null): Request {
  if (!value) throw new Error("request was not captured");
  return value;
}

describe("ApiClient", () => {
  it("returns a typed not-modified snapshot result and sends its ETag", async () => {
    let received: Request | null = null;
    const client = new ApiClient(
      async (input, init) => {
        received = new Request(input, init);
        return new Response(null, {
          status: 304,
          headers: { ETag: "\"trip-trip-one-4\"" },
        });
      },
      "http://localhost"
    );

    const result = await client.getTripSnapshot(
      "trip-one",
      "\"trip-trip-one-4\""
    );

    expect(result).toEqual({
      snapshot: null,
      etag: "\"trip-trip-one-4\"",
      notModified: true,
    });
    expect(captured(received).url).toBe(
      "http://localhost/api/trips/trip-one/snapshot"
    );
    expect(captured(received).headers.get("If-None-Match")).toBe(
      "\"trip-trip-one-4\""
    );
  });

  it("serializes a mutation and returns the versioned success", async () => {
    let received: Request | null = null;
    const client = new ApiClient(async (input, init) => {
      received = new Request(input, init);
      return Response.json({
        entity: "vote",
        entityId: "vote-one",
        version: 1,
        syncVersion: 8,
      });
    });

    const result = await client.mutate("trip-one", mutation);

    expect(result).toEqual({
      entity: "vote",
      entityId: "vote-one",
      version: 1,
      syncVersion: 8,
    });
    expect(captured(received).method).toBe("POST");
    expect(await captured(received).json()).toEqual(mutation);
  });

  it("preserves structured API conflict details without exposing malformed bodies", async () => {
    const conflict = new ApiClient(async () => Response.json({
      error: {
        code: "VERSION_CONFLICT",
        message: "다른 기기에서 항목이 수정되었습니다.",
        details: { current: { id: "place-one", version: 3 } },
      },
    }, { status: 409 }));
    const malformed = new ApiClient(async () =>
      new Response("<html>failure</html>", { status: 502 })
    );

    const conflictError = await conflict.mutate("trip-one", mutation)
      .catch((error: unknown) => error);
    const malformedError = await malformed.getTripSnapshot("trip-one")
      .catch((error: unknown) => error);

    expect(conflictError).toBeInstanceOf(ApiClientError);
    expect(conflictError).toMatchObject({
      status: 409,
      code: "VERSION_CONFLICT",
      details: { current: { id: "place-one", version: 3 } },
    });
    expect(malformedError).toMatchObject({
      status: 502,
      code: "HTTP_ERROR",
      message: "요청을 처리하지 못했습니다.",
    });
  });
});
