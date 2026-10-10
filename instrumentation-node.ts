import { execFile } from "node:child_process";

/** Logs whether the Python the skill scripts need is there (Docker has it; App Hosting is unverified). */
export function checkPython() {
  const bin = process.env.PYTHON_BIN || "python3";
  execFile(bin, ["--version"], { timeout: 10_000 }, (err, stdout, stderr) => {
    if (err) console.error(`[startup] ${bin} not found: the BizDecide skill scripts can't run, so Claude briefs will fail. Set PYTHON_BIN or install python3.`);
    else console.log(`[startup] ${(stdout || stderr).trim()} (${bin})`);
  });
}
