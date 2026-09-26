import type { ApiError } from '../../shared/types';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export function noContent(): Response {
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
}

export function errorResponse(status: number, message: string): Response {
  return json<ApiError>({ error: message }, status);
}

const MAX_BODY = 16 * 1024;

export async function readJson(request: Request): Promise<unknown> {
  const raw = await request.text();
  if (raw.length > MAX_BODY) throw new HttpError(413, 'That request is too large.');
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new HttpError(400, 'The request body is not valid JSON.');
  }
}

/** Builds "a = ?, b = ?" for the defined keys of a patch. Booleans become 1/0. */
export function setClause(patch: Record<string, string | number | boolean | undefined>): {
  sql: string;
  values: Array<string | number>;
} {
  const cols: string[] = [];
  const values: Array<string | number> = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    cols.push(`${k} = ?`);
    values.push(typeof v === 'boolean' ? (v ? 1 : 0) : v);
  }
  return { sql: cols.join(', '), values };
}
