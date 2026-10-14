/**
 * The audit gate's pure helpers (no `$`): what a mod's scan says it can do, and whether its name and version are approved.
 */

/** Capability lines in the shape `claude plugin validate` prints, from a `plugin.register` scan. */
export const usesText = (uses: { events: readonly string[]; calls: readonly string[] }) =>
  `  ❯ x hooks: ${uses.events.join(', ')}\n  ❯ x calls: ${uses.calls.join(', ')}`

/** Whether a mod's name and version are approved. */
export const isApproved = (approved: Record<string, { version: string }>, name: string, version: string | undefined) =>
  approved[name]?.version === (version ?? '')
