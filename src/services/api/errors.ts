export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function errorFromResponse(
  response: Response
): Promise<ApiClientError> {
  const body: unknown = await response.json().catch(() => null);
  const error = typeof body === "object" && body !== null && "error" in body
    ? body.error
    : null;
  const fields = typeof error === "object" && error !== null ? error : null;
  const code = fields && "code" in fields && typeof fields.code === "string"
    ? fields.code
    : "HTTP_ERROR";
  const message =
    fields && "message" in fields && typeof fields.message === "string"
      ? fields.message
      : "요청을 처리하지 못했습니다.";
  const details = fields && "details" in fields ? fields.details : undefined;
  return new ApiClientError(response.status, code, message, details);
}
