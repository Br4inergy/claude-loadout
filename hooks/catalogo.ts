/**
 * The catalog (pure, no `$`): turns `claude plugin list --json` into panel rows, with its name,
 * what it does (its own plugin.json description) and its glyph; reads capabilities from `claude plugin validate`.
 */
import type { Cap, ModRow } from '../types'
import type { Lang } from './i18n'

type Listed = { id: string; version?: string; enabled?: boolean; installPath?: string; description?: string }

/** The plugin.json description without the mod's name in front ("Name: …", "Name — …"): the card shows it already. */
export function ownWords(description: string | undefined, label: string): string {
  const d = (description ?? '').trim()
  const lead = new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[:—–-]\\s*`, 'i')
  const rest = d.replace(lead, '').trim()
  return rest.charAt(0).toUpperCase() + rest.slice(1)
}

/** Item rarity, Blizzard-RPG style: what a card's colour says about the mod at a glance. */
export type Rarity = 'poor' | 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

/** Theme colours (readable in light and dark): grey, white, green, blue, purple, orange. */
export const RARITY_COLOR: Record<Rarity, string> = {
  poor: 'inactive',
  common: 'text',
  uncommon: 'success',
  rare: 'suggestion',
  epic: 'merged',
  legendary: 'claude',
}

/**
 * Off → poor. Loadout → legendary. Runs commands → epic. Draws its own panel → rare.
 * A mod (it passed the audit gate to load) → uncommon. A plain plugin, which the gate does not audit → common.
 * Read from what any mod's code does (`claude plugin validate`), never from a list of mods we know.
 */
export function rarityOf(m: Pick<ModRow, 'id' | 'enabled' | 'isMod'>, caps: readonly Cap[]): Rarity {
  if (!m.enabled) return 'poor'
  if (shortName(m.id) === 'loadout') return 'legendary'
  if (caps.includes('cmd')) return 'epic'
  if (caps.includes('pane')) return 'rare'
  return m.isMod ? 'uncommon' : 'common'
}

export const shortName = (id: string) => id.split('@')[0] ?? id

export function toRow(p: Listed, isMod: boolean, lang: Lang, pin: string | null = null): ModRow {
  const name = shortName(p.id)
  void lang
  return {
    id: p.id,
    label: name,
    enabled: p.enabled !== false,
    isMod,
    builtin: p.id.endsWith('@builtin'),
    version: p.version ?? '',
    // What the mod says it does, in its own plugin.json: the same text everyone who installs it sees.
    about: ownWords(p.description, name),
    icon: name === 'loadout' ? '⚙' : isMod ? '◇' : '▪',
    path: p.installPath ?? null,
    pin,
  }
}

/** The command that opens a plugin's panel: the one named like the plugin, else its only command, else none. */
export function openCommandFor(plugin: string, commands: readonly { name: string; plugin?: string }[]): string | null {
  const own = commands.filter(c => c.plugin === plugin)
  if (own.some(c => c.name === plugin)) return plugin
  return own.length === 1 ? (own[0]?.name ?? null) : null
}

/** Ids of the plugins Claude Code ships built in (they do not show in `plugin list`), from `enabledPlugins`. */
export function builtinIds(enabledPlugins: Record<string, unknown> | undefined): string[] {
  return Object.keys(enabledPlugins ?? {})
    .filter(id => id.endsWith('@builtin'))
    .sort()
}

/** Active first, then off; Loadout itself last among the mods. */
export function sortRows(rows: ModRow[]): ModRow[] {
  const rank = (r: ModRow) => (shortName(r.id) === 'loadout' ? 9 : r.isMod ? (r.enabled ? 0 : 1) : r.enabled ? 2 : 3)
  return [...rows].sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label))
}

/** Only safe ids reach `claude plugin …` (no spaces or metacharacters). */
export const isSafeId = (id: string) => /^[\w.-]+@[\w.-]+$/.test(id)

/** Pinned commit per plugin id, from `~/.claude/plugins/installed_plugins.json`. */
export function pinsOf(installedJson: string): Record<string, string> {
  try {
    const data = JSON.parse(installedJson) as { plugins?: Record<string, { gitCommitSha?: string }[]> }
    const out: Record<string, string> = {}
    for (const [id, entries] of Object.entries(data.plugins ?? {})) {
      const sha = entries?.[0]?.gitCommitSha
      if (sha) out[id] = sha.slice(0, 7)
    }
    return out
  } catch {
    return {}
  }
}

/** What a mod's code can do, read from the `hooks:` and `calls:` lines `claude plugin validate` prints. */
export function capsOf(validateOutput: string): Cap[] {
  const line = (label: string) =>
    validateOutput
      .split('\n')
      .filter(l => l.includes(` ${label}: `))
      .join(' ')
  const calls = line('calls')
  const hooks = line('hooks')
  const caps: Cap[] = []
  if (/\$\.process\./.test(calls)) caps.push('cmd')
  if (/\$\.fs\.write|\$\.fs\.remove|\$\.fs\.mkdir/.test(calls)) caps.push('write')
  if (/\$\.http\./.test(calls)) caps.push('net')
  if (/\$\.prompt\.submit/.test(calls)) caps.push('prompt')
  if (/\$\.model\./.test(calls)) caps.push('model')
  if (/\$\.tool\.register/.test(calls)) caps.push('tools')
  if (/(^|[\s,])tool\.call/.test(hooks)) caps.push('gate')
  if (/prompt\.compose/.test(hooks)) caps.push('system')
  if (/ui\.render\{component=Pane/.test(hooks)) caps.push('pane')
  return caps
}
