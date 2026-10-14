/**
 * Safe updates and the patch keeper (pure, no `$`): where each mod comes from, whether its author published something
 * newer, and whether you changed it yourself. register.tsx runs the git and claude commands; this reads their output.
 */
import type { UpdateInfo } from '../types'

/** Where a plugin's code comes from, read from ~/.claude/plugins/known_marketplaces.json. */
export type Source =
  | { kind: 'folder'; marketplace: string; dir: string }
  | { kind: 'github'; marketplace: string; dir: string; repo: string }
  | { kind: 'other'; marketplace: string }

export const marketplaceOf = (id: string) => id.split('@')[1] ?? ''

export function sourceOf(id: string, knownJson: string): Source {
  const marketplace = marketplaceOf(id)
  try {
    const known = JSON.parse(knownJson) as Record<string, { source?: { source?: string; repo?: string; path?: string }; installLocation?: string }>
    const m = known[marketplace]
    const dir = m?.installLocation ?? m?.source?.path ?? ''
    if (m?.source?.source === 'directory' && dir) return { kind: 'folder', marketplace, dir }
    if (m?.source?.source === 'github' && dir) return { kind: 'github', marketplace, dir, repo: m.source.repo ?? '' }
  } catch {
    // unreadable registry: nothing known
  }
  return { kind: 'other', marketplace }
}

/** The version a marketplace lists for a plugin, from its marketplace.json. */
export function listedVersion(marketplaceJson: string, name: string): string | null {
  try {
    const data = JSON.parse(marketplaceJson) as { plugins?: { name?: string; version?: string }[] }
    return data.plugins?.find(p => p.name === name)?.version ?? null
  } catch {
    return null
  }
}

/** -1, 0 or 1, comparing dotted versions numerically (1.10.0 > 1.9.2); a missing part counts as 0. */
export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split(/[.+-]/).map(n => Number.parseInt(n, 10) || 0)
  const pb = b.replace(/^v/, '').split(/[.+-]/).map(n => Number.parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d > 0 ? 1 : -1
  }
  return 0
}

/** The files `git status --porcelain` lists: a status code and a path (the new one for a rename). */
export function changedList(porcelain: string): { status: string; path: string }[] {
  return porcelain
    .split('\n')
    .filter(l => l.trim() !== '')
    .map(l => {
      const rest = l.slice(3)
      const arrow = rest.lastIndexOf(' -> ')
      return { status: l.slice(0, 2).trim(), path: arrow >= 0 ? rest.slice(arrow + 4) : rest }
    })
}

/** Files `git status --porcelain` lists as changed. */
export const changedFiles = (porcelain: string) => porcelain.split('\n').filter(l => l.trim() !== '').length

/** Whether there is anything to tell: an update, or your own changes. */
export const isNews = (u: UpdateInfo | undefined) => !!u && (u.behind > 0 || u.latest !== null || u.changed > 0)

/** Whether an update is waiting. */
export const hasUpdate = (u: UpdateInfo | undefined) => !!u && (u.behind > 0 || u.latest !== null)
