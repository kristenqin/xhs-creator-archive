import fs from "node:fs";
import path from "node:path";

const macExecutableCandidates = [
  path.join(
    process.env.HOME ?? "",
    "Library",
    "Caches",
    "ms-playwright",
    "chromium-1217",
    "chrome-mac-arm64",
    "Google Chrome for Testing.app",
    "Contents",
    "MacOS",
    "Google Chrome for Testing"
  ),
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium"
];

export function resolvePlaywrightChromiumExecutablePath(): string | undefined {
  if (process.platform !== "darwin") {
    return undefined;
  }

  return macExecutableCandidates.find((candidate) => fs.existsSync(candidate));
}
