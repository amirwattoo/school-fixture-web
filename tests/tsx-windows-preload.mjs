if (process.platform === "win32" && !process.geteuid) {
  Object.defineProperty(process, "geteuid", {
    configurable: true,
    value: () => process.env.USERNAME ?? "windows-user",
  });
}
