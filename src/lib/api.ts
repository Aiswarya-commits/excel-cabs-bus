import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError } from "./errors";

type Ctx<P> = { params: Promise<P> };
type Handler<P> = (req: Request, ctx: Ctx<P>) => Promise<Response | unknown>;

/** Wraps a route handler: consistent JSON envelope + error responses (SDD §8). */
export function handle<P = Record<string, string>>(fn: Handler<P>) {
  return async (req: Request, ctx: Ctx<P>) => {
    try {
      const out = await fn(req, ctx);
      if (out instanceof Response) return out;
      return NextResponse.json(out ?? { ok: true });
    } catch (e) {
      if (e instanceof ApiError) {
        return NextResponse.json({ error: { code: e.code, message: e.message, details: e.details } }, { status: e.status });
      }
      if (e instanceof ZodError) {
        const msg = e.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ");
        return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: msg, details: e.issues } }, { status: 422 });
      }
      console.error("[api] unhandled error", e);
      return NextResponse.json({ error: { code: "INTERNAL", message: "Something went wrong. Please try again." } }, { status: 500 });
    }
  };
}
export async function jsonBody(req: Request): Promise<unknown> {
  try { return await req.json(); } catch { throw new ApiError(400, "BAD_JSON", "Request body must be valid JSON"); }
}
export function pageParams(url: URL) {
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const pageSize = Math.min(200, Math.max(1, Number(url.searchParams.get("pageSize") || 25)));
  return { page, pageSize, offset: (page - 1) * pageSize };
}
export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}
export function csvResponse(filename: string, rows: (string | number | null | undefined)[][]) {
  const esc = (v: unknown) => {
    let s = v === null || v === undefined ? "" : String(v);
    if (/^[=+\-@]/.test(s)) s = `'${s}`; // neutralise spreadsheet formula injection
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = "﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
  return new Response(body, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"` },
  });
}
