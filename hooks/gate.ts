/**
 * The audit gate's pure helpers (no `$`): what a mod's scan says it can do, and whether its name and version are approved.
 */

/** Capability lines in the shape `claude plugin validate` prints, from a `plugin.register` scan. */
export const usesText = (uses: { events: readonly string[]; calls: readonly string[] }) =>
  `  ❯ x hooks: ${uses.events.join(', ')}\n  ❯ x calls: ${uses.calls.join(', ')}`

/** Whether a mod's name and version are approved. */
export const isApproved = (approved: Record<string, { version: string }>, name: string, version: string | undefined) =>
  approved[name]?.version === (version ?? '')

/**
 * The held versions that still wait for your audit: one leaves once you approve it, or once another version of that
 * mod is installed in its place (a version nobody runs any more needs no audit).
 */
export function stillHeld<B extends { name: string; version: string }>(
  held: readonly B[],
  approved: Record<string, { version: string }>,
  installed: readonly { name: string; version: string }[],
): B[] {
  const replaced = (b: B) => installed.some(m => m.name === b.name && m.version !== '' && m.version !== b.version)
  return held.filter(b => !isApproved(approved, b.name, b.version) && !replaced(b))
}
