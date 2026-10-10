/** WorkBuddy owns the workflow unless the operator explicitly selects the optional API engine. */
export function claudeEnabled(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return env.BIZDECIDE_ENGINE === "claude" && Boolean(env.ANTHROPIC_API_KEY?.trim());
}
