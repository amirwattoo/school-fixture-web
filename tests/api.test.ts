import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";

import {
  apiRequest,
  cachedApiRequest,
  invalidateApiCache,
  refreshSession,
  setAccessToken,
  type AuthUser,
} from "../lib/api";

const originalFetch = globalThis.fetch;
const user: AuthUser = {
  id: "user-1",
  schoolId: "school-1",
  name: "Principal",
  email: "principal@example.local",
  role: "PRINCIPAL",
  isActive: true,
  mustChangePassword: false,
  school: {
    id: "school-1",
    name: "Test School",
    shortName: "TS",
    timezone: "Asia/Karachi",
    academicYear: "2026",
    periodsPerDay: 8,
  },
};

const success = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data, message: "ok" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
const unauthorized = () =>
  new Response(
    JSON.stringify({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Please sign in again" },
    }),
    { status: 401, headers: { "Content-Type": "application/json" } },
  );

beforeEach(() => {
  setAccessToken(null);
  invalidateApiCache();
});
after(() => {
  globalThis.fetch = originalFetch;
});

test("multiple protected requests share one refresh and attach its token", async () => {
  let refreshes = 0;
  let protectedRequests = 0;
  globalThis.fetch = async (input, init) => {
    if (String(input).endsWith("/auth/refresh")) {
      refreshes += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return success({ accessToken: "fresh-token", user });
    }
    protectedRequests += 1;
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer fresh-token");
    return success({ ok: true });
  };

  await Promise.all([
    apiRequest("/teachers"),
    apiRequest("/attendance?date=2026-08-03"),
    apiRequest("/fixtures?date=2026-08-03"),
  ]);
  assert.equal(refreshes, 1);
  assert.equal(protectedRequests, 3);
});

test("a 401 refreshes once and retries the original request once", async () => {
  setAccessToken("expired-token");
  let resourceRequests = 0;
  let refreshes = 0;
  globalThis.fetch = async (input, init) => {
    if (String(input).endsWith("/auth/refresh")) {
      refreshes += 1;
      return success({ accessToken: "replacement-token", user });
    }
    resourceRequests += 1;
    if (resourceRequests === 1) return unauthorized();
    assert.equal(
      new Headers(init?.headers).get("Authorization"),
      "Bearer replacement-token",
    );
    return success({ ok: true });
  };

  await apiRequest("/teachers");
  assert.equal(refreshes, 1);
  assert.equal(resourceRequests, 2);
});

test("missing refresh cookie fails without issuing an unauthenticated protected request", async () => {
  let protectedRequests = 0;
  globalThis.fetch = async (input) => {
    if (String(input).endsWith("/auth/refresh")) return unauthorized();
    protectedRequests += 1;
    return success({ ok: true });
  };

  await assert.rejects(() => apiRequest("/teachers"), /Please sign in again/);
  assert.equal(protectedRequests, 0);
});

test("a failed retried request does not create an infinite refresh loop", async () => {
  setAccessToken("expired-token");
  let resourceRequests = 0;
  let refreshes = 0;
  globalThis.fetch = async (input) => {
    if (String(input).endsWith("/auth/refresh")) {
      refreshes += 1;
      return success({ accessToken: "still-rejected", user });
    }
    resourceRequests += 1;
    return unauthorized();
  };

  await assert.rejects(() => apiRequest("/teachers"), /Please sign in again/);
  assert.equal(refreshes, 1);
  assert.equal(resourceRequests, 2);
});

test("an older refresh response cannot overwrite a newer login token", async () => {
  let resolveRefresh!: (response: Response) => void;
  const pendingRefresh = new Promise<Response>((resolve) => {
    resolveRefresh = resolve;
  });
  globalThis.fetch = async (input, init) => {
    if (String(input).endsWith("/auth/refresh")) return pendingRefresh;
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer login-token");
    return success({ ok: true });
  };

  const hydration = refreshSession();
  setAccessToken("login-token");
  resolveRefresh(success({ accessToken: "stale-refresh-token", user }));
  await hydration;
  await apiRequest("/teachers");
});

test("reference requests deduplicate identical in-flight and warm reads", async () => {
  setAccessToken("token");
  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return success({ teachers: [] });
  };
  const [first, second] = await Promise.all([
    cachedApiRequest("/teachers?isActive=true"),
    cachedApiRequest("/teachers?isActive=true"),
  ]);
  const warm = await cachedApiRequest("/teachers?isActive=true");
  assert.equal(requests, 1);
  assert.deepEqual(first, second);
  assert.deepEqual(warm, first);
});

test("reference cache invalidation forces a fresh request", async () => {
  setAccessToken("token");
  let requests = 0;
  globalThis.fetch = async () => success({ version: ++requests });
  await cachedApiRequest("/subjects?isActive=true");
  invalidateApiCache("/subjects");
  const refreshed = await cachedApiRequest<{ version: number }>(
    "/subjects?isActive=true",
  );
  assert.equal(requests, 2);
  assert.equal(refreshed.version, 2);
});
