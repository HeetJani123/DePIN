import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { readExecutionProfile } from "./execution-profile.mjs";

await import('./build-simulation.mjs');
const [command, ...args] = process.argv.slice(2);
if (!["dev", "build"].includes(command)) throw new Error("Expected dev or build.");
const managedLinux = readExecutionProfile() === "managed-linux";

if (managedLinux && command === "build") {
  const result = spawnSync("bash", [
    fileURLToPath(new URL("./build-verified.sh", import.meta.url)), ...args,
  ], { stdio: "inherit" });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

// Import in this process so the preview owner retains its PID and signals.
const cli = new URL(managedLinux
  ? "../node_modules/vite/bin/vite.js"
  : "../node_modules/vinext/dist/cli.js", import.meta.url);

// Vinext beta can finish a Windows build and then abort while libuv closes its
// file-watcher handle. Run builds in a child so that shutdown fault cannot take
// this wrapper down with it, and accept it only when Vinext reported completion
// and the required static artifacts were actually written.
if (!managedLinux && command === "build") {
  const result = spawnSync(process.execPath, [fileURLToPath(cli), command, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  if (result.error) throw result.error;

  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const staticBuildComplete =
    output.includes("Build complete") &&
    existsSync(new URL("../dist/client/index.html", import.meta.url)) &&
    existsSync(new URL("../dist/client/simulation-worker.js", import.meta.url));

  if (result.status === 0 || (process.platform === "win32" && staticBuildComplete)) {
    if (result.status !== 0) {
      console.warn("Vinext completed the static build; ignored its known Windows shutdown assertion.");
    }
    process.exit(0);
  }
  process.exit(result.status ?? 1);
}

process.argv = [process.execPath, fileURLToPath(cli), command,
  ...(!managedLinux && command === "dev" ? ["--port", "5173"] : []), ...args];
await import(cli.href);

