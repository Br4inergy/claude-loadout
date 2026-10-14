/**
 * The other mods' bands, one by one. The band is one chain: each mod's hook draws its own row and, if it calls `next`,
 * nests what the mods beneath drew. `next.trace` says what each link returned; a link's own row is its tree with the
 * tree of the link beneath it taken out, so each mod's band can show or hide on its own.
 */

/** What Loadout reads from one `next.trace` entry. */
export type Link = { index: number; plugin: string; returned: unknown }

/** One mod's own band. */
export type Band = { plugin: string; tree: unknown }

/** Claude Code's own placeholder ({ type: 'engine' }) is never nested: the desktop would drop the whole band. */
const isTree = (x: unknown): boolean =>
  typeof x === 'string' ? x !== '' : !!x && typeof x === 'object' && (x as { type?: unknown }).type !== 'engine'

/** `tree` with every subtree equal to `gone` (and every engine placeholder) taken out. */
function strip(tree: unknown, gone: string | null): unknown {
  if (!tree || typeof tree !== 'object') return tree
  if (Array.isArray(tree)) return tree.map(t => strip(t, gone)).filter(t => t !== null)
  if ((tree as { type?: unknown }).type === 'engine') return null
  if (gone !== null && JSON.stringify(tree) === gone) return null
  const el = tree as { children?: unknown }
  if (!Array.isArray(el.children)) return tree
  return { ...el, children: el.children.map(c => strip(c, gone)).filter(c => c !== null) }
}

/** Whether a tree still draws something once stripped (an empty Box draws nothing). */
function draws(tree: unknown): boolean {
  if (typeof tree === 'string') return tree.trim() !== ''
  if (!isTree(tree)) return false
  const el = tree as { type?: string; children?: unknown }
  if (el.type !== 'Box') return true
  return Array.isArray(el.children) && el.children.some(draws)
}

/**
 * Each mod's own band, outermost first, from the links beneath Loadout. A link that only passed what was beneath it
 * draws nothing of its own. `rest` is what the engine itself drew (no mod's), shown as it is.
 */
export function splitBands(trace: readonly Link[], self = 'loadout'): { bands: Band[]; rest: unknown } {
  const links = [...trace].filter(l => l.plugin !== self).sort((a, b) => a.index - b.index)
  const bands: Band[] = []
  let rest: unknown = null
  for (const [i, link] of links.entries()) {
    if (!isTree(link.returned)) continue
    const below = links.slice(i + 1).find(l => l.returned !== undefined)?.returned
    const belowText = isTree(below) ? JSON.stringify(below) : null
    if (belowText !== null && JSON.stringify(link.returned) === belowText) continue
    const own = strip(link.returned, belowText)
    if (!draws(own)) continue
    if (link.plugin === 'engine') rest = own
    else {
      const same = bands.find(b => b.plugin === link.plugin)
      // A mod with two hooks on the band: both rows are its own.
      if (same) same.tree = { type: 'Box', props: { flexDirection: 'column' }, children: [same.tree, own] }
      else bands.push({ plugin: link.plugin, tree: own })
    }
  }
  return { bands, rest }
}

/** The names seen so far plus the new ones, in the order first seen. */
export function mergeSeen(seen: readonly string[], now: readonly string[]): string[] {
  const out = [...seen]
  for (const n of now) if (!out.includes(n)) out.push(n)
  return out
}
