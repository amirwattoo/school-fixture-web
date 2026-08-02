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
    details?: unknown;
  };
};

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

let accessToken: string | null = null;
let authGeneration = 0;
let refreshPromise: Promise<{
  accessToken: string;
  user: AuthUser;
}> | null = null;
const referenceCache = new Map<
  string,
  { expiresAt: number; request: Promise<unknown> }
>();
const MAX_REFERENCE_CACHE_ENTRIES = 100;

export const setAccessToken = (token: string | null) => {
  if (token !== accessToken) referenceCache.clear();
  accessToken = token;
  authGeneration += 1;
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
      body && body.success === false ? body.error.details : undefined,
    );
  }
  return body.data;
};

export const refreshSession = () => {
  if (refreshPromise) return refreshPromise;
  const generationAtStart = authGeneration;
  refreshPromise = fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  })
    .then((response) =>
      parseResponse<{ accessToken: string; user: AuthUser }>(response),
    )
    .then((data) => {
      if (authGeneration === generationAtStart) {
        setAccessToken(data.accessToken);
      }
      return data;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
};

export const apiRequest = async <T>(
  path: string,
  init: RequestInit = {},
  retryOnUnauthorized = true,
): Promise<T> => {
  if (retryOnUnauthorized && !accessToken) {
    await refreshSession();
  }
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  if (response.status === 401 && retryOnUnauthorized) {
    const rejectedToken = accessToken;
    try {
      await refreshSession();
    } catch (error) {
      if (accessToken === rejectedToken) setAccessToken(null);
      throw error;
    }
    return apiRequest<T>(path, init, false);
  }
  return parseResponse<T>(response);
};

export const cachedApiRequest = <T>(path: string, ttlMs = 60_000) => {
  const cached = referenceCache.get(path);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.request as Promise<T>;
  }
  const request = apiRequest<T>(path).catch((error) => {
    referenceCache.delete(path);
    throw error;
  });
  referenceCache.set(path, { expiresAt: Date.now() + ttlMs, request });
  while (referenceCache.size > MAX_REFERENCE_CACHE_ENTRIES) {
    const oldest = referenceCache.keys().next().value as string | undefined;
    if (!oldest) break;
    referenceCache.delete(oldest);
  }
  return request;
};

export const invalidateApiCache = (pathPrefix?: string) => {
  if (!pathPrefix) {
    referenceCache.clear();
    return;
  }
  for (const path of referenceCache.keys()) {
    if (path.startsWith(pathPrefix)) referenceCache.delete(path);
  }
};

export const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === "AbortError";

export const uploadApiRequest = async <T>(path: string, form: FormData, onProgress: (percent: number) => void, retryOnUnauthorized = true): Promise<T> => {
  if (!accessToken) await refreshSession();
  return new Promise<T>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `${API_URL}${path}`);
    request.withCredentials = true;
    if (accessToken) request.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100)); };
    request.onerror = () => reject(new ApiClientError("NETWORK_ERROR", "The upload could not reach the server"));
    request.onload = () => {
      try {
        if (request.status === 401 && retryOnUnauthorized) {
          refreshSession().then(() => uploadApiRequest<T>(path, form, onProgress, false)).then(resolve, reject);
          return;
        }
        const body = JSON.parse(request.responseText) as SuccessResponse<T> | ErrorResponse;
        if (request.status < 200 || request.status >= 300 || body.success === false) {
          const failure = body as ErrorResponse;
          reject(new ApiClientError(failure.error?.code ?? "UPLOAD_FAILED", failure.error?.message ?? "Upload failed", failure.error?.details));
        } else resolve((body as SuccessResponse<T>).data);
      } catch { reject(new ApiClientError("INVALID_RESPONSE", "The server returned an invalid response")); }
    };
    request.send(form);
  });
};
