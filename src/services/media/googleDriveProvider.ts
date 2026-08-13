/* eslint-disable no-unused-vars */
import type {
  MediaObject,
  MediaStorageProviderClient,
} from "./provider";

interface TokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  requestAccessToken(options?: { prompt?: string }): void;
}

interface GoogleOAuthError {
  type: string;
}

interface GoogleIdentity {
  accounts: {
    oauth2: {
      initTokenClient(config: {
        client_id: string;
        scope: string;
        callback: (response: TokenResponse) => void;
        error_callback: (error: GoogleOAuthError) => void;
      }): TokenClient;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

export class GoogleDriveProvider implements MediaStorageProviderClient {
  readonly provider = "google-drive" as const;
  private accessToken: string | null = null;

  get connected(): boolean {
    return this.accessToken !== null;
  }

  async connect(clientId: string): Promise<void> {
    await loadGoogleIdentity();
    const google = window.google;
    if (!google) throw new Error("Google 로그인 모듈을 불러오지 못했습니다.");
    this.accessToken = await new Promise<string>((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: DRIVE_SCOPE,
        callback: (response) => {
          if (response.access_token) {
            resolve(response.access_token);
          } else {
            reject(new Error(response.error_description ?? "Google Drive 연결이 취소되었습니다."));
          }
        },
        error_callback: (error) => reject(new Error(googleOAuthErrorMessage(error.type))),
      });
      client.requestAccessToken();
    });
  }

  async createFolder(
    name: string,
    parentObjectId?: string
  ): Promise<MediaObject> {
    return this.requestJson<MediaObject>(`${DRIVE_API}/files?fields=id`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        mimeType: "application/vnd.google-apps.folder",
        ...(parentObjectId ? { parents: [parentObjectId] } : {}),
      }),
    });
  }

  async findFolder(name: string, parentObjectId: string): Promise<MediaObject | null> {
    const query = [
      `'${escapeDriveQueryValue(parentObjectId)}' in parents`,
      `name = '${escapeDriveQueryValue(name)}'`,
      "mimeType = 'application/vnd.google-apps.folder'",
      "trashed = false",
    ].join(" and ");
    const result = await this.requestJson<{ files: MediaObject[] }>(
      `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id)&pageSize=1`
    );
    return result.files[0] ?? null;
  }

  async upload(
    rootObjectId: string,
    name: string,
    blob: Blob
  ): Promise<MediaObject> {
    const created = await this.requestJson<MediaObject>(
      `${DRIVE_UPLOAD_API}/files?uploadType=media&fields=id`,
      {
        method: "POST",
        headers: { "Content-Type": blob.type || "application/octet-stream" },
        body: blob,
      }
    );
    try {
      return await this.requestJson<MediaObject>(
        `${DRIVE_API}/files/${encodeURIComponent(created.id)}?addParents=${encodeURIComponent(rootObjectId)}&fields=id`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        }
      );
    } catch (error) {
      await this.remove(created.id).catch(() => undefined);
      throw error;
    }
  }

  async download(objectId: string): Promise<Blob> {
    const response = await this.request(
      `${DRIVE_API}/files/${encodeURIComponent(objectId)}?alt=media`
    );
    return response.blob();
  }

  async remove(objectId: string): Promise<void> {
    await this.request(
      `${DRIVE_API}/files/${encodeURIComponent(objectId)}`,
      { method: "DELETE" }
    );
  }

  folderUrl(rootObjectId: string): string {
    return `https://drive.google.com/drive/folders/${encodeURIComponent(rootObjectId)}`;
  }

  private async requestJson<T>(url: string, init?: RequestInit): Promise<T> {
    return (await this.request(url, init)).json() as Promise<T>;
  }

  private async request(url: string, init: RequestInit = {}): Promise<Response> {
    if (!this.accessToken) throw new Error("Google Drive를 먼저 연결해 주세요.");
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${this.accessToken}`);
    const response = await fetch(url, { ...init, headers });
    if (!response.ok) {
      if (response.status === 401) this.accessToken = null;
      throw new Error(
        response.status === 403
          ? "Google Drive 폴더 권한 또는 사용 한도를 확인해 주세요."
          : `Google Drive 요청에 실패했습니다. (${response.status})`
      );
    }
    return response;
  }
}

function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function googleOAuthErrorMessage(type: string): string {
  if (type === "popup_failed_to_open") {
    return "Google Drive 연결 창이 차단되었습니다. 브라우저에서 팝업을 허용한 뒤 다시 시도해 주세요.";
  }
  if (type === "popup_closed") {
    return "Google Drive 연결 창이 닫혔습니다. 연결 버튼을 눌러 다시 시도해 주세요.";
  }
  return "Google Drive 연결 창을 열지 못했습니다. 다시 시도해 주세요.";
}

let googleIdentityPromise: Promise<void> | null = null;

function loadGoogleIdentity(): Promise<void> {
  if (window.google) return Promise.resolve();
  googleIdentityPromise ??= new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Google 로그인 모듈을 불러오지 못했습니다.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google 로그인 모듈을 불러오지 못했습니다."));
    document.head.append(script);
  });
  return googleIdentityPromise;
}
