export class ApiError extends Error {
  status: number;
  code: string;
  issues: { path: string; message: string }[];

  constructor(
    status: number,
    code: string,
    message: string,
    issues: { path: string; message: string }[] = []
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.issues = issues;
  }

  /** First validation message for a specific form field, if present. */
  fieldError(field: string): string | undefined {
    return this.issues.find((i) => i.path === field)?.message;
  }
}

/**
 * Base URL for the API. Empty in development (the Vite proxy serves /api on the
 * same origin). In production it is set via VITE_API_BASE_URL when the client
 * and API are deployed on different domains.
 */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API_BASE_URL + path, {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
      ...options,
    });
  } catch {
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "Could not reach the server. Check your connection and try again."
    );
  }

  if (res.status === 204) return undefined as T;

  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!res.ok) {
    const err = (body as { error?: { code?: string; message?: string; issues?: { path: string; message: string }[] } })?.error;
    throw new ApiError(
      res.status,
      err?.code ?? "UNKNOWN",
      err?.message ?? `Request failed (${res.status}).`,
      err?.issues ?? []
    );
  }
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "POST", body: data !== undefined ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PATCH", body: data !== undefined ? JSON.stringify(data) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
