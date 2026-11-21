"use client";
// Browser-side API helper — same REST API the future Android/iOS apps will use.
export class ClientError extends Error { constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message); } }

export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(`/api/v1${path}`, {
    ...rest, credentials: "same-origin",
    headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...(rest.headers || {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (res.status === 401 && typeof window !== "undefined" && location.pathname.startsWith("/admin") && !location.pathname.startsWith("/admin/login")) {
    location.href = `/admin/login?next=${encodeURIComponent(location.pathname)}`;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ClientError(res.status, data?.error?.code ?? "ERROR", data?.error?.message ?? "Request failed", data?.error?.details);
  return data as T;
}
