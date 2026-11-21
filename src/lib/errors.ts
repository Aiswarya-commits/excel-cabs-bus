export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}
export const badRequest = (m: string, d?: unknown) => new ApiError(400, "BAD_REQUEST", m, d);
export const unauthorized = (m = "Please log in") => new ApiError(401, "UNAUTHORIZED", m);
export const forbidden = (m = "You do not have permission for this action") => new ApiError(403, "FORBIDDEN", m);
export const notFound = (m = "Not found") => new ApiError(404, "NOT_FOUND", m);
export const conflict = (m: string, code = "CONFLICT", d?: unknown) => new ApiError(409, code, m, d);
