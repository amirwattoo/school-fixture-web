import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const source = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Proxy Management branding is present in metadata, login, and authenticated navigation", async () => {
  const contents = await Promise.all([source("app/layout.tsx"), source("app/login/page.tsx"), source("components/dashboard-shell.tsx"), source("app/manifest.ts")]);
  contents.forEach((content) => assert.match(content, /Proxy Management/));
});

test("mobile account experience exposes authenticated name, role, email, school, and logout", async () => {
  const content = await source("components/dashboard-shell.tsx");
  for (const expression of [/user\.name/, /user\.email/, /user\.role/, /user\.school\.name/, /Logout/]) assert.match(content, expression);
  assert.match(content, /md:hidden/);
});

test("forgot and reset password screens call the public recovery endpoints", async () => {
  assert.match(await source("app/forgot-password/page.tsx"), /\/auth\/forgot-password/);
  const reset = await source("app/reset-password/page.tsx");
  assert.match(reset, /\/auth\/reset-password/); assert.match(reset, /newPassword/);
});

test("timetable import UI includes upload, preview, mapping, confirmation, retry, and history states", async () => {
  const content = await source("app/timetable/import/page.tsx");
  for (const expression of [/uploadApiRequest/, /teacherMappings/, /confirmReplace/, /Retry preview/, /Recent import history/, /Processing and validating/]) assert.match(content, expression);
});
