import { afterEach, describe, expect, it, vi } from "vitest";
import { GoogleDriveProvider } from "./googleDriveProvider";

describe("GoogleDriveProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(window, "google");
  });

  it("finds one untrashed child folder with an escaped Drive query", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      files: [{ id: "preview-folder" }],
    }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    }));
    vi.stubGlobal("fetch", fetcher);
    const initTokenClient: NonNullable<Window["google"]>["accounts"]["oauth2"]["initTokenClient"] = vi.fn((config) => ({
      requestAccessToken: () => config.callback({ access_token: "test-access-token" }),
    }));
    Object.defineProperty(window, "google", {
      configurable: true,
      value: {
        accounts: {
          oauth2: {
            initTokenClient,
          },
        },
      },
    });
    const provider = new GoogleDriveProvider();
    await provider.connect("test-client-id");

    await expect(provider.findFolder("앱 미리보기 'QA' \\ 폴더", "root'id"))
      .resolves.toEqual({ id: "preview-folder" });

    expect(fetcher).toHaveBeenCalledOnce();
    const [requestUrl, requestInit] = fetcher.mock.calls[0] as [string, RequestInit];
    const url = new URL(requestUrl);
    expect(url.origin + url.pathname).toBe("https://www.googleapis.com/drive/v3/files");
    expect(url.searchParams.get("fields")).toBe("files(id)");
    expect(url.searchParams.get("pageSize")).toBe("1");
    expect(url.searchParams.get("q")).toBe(
      "'root\\'id' in parents and name = '앱 미리보기 \\'QA\\' \\\\ 폴더' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    );
    expect(new Headers(requestInit.headers).get("Authorization"))
      .toBe("Bearer test-access-token");
  });

  it("removes a newly uploaded file when assigning its parent fails", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "orphan-file" }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetcher);
    const initTokenClient: NonNullable<Window["google"]>["accounts"]["oauth2"]["initTokenClient"] = vi.fn((config) => ({
      requestAccessToken: () => config.callback({ access_token: "test-access-token" }),
    }));
    Object.defineProperty(window, "google", {
      configurable: true,
      value: {
        accounts: {
          oauth2: {
            initTokenClient,
          },
        },
      },
    });
    const provider = new GoogleDriveProvider();
    await provider.connect("test-client-id");

    await expect(provider.upload(
      "preview-folder",
      "photo.jpg",
      new Blob(["photo"], { type: "image/jpeg" })
    )).rejects.toThrow("Google Drive 요청에 실패했습니다. (500)");

    expect(fetcher).toHaveBeenCalledTimes(3);
    const [cleanupUrl, cleanupInit] = fetcher.mock.calls[2] as [string, RequestInit];
    expect(cleanupUrl).toBe("https://www.googleapis.com/drive/v3/files/orphan-file");
    expect(cleanupInit.method).toBe("DELETE");
    expect(new Headers(cleanupInit.headers).get("Authorization"))
      .toBe("Bearer test-access-token");
  });
});
