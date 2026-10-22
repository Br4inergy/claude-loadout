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

/**
 * Whether a mod lives in a folder you trust (`trusted.json` → `folders`): your own mods, loaded from your own copy, skip
 * the gate in any version. Only absolute folders count, matched on whole path segments, and a path with `..` never.
 */
export function inTrustedFolder(folders: readonly unknown[], root: string | undefined): boolean {
  if (!root || !root.startsWith('/') || root.split('/').includes('..')) return false
  return folders.some(f => {
    if (typeof f !== 'string' || !f.startsWith('/') || f.split('/').includes('..')) return false
    const dir = f.replace(/\/+$/, '')
    return dir !== '' && (root === dir || root.startsWith(`${dir}/`))
  })
}

/**
 * Whether a mod is trusted by name and source (`trusted.json` → `mods`): `<name>@<marketplace>`, so a mod of the same name
 * from another marketplace is not. A `--plugin-dir` (`@inline`) or bundled (`@builtin`) plugin is never trusted this way.
 */
export function isTrustedMod(mods: readonly unknown[], id: string | undefined): boolean {
  if (!isTrustableId(id)) return false
  return mods.some(m => m === id)
}

/** An id that can be trusted: `<name>@<marketplace>`, from a real marketplace. */
export const isTrustableId = (id: string | undefined): id is string =>
  typeof id === 'string' && /^[^@\s]+@[^@\s]+$/.test(id) && !id.endsWith('@inline') && !id.endsWith('@builtin')

/** `trusted.json` with one id added or removed, every other key kept as it was. */
export function withTrust(file: Record<string, unknown>, id: string, on: boolean): Record<string, unknown> {
  const mods = (Array.isArray(file.mods) ? file.mods : []).filter((m): m is string => typeof m === 'string' && m !== id)
  return { ...file, mods: on ? [...mods, id].sort() : mods }
}
