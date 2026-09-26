// Thin fetch wrapper for /api. Turns failures into ApiError with a message that is safe
// to show to the user.
import type { ApiError as ApiErrorBody } from '../../../shared/types';

export class ApiError extends Error {
  constructor(
    /** HTTP status, or 0 for a network failure. */
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const OFFLINE_MESSAGE =
  "You're offline, so that wasn't saved. Reconnect to the internet and try again.";

function isErrorBody(v: unknown): v is ApiErrorBody {
  return typeof v === 'object' && v !== null && typeof (v as ApiErrorBody).error === 'string';
}

export async function api<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, OFFLINE_MESSAGE);
  }

  if (res.status === 204) return undefined as T;
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON body (e.g. a proxy error page)
  }
  if (!res.ok) {
    const message = isErrorBody(data)
      ? data.error
      : `The server had a problem (HTTP ${res.status}). Try again in a moment.`;
    throw new ApiError(res.status, message);
  }
  return data as T;
}

export function errorMessage(err: unknown): string {
  return err instanceof ApiError
    ? err.message
    : 'Something unexpected went wrong. Reload the app and try again.';
}
