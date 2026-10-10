/** Runs once when the server starts. Node-only code lives in instrumentation-node.ts so the edge build never sees it. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { checkPython } = await import("./instrumentation-node");
    checkPython();
  }
}
