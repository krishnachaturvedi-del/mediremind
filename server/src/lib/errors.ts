export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (msg: string, code = "BAD_REQUEST") =>
  new ApiError(400, code, msg);
export const unauthorized = (msg = "Authentication required.") =>
  new ApiError(401, "UNAUTHORIZED", msg);
export const forbidden = (msg = "You do not have access to this resource.") =>
  new ApiError(403, "FORBIDDEN", msg);
export const notFound = (msg = "Resource not found.") =>
  new ApiError(404, "NOT_FOUND", msg);
export const conflict = (msg: string, code = "CONFLICT") =>
  new ApiError(409, code, msg);
