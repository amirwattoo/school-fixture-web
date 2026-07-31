export type UserRole = "PRINCIPAL" | "TIMETABLE_INCHARGE";

export type AuthUser = {
  id: string;
  schoolId: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  school: {
    id: string;
    name: string;
    shortName: string | null;
    timezone: string;
    academicYear: string;
    periodsPerDay: number;
  };
};

type SuccessResponse<T> = {
  success: true;
  data: T;
  message: string;
};

type ErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

const parseResponse = async <T>(response: Response) => {
  const body = (await response.json().catch(() => null)) as
    SuccessResponse<T> | ErrorResponse | null;

  if (!response.ok || !body || body.success === false) {
    const message =
      body && body.success === false
        ? body.error.message
        : "The server could not complete the request";
    throw new ApiClientError(
      body && body.success === false ? body.error.code : "REQUEST_FAILED",
      message,
    );
  }
  return body.data;
};

export const refreshSession = async () => {
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });
  const data = await parseResponse<{ accessToken: string; user: AuthUser }>(
    response,
  );
  setAccessToken(data.accessToken);
  return data;
};

export const apiRequest = async <T>(
  path: string,
  init: RequestInit = {},
  retryOnUnauthorized = true,
): Promise<T> => {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  if (response.status === 401 && retryOnUnauthorized) {
    await refreshSession();
    return apiRequest<T>(path, init, false);
  }
  return parseResponse<T>(response);
};
