/** Runs once when the server starts. Logs whether the Python the skill scripts need is there (Docker has it; App Hosting is unverified). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { execFile } = await import("node:child_process");
  const bin = process.env.PYTHON_BIN || "python3";
  execFile(bin, ["--version"], { timeout: 10_000 }, (err, stdout, stderr) => {
    if (err) console.error(`[startup] ${bin} not found: the BizDecide skill scripts can't run, so Claude briefs will fail. Set PYTHON_BIN or install python3.`);
    else console.log(`[startup] ${(stdout || stderr).trim()} (${bin})`);
  });
}
