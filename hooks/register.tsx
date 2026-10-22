/**
 * Loadout: a safe manager for your Claude Code mods.
 *
 *  Panel (the ⚙ Loadout button above the prompt, or /loadout): an RPG-style inventory, every mod and plugin as an item card
 *  with an Equip switch, a rarity colour (catalogo.ts, rarityOf), its version, its own description, what its code can do
 *  (commands, files, network, model...), the commit it is pinned to and what it spends on the model;
 *  audited updates, uninstall (two clicks) and "Pin" to keep your own changes.
 *  Band (above the prompt): one row with the ⚙ Loadout button, a ⚠ button when the gate holds a mod back and a ↑ button
 *  when updates wait; the bands of the other mods show under it, each one shown or hidden on its own from the panel.
 *  Audit gate: a mod whose name and version you have not approved never loads; Loadout tells you and offers to have
 *  Claude audit it. Every block is written to ~/.claude/loadout/blocked.log.
 *  Safe updates: a new version never runs until you approve it; your own changes to a pinned clone are backed up and kept.
 *
 * Tokens: none of its own. It reads the plugin list and what each mod spends on the model, and runs `claude plugin ...`
 * and git when you open the panel or press a button. Audits and updates are Claude turns you start.
 */
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Approval, Blocked, Cap, ModRow, UpdateInfo } from '../types'
import { aboutFolds } from './about'
import { mergeSeen, splitBands } from './bandas'
import type { Link } from './bandas'
import { RARITY_COLOR, builtinIds, capsOf, isSafeId, openCommandFor, pinsOf, rarityOf, shortName, sortRows, toRow } from './catalogo'
import { inTrustedFolder, isApproved, stillHeld, usesText } from './gate'
import { pickLang, words } from './i18n'
import type { Lang } from './i18n'
import { costOf } from './pricing'
import type { Usage } from './pricing'
import { changedFiles, changedList, compareVersions, hasUpdate, listedVersion, sourceOf } from './updates'

const mods = atom({ plugin: 'loadout', key: 'mods' } as const, [])
const commands = atom({ plugin: 'loadout', key: 'commands' } as const, [])
const confirm = atom({ plugin: 'loadout', key: 'confirm' } as const, null)
const expanded = atom({ plugin: 'loadout', key: 'expanded' } as const, null)
const aboutOpen = atom({ plugin: 'loadout', key: 'aboutOpen' } as const, null)
const changesOpen = atom({ plugin: 'loadout', key: 'changesOpen' } as const, null)
const busy = atom({ plugin: 'loadout', key: 'busy' } as const, null)
const tab = atom({ plugin: 'loadout', key: 'tab' } as const, 'mods')
const caps = atom({ plugin: 'loadout', key: 'caps' } as const, {})
const paneUp = atom({ plugin: 'loadout', key: 'paneUp' } as const, false)
const blocked = atom({ plugin: 'loadout', key: 'blocked' } as const, [])
const bands = atom({ plugin: 'loadout', key: 'bands' } as const, [])
const hiddenBands = atom({ plugin: 'loadout', key: 'hiddenBands' } as const, [])
const spend = atom({ plugin: 'loadout', key: 'spend' } as const, {})
const updates = atom({ plugin: 'loadout', key: 'updates' } as const, {})
const checking = atom({ plugin: 'loadout', key: 'checking' } as const, false)

const PANE = 'loadout'
/** Capabilities that touch the machine or the model get the warning tint. */
const LOUD: readonly Cap[] = ['cmd', 'write', 'net', 'system', 'gate']

let lang: Lang = 'en'
/** The mods drawing a band right now (the band's last draw); the panel says which are quiet. */
let drawing: string[] = []

const asNames = (x: unknown): string[] => (Array.isArray(x) ? x.filter((n): n is string => typeof n === 'string') : [])

/** Shows or hides one mod's band, and remembers it across sessions. */
async function toggleBand($: EngineInterface, plugin: string) {
  const next = await update($, hiddenBands, list => (list.includes(plugin) ? list.filter(n => n !== plugin) : [...list, plugin]))
  await $.store.set('hiddenBands', next).catch(() => undefined)
}

/** Writes down the mods seen drawing a band; from a timer, since a drawing cannot write state. */
function noteBands($: EngineInterface, now: string[]) {
  drawing = now
  void $.clock.after(0, () => {
    void (async () => {
      const seen = await read($, bands)
      const merged = mergeSeen(seen, now)
      if (merged.length === seen.length) return
      await update($, bands, () => merged)
      await $.store.set('bandsSeen', merged).catch(() => undefined)
    })().catch(() => undefined)
  })
}

async function refreshCommands($: EngineInterface) {
  const next = (await $.command.list()).map(c => ({ name: c.name, plugin: c.plugin }))
  const prev = await read($, commands)
  if (JSON.stringify(prev) !== JSON.stringify(next)) await update($, commands, () => next)
}

function toast($: EngineInterface, text: string) {
  try {
    void $.ui.toast(text)
  } catch {
    // a surface without toasts
  }
}

async function home($: EngineInterface) {
  return (await $.env.get('HOME').catch(() => null)) || (await $.env.get('USERPROFILE').catch(() => null)) || ''
}

async function claudeBin($: EngineInterface) {
  const h = await home($)
  return (await $.fs.exists(`${h}/.local/bin/claude`).catch(() => false)) ? `${h}/.local/bin/claude` : 'claude'
}

// ── audit gate ──────────────────────────────────────────────────────────────

const approvedPath = async ($: EngineInterface) => `${await home($)}/.claude/loadout/approved.json`

async function readApproved($: EngineInterface): Promise<Record<string, Approval>> {
  try {
    const data = JSON.parse(await $.fs.read(await approvedPath($))) as { mods?: Record<string, Approval> }
    return data.mods ?? {}
  } catch {
    return {}
  }
}

// Folders whose mods you trust without an audit (your own): `{ "folders": ["/abs/path"] }`. Written by you, never by Loadout.
const trustedPath = async ($: EngineInterface) => `${await home($)}/.claude/loadout/trusted.json`

async function readTrustedFolders($: EngineInterface): Promise<unknown[]> {
  try {
    const data = JSON.parse(await $.fs.read(await trustedPath($))) as { folders?: unknown }
    return Array.isArray(data.folders) ? data.folders : []
  } catch {
    return []
  }
}

async function approve($: EngineInterface, b: Blocked, by: Approval['by']) {
  const current = await readApproved($)
  current[b.name] = { version: b.version, by, approvedAt: new Date().toISOString() }
  await $.fs.write(await approvedPath($), `${JSON.stringify({ mods: current }, null, 2)}\n`)
}

/** Every block is written down in ~/.claude/loadout/blocked.log, one JSON line each: your audit trail. */
async function logBlock($: EngineInterface, b: Blocked) {
  try {
    const path = `${await home($)}/.claude/loadout/blocked.log`
    const prev = await $.fs.read(path).catch(() => '')
    // One line per mod and version: every Claude Code process judges it again.
    if (prev.includes(`"name":${JSON.stringify(b.name)},"version":${JSON.stringify(b.version)}`)) return
    const line = JSON.stringify({ at: new Date().toISOString(), name: b.name, version: b.version, root: b.root, caps: b.caps })
    await $.fs.write(path, `${prev}${line}\n`)
  } catch {
    // the log is best-effort
  }
}

/** After an approval: forget what is approved now and load it. */
async function recheck($: EngineInterface) {
  const approved = await readApproved($)
  const before = await read($, blocked)
  const installed = (await read($, mods)).map(m => ({ name: shortName(m.id), version: m.version }))
  const nowApproved = before.filter(b => isApproved(approved, b.name, b.version))
  const still = stillHeld(before, approved, installed)
  if (still.length < before.length) await update($, blocked, () => still)
  // Only an approval needs the mod loaded now; a replaced version is just forgotten.
  if (nowApproved.length > 0) {
    toast($, words(lang).approvedReload)
    await $.command.run({ command: 'reload-plugins' }).catch(() => undefined)
  }
}

// ── catalog ─────────────────────────────────────────────────────────────────

/** Re-reads the installed plugins, marks which are mods (ship function hooks) and scans what each mod can do. */
async function loadMods($: EngineInterface) {
  try {
    const bin = await claudeBin($)
    const run = await $.process.run([bin, 'plugin', 'list', '--json'], { timeoutMs: 30_000 })
    const listed = JSON.parse(run.stdout) as { id: string; version?: string; enabled?: boolean; installPath?: string }[]
    const known = await $.fs.read(`${await home($)}/.claude/plugins/known_marketplaces.json`).catch(() => '')
    const pins = pinsOf(await $.fs.read(`${await home($)}/.claude/plugins/installed_plugins.json`).catch(() => ''))
    const rows: ModRow[] = []
    for (const p of listed) {
      if (!isSafeId(p.id)) continue
      const hooks = p.installPath ? await $.fs.read(`${p.installPath}/hooks/hooks.json`).catch(() => '') : ''
      // The version its code says (a pinned clone moves ahead of the install record when it updates).
      const manifest = p.installPath ? await $.fs.read(`${p.installPath}/.claude-plugin/plugin.json`).catch(() => '') : ''
      const own = (() => {
        try {
          return JSON.parse(manifest) as { version?: unknown; description?: unknown }
        } catch {
          return {}
        }
      })()
      const version = typeof own.version === 'string' && own.version ? own.version : p.version
      const description = typeof own.description === 'string' ? own.description : undefined
      const src = sourceOf(p.id, known)
      rows.push({
        ...toRow({ ...p, version, description }, typeof hooks === 'string' && hooks.includes('"modules"'), lang, pins[p.id] ?? null),
        origin: { kind: src.kind, repo: src.kind === 'github' ? src.repo || null : null },
      })
    }
    // Built-ins ship inside Claude Code and cannot be uninstalled: list only the ones turned on, read from the file on
    // disk (the session's own copy of the settings is the one it started with).
    const onDisk = await $.fs.read(`${await home($)}/.claude/settings.json`).catch(() => '')
    const settings = (() => {
      try {
        return JSON.parse(onDisk) as { enabledPlugins?: Record<string, boolean> }
      } catch {
        return {}
      }
    })()
    for (const id of builtinIds(settings.enabledPlugins)) {
      if (settings.enabledPlugins?.[id] === true && !rows.some(r => r.id === id)) rows.push(toRow({ id, enabled: true }, true, lang))
    }
    await update($, mods, () => sortRows(rows))
    // What each mod's code can do, read the way the engine reads it.
    const found: Record<string, Cap[]> = {}
    await Promise.all(
      rows
        .filter(r => r.isMod && r.path)
        .map(async r => {
          const v = await $.process.run([bin, 'plugin', 'validate', r.path ?? ''], { timeoutMs: 30_000 }).catch(() => null)
          if (v) found[r.id] = capsOf(`${v.stdout}\n${v.stderr}`)
        }),
    )
    await update($, caps, () => found)
  } catch {
    toast($, words(lang).failed('claude plugin list'))
  }
}

/** Turns a plugin on or off, or uninstalls it, with the official CLI, in the user's own settings. */
async function act($: EngineInterface, verb: 'enable' | 'disable' | 'uninstall', row: ModRow) {
  if (!isSafeId(row.id)) return
  const w = words(lang)
  await update($, busy, () => row.id)
  toast($, verb === 'uninstall' ? w.removing(row.label) : w.turning(verb === 'enable', row.label))
  const argv = [await claudeBin($), 'plugin', verb, row.id, ...(row.builtin ? [] : ['--scope', 'user'])]
  const run = await $.process.run(argv, { timeoutMs: 60_000 }).catch((err: unknown) => ({
    exitCode: -1,
    stdout: '',
    stderr: err instanceof Error ? err.message : String(err),
  }))
  const ok = run.exitCode === 0
  await update($, confirm, () => null)
  await update($, expanded, () => null)
  await loadMods($)
  let applied = false
  if (ok) applied = await $.command.run({ command: 'reload-plugins' }).then(() => true).catch(() => false)
  await update($, busy, () => null)
  toast($, ok ? w.done(verb, row.label, applied) : w.failed((run.stderr || run.stdout || `exit ${run.exitCode}`).trim().slice(0, 160)))
}

// ── safe updates and the patch keeper ───────────────────────────────────────

const CHECK_EVERY_MS = 6 * 60 * 60 * 1000

/**
 * Looks for updates and for your own changes. A pinned clone (a folder marketplace that is a git repo) is fetched and
 * compared with its upstream, and your changes in it are backed up as a patch; a GitHub marketplace is refreshed and
 * its listed version compared with the installed one. Nothing is installed here: updating is an audited step.
 */
async function checkUpdates($: EngineInterface, quiet: boolean) {
  const w = words(lang)
  if (await read($, checking)) return
  await update($, checking, () => true)
  if (!quiet) toast($, w.checking)
  try {
    const h = await home($)
    const known = await $.fs.read(`${h}/.claude/plugins/known_marketplaces.json`).catch(() => '')
    const bin = await claudeBin($)
    const done = new Set<string>()
    const found: Record<string, UpdateInfo> = {}
    for (const m of await read($, mods)) {
      if (m.builtin || !isSafeId(m.id)) continue
      const src = sourceOf(m.id, known)
      const name = shortName(m.id)
      if (src.kind === 'folder') {
        // A branch that tracks one is compared with its upstream; a pin on a commit (detached HEAD) with origin's default.
        const tracked = await $.process.run(['git', '-C', src.dir, 'rev-parse', '--abbrev-ref', '@{u}'], { timeoutMs: 10_000 }).catch(() => null)
        const origin = tracked?.exitCode === 0 ? null : await $.process.run(['git', '-C', src.dir, 'rev-parse', '--verify', '--quiet', 'origin/HEAD'], { timeoutMs: 10_000 }).catch(() => null)
        const ref = tracked?.exitCode === 0 ? '@{u}' : origin?.exitCode === 0 ? 'origin/HEAD' : null
        let behind = 0
        if (ref) {
          if (!done.has(src.dir)) {
            await $.process.run(['git', '-C', src.dir, 'fetch', '--quiet', 'origin'], { timeoutMs: 30_000 }).catch(() => null)
            done.add(src.dir)
          }
          const count = await $.process.run(['git', '-C', src.dir, 'rev-list', '--count', `HEAD..${ref}`], { timeoutMs: 10_000 }).catch(() => null)
          behind = count?.exitCode === 0 ? Number.parseInt(count.stdout.trim(), 10) || 0 : 0
        }
        const status = await $.process.run(['git', '-C', src.dir, 'status', '--porcelain'], { timeoutMs: 10_000 }).catch(() => null)
        const changed = status?.exitCode === 0 ? changedFiles(status.stdout) : 0
        let patch: string | null = null
        if (changed > 0) {
          const diff = await $.process.run(['git', '-C', src.dir, 'diff', 'HEAD'], { timeoutMs: 10_000 }).catch(() => null)
          if (diff?.exitCode === 0 && diff.stdout) {
            await $.process.run(['mkdir', '-p', `${h}/.claude/loadout/patches`], { timeoutMs: 5_000 }).catch(() => null)
            patch = `${h}/.claude/loadout/patches/${name}.patch`
            await $.fs.write(patch, diff.stdout).catch(() => {
              patch = null
            })
          }
        }
        found[m.id] = { source: 'folder', behind, latest: null, changed, files: status?.exitCode === 0 ? changedList(status.stdout) : [], patch, dir: src.dir, repo: null, ref }
      } else if (src.kind === 'github') {
        if (!done.has(src.marketplace)) {
          await $.process.run([bin, 'plugin', 'marketplace', 'update', src.marketplace], { timeoutMs: 60_000 }).catch(() => null)
          done.add(src.marketplace)
        }
        const listed = listedVersion(await $.fs.read(`${src.dir}/.claude-plugin/marketplace.json`).catch(() => ''), name)
        const latest = listed && m.version && compareVersions(listed, m.version) > 0 ? listed : null
        found[m.id] = { source: 'github', behind: 0, latest, changed: 0, files: [], patch: null, dir: src.dir, repo: src.repo || null, ref: null }
      }
    }
    await update($, updates, () => found)
    await $.store.set('lastCheck', Date.now()).catch(() => undefined)
    const n = Object.values(found).filter(hasUpdate).length
    if (!quiet) toast($, n ? w.updatesFound(n) : w.upToDate)
  } finally {
    await update($, checking, () => false)
  }
}

/** The audited update: Claude gets the exact steps for where this mod comes from. */
async function askSafeUpdate($: EngineInterface, row: ModRow, info: UpdateInfo | undefined) {
  const w = words(lang)
  // Asked once: the card says Claude is on it until the next check, so it cannot be asked twice.
  if (info) await update($, updates, all => ({ ...all, [row.id]: { ...info, requested: true } }))
  if (info?.source === 'folder' && info.dir) {
    await $.prompt.submit({ text: w.askSafeUpdate(row.label, row.id, w.stepsFolder(info.dir, info.behind, info.changed, info.patch, info.ref ?? 'origin/HEAD')) })
  } else if (info?.source === 'github' && info.latest && info.dir) {
    await $.prompt.submit({ text: w.askSafeUpdate(row.label, row.id, w.stepsGithub(row.id, info.dir, row.version, info.latest, row.path ?? '')) })
  } else {
    await $.prompt.submit({ text: w.askUpdate(row.label, row.id) })
  }
}

// ── the panel ───────────────────────────────────────────────────────────────

/** Re-reads the mods and, at most every 6 hours, looks for updates; then opens the panel (or brings it forward). */
async function openPane($: EngineInterface) {
  void loadMods($).then(async () => {
    await recheck($)
    const last = await $.store.get('lastCheck').catch(() => undefined)
    if (typeof last !== 'number' || Date.now() - last > CHECK_EVERY_MS) await checkUpdates($, true)
  })
  // Every card opens folded: one line of description, your changes closed.
  await update($, aboutOpen, () => null)
  await update($, changesOpen, () => null)
  await $.ui.open({ id: PANE, title: 'Loadout', closeOnEscape: true })
  await update($, paneUp, () => true)
}

/** Claude Code's own record says whether the panel is up and in view, not ours: a close we did not see must not stick. */
async function paneState($: EngineInterface) {
  return (await $.ui.panes().catch(() => [])).find(p => p.id === PANE)
}

/** The ⚙ Loadout button: opens the panel, brings a hidden one forward, or closes the one in view. */
async function togglePane($: EngineInterface) {
  const pane = await paneState($)
  if (pane?.isShown) {
    await $.ui.close({ id: PANE }).catch(() => undefined)
    await update($, paneUp, () => false)
  } else await openPane($)
}

/** The ⚠ and ↑ buttons: show the panel, never close it. */
async function showPane($: EngineInterface) {
  const pane = await paneState($)
  if (pane?.isShown) await update($, paneUp, () => true)
  else await openPane($)
}

/** Adds one model call to its plugin's spend. Only other plugins' calls count: the main conversation belongs to no mod. */
async function meter($: EngineInterface, plugin: string, model: string, result: unknown) {
  if (!plugin || plugin === 'engine' || plugin === 'client' || plugin === 'loadout') return
  // An op's answer comes as `{ value }`; the call's result (ModelCompleteResult) is inside.
  const answer = ((result as { value?: unknown } | null)?.value ?? result) as { usage?: Usage } | null
  const usage = answer?.usage
  if (!usage) return
  const tokens = (usage.input_tokens || 0) + (usage.output_tokens || 0) + (usage.cache_read_input_tokens || 0) + (usage.cache_creation_input_tokens || 0)
  const usd = costOf(model, usage)
  await update($, spend, all => {
    const prev = all[plugin] ?? { calls: 0, tokens: 0, usd: 0 }
    return { ...all, [plugin]: { calls: prev.calls + 1, tokens: prev.tokens + tokens, usd: prev.usd + usd } }
  })
}

// ── hooks ───────────────────────────────────────────────────────────────────

export const register: Register = on => {
  // The audit gate: a mod you have not approved, in this exact version, never joins the session.
  on('plugin.register', { tier: 'user' }, async ($, e, next) => {
    if (e.name === 'loadout') return next(e)
    const approved = await readApproved($)
    if (isApproved(approved, e.name, e.version)) return next(e)
    if (inTrustedFolder(await readTrustedFolders($), e.root)) return next(e)
    const b: Blocked = { name: e.name, version: e.version ?? '', root: e.root, caps: capsOf(usesText(e.uses)) }
    await update($, blocked, list => [...list.filter(x => x.name !== b.name), b])
    toast($, words(lang).blockedToast(e.name))
    await logBlock($, b)
    return { refuse: `Loadout: «${e.name}» v${b.version} is not audited. Approve it in Loadout.` }
  }).catch(($, e, next) => next(e))

  on('session.start', async ($, e, next) => {
    try {
      const settings = (await $.settings.read().catch(() => ({}))) as { language?: unknown; enabledPlugins?: Record<string, boolean> }
      // A block is forgotten once its mod is no longer installed and on.
      const installed = Object.entries(settings.enabledPlugins ?? {}).filter(([, v]) => v).map(([id]) => id.split('@')[0])
      const held = await read($, blocked)
      if (held.some(b => !installed.includes(b.name))) await update($, blocked, list => list.filter(b => installed.includes(b.name)))
      const locale = (await $.env.get('LC_ALL').catch(() => null)) || (await $.env.get('LANG').catch(() => null)) || null
      lang = pickLang(undefined, settings.language, locale)
      const seen = asNames(await $.store.get('bandsSeen').catch(() => undefined))
      const hidden = asNames(await $.store.get('hiddenBands').catch(() => undefined))
      await update($, bands, () => seen)
      await update($, hiddenBands, () => hidden)
      // The old all-or-nothing switch is gone: each band now has its own.
      await $.store.delete('hideOthers').catch(() => undefined)
      await $.command.register({
        name: 'loadout',
        description: lang === 'es' ? 'Abre tu Loadout: administra tus mods y auditorías' : 'Open your Loadout: manage your mods and audits',
      })
      await refreshCommands($)
    } catch {
      // Nothing yet: the next measure looks again.
    }
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    try {
      // Other mods register their commands after Loadout starts: look again.
      await refreshCommands($)
    } catch {
      // fail-open
    }
    return next(e)
  })

  // After a turn that worked on an audited update, look again so the card shows the result.
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    try {
      if (Object.values(await read($, updates)).some(u => u.requested)) await checkUpdates($, true)
    } catch {
      // the check is best-effort
    }
    return result
  })

  // What each mod spends on the model: watched, never changed.
  on('model.complete', async ($, e, next) => {
    const result = await next(e)
    await meter($, next.origin.plugin, e.model, result).catch(() => undefined)
    return result
  }).catch(($, e, next) => next(e))

  on('model.fork', async ($, e, next) => {
    const result = await next(e)
    await meter($, next.origin.plugin, '', result).catch(() => undefined)
    return result
  }).catch(($, e, next) => next(e))

  // However the panel closes (a button, its mark, Esc), its button stops glowing.
  on('ui.close', async ($, e, next) => {
    const result = await next(e)
    if (e.id === PANE) await update($, paneUp, () => false)
    return result
  })

  on('command.run', { command: 'loadout' }, async $ => {
    await openPane($)
    return {}
  })

  // The band: on top, its own row; under it, each other mod's band, unless you hid that one.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // Only a survey takes the band.
    if (e.props.hasSurvey) return next(e)
    const { Box, Button } = $.ui.resolve(e)
    await Promise.resolve(next(e)).catch(() => null)
    // What each mod beneath returned, its own row taken apart from the rows it nests.
    const { bands: drawnBands, rest } = splitBands(next.trace as readonly Link[])
    noteBands($, drawnBands.map(b => b.plugin))
    const hidden = await read($, hiddenBands)
    const shown = drawnBands.filter(b => !hidden.includes(b.plugin))
    const w = words(lang)
    const up = await read($, paneUp)
    const held = await read($, blocked)
    const news = Object.values(await read($, updates)).filter(u => hasUpdate(u) && !u.requested).length
    return (
      <Box flexDirection="column">
        <Box key="lo-row" gap={1} justifyContent="flex-end" alignItems="center" marginBottom={1}>
          {held.length > 0 && <Button key="lo-blocked" variant="primary" label={`⚠ ${w.blocked(held.length)}`} onPress={() => void showPane($)} />}
          {news > 0 && <Button key="lo-updates" label={`↑ ${w.updatesFound(news)}`} onPress={() => void showPane($)} />}
          <Button key="lo-open" hotkey="l" variant={up ? 'primary' : undefined} label={`⚙ ${w.loadout}`} onPress={() => void togglePane($)} />
        </Box>
        {shown.map(b => (
          <Box key={`lo-band-${b.plugin}`} flexDirection="column">
            {b.tree as never}
          </Box>
        ))}
        {rest as never}
      </Box>
    )
  })

  // The panel.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const w = words(lang)
    const list = await read($, mods)
    const cmds = await read($, commands)
    const pending = await read($, confirm)
    const open = await read($, expanded)
    const unfolded = await read($, aboutOpen)
    const changesUnfolded = await read($, changesOpen)
    const working = await read($, busy)
    const which = await read($, tab)
    const found = await read($, caps)
    const held = await read($, blocked)
    const seenBands = await read($, bands)
    const hidden = await read($, hiddenBands)
    const usage = await read($, spend)
    const ups = await read($, updates)
    const isChecking = await read($, checking)
    // Cells a card's text gets: the pane's width less the card's border and padding. Unknown: the text wraps whole.
    const cols = (e.props as { bodyColumns?: unknown }).bodyColumns
    const cardCols = typeof cols === 'number' && cols > 0 ? cols - 4 : null

    const card = (m: ModRow) => {
      const name = shortName(m.id)
      const self = name === 'loadout'
      const openCmd = openCommandFor(name, cmds)
      const isBusy = working === m.id
      const isOpen = open === m.id
      const mine = found[m.id] ?? []
      const sp = usage[name]
      const up = ups[m.id]
      const waiting = hasUpdate(up) && !up?.requested
      const rarity = rarityOf(m, mine)
      const tone = RARITY_COLOR[rarity]
      const toggleBtn = self ? null : (
        <Button key={`toggle-${m.id}`} plain onPress={() => (isBusy ? undefined : void act($, m.enabled ? 'disable' : 'enable', m))}>
          {isBusy ? <Text dimColor>{'• • •'}</Text> : m.enabled ? <Text color="success" bold>{`◆ ${w.on}`}</Text> : <Text dimColor>{`◇ ${w.off}`}</Text>}
        </Button>
      )
      return (
        <Box
          key={`card-${m.id}`}
          flexDirection="column"
          borderStyle={rarity === 'legendary' || rarity === 'epic' ? 'double' : 'round'}
          borderColor={tone}
          hover={{ borderColor: 'claude' }}
          paddingX={1}
          marginBottom={1}
          overflow="hidden"
        >
          <Box justifyContent="space-between" alignItems="center" gap={1} minWidth={0}>
            <Box gap={1} flexShrink={1} minWidth={0} overflow="hidden">
              <Text color={tone}>{m.icon}</Text>
              <Text bold color={tone} wrap="truncate-end">{m.label}</Text>
            </Box>
            {toggleBtn}
          </Box>
          <Text color={tone} dimColor={!m.enabled} wrap="truncate-end">
            {w.item(w.rarity[rarity], m.isMod ? w.kindMod : w.kindPlugin)}
            <Text dimColor>{m.builtin ? ` · ${w.builtin}` : m.version ? ` · ${w.level(m.version)}` : ''}</Text>
          </Text>
          {m.about !== '' &&
            (!aboutFolds(m.about, cardCols) ? (
              <Text color="warning" italic dimColor wrap="wrap">{`“${m.about}”`}</Text>
            ) : unfolded === m.id ? (
              <Box flexDirection="column">
                <Text color="warning" italic dimColor wrap="wrap">{`“${m.about}”`}</Text>
                <Button key={`about-${m.id}`} plain onPress={() => void update($, aboutOpen, x => (x === m.id ? null : m.id))}>
                  <Text dimColor>{`▴ ${w.less}`}</Text>
                </Button>
              </Box>
            ) : (
              <Button key={`about-${m.id}`} plain onPress={() => void update($, aboutOpen, x => (x === m.id ? null : m.id))}>
                <Text color="warning" italic dimColor wrap="truncate-end">{`▸ “${m.about}”`}</Text>
              </Button>
            ))}
          {mine.length > 0 && (
            <Text wrap="wrap">
              {mine.map((c, i) => (
                <Text key={`cap-${m.id}-${c}`} color={LOUD.includes(c) ? 'warning' : 'success'} dimColor={!LOUD.includes(c)}>
                  {`${i ? '  ' : ''}+${w.caps[c]}`}
                </Text>
              ))}
            </Text>
          )}
          {m.origin?.kind === 'github' && <Text dimColor wrap="wrap">{`⌂ ${w.fromStore(m.origin.repo)}`}</Text>}
          {m.origin?.kind === 'folder' && <Text dimColor wrap="wrap">{`⌂ ${m.pin ? w.fromLocalGit(m.pin) : w.fromFolder}`}</Text>}
          {up?.requested ? (
            <Text color="claude">{`↻ ${w.updating}`}</Text>
          ) : (
            <Box flexDirection="column">
              {up && up.behind > 0 && <Text color="claude" bold>{w.behind(up.behind)}</Text>}
              {up?.latest && <Text color="claude" bold>{w.newVersion(up.latest)}</Text>}
            </Box>
          )}
          {up && up.changed > 0 && (
            <Button key={`changes-${m.id}`} plain onPress={() => void update($, changesOpen, x => (x === m.id ? null : m.id))}>
              <Text dimColor wrap="wrap">{`${changesUnfolded === m.id ? '▾' : '▸'} ${w.yourChanges(up.changed)}`}</Text>
            </Button>
          )}
          {up && up.changed > 0 && changesUnfolded === m.id && (
            <Box flexDirection="column">
              <Box flexDirection="column" paddingLeft={2}>
                {up.files.map(f => (
                  <Text key={`file-${m.id}-${f.path}`} dimColor wrap="truncate-start">{`${w.fileStatus(f.status)} · ${f.path.split('/').pop() ?? f.path}`}</Text>
                ))}
              </Box>
              {up.patch && <Text dimColor wrap="wrap">{w.patchAt(up.patch)}</Text>}
              <Button key={`explain-${m.id}`} label={w.explainChanges} onPress={() => void $.prompt.submit({ text: w.askExplain(m.label, up.dir ?? '') })} />
            </Box>
          )}
          {sp && sp.calls > 0 && (
            <Text color={sp.usd >= 1 ? 'warning' : undefined} dimColor={sp.usd < 1} wrap="wrap">
              {w.spent(sp.calls, sp.tokens >= 1000 ? `${Math.round(sp.tokens / 1000)}k` : String(sp.tokens), sp.usd.toFixed(2))}
            </Text>
          )}
          {!self && (
            <Box gap={1} marginTop={1} flexWrap="wrap">
              {waiting && <Button key={`upd-now-${m.id}`} variant="primary" label={`↻ ${w.update}`} onPress={() => void askSafeUpdate($, m, up)} />}
              {openCmd && m.enabled && mine.includes('pane') && (
                <Button key={`open-${m.id}`} label={`${w.open} ↗`} onPress={() => void $.command.run({ command: openCmd })} />
              )}
              {!m.builtin && (
                <Button key={`more-${m.id}`} label={isOpen ? `${w.less} ▴` : `${w.more} ▾`} onPress={() => void update($, expanded, x => (x === m.id ? null : m.id))} />
              )}
            </Box>
          )}
          {isOpen && (
            <Box gap={1} marginTop={1} flexWrap="wrap">
              {!m.builtin && !waiting && !up?.requested && <Button key={`upd-${m.id}`} label={`↻ ${w.update}`} onPress={() => void askSafeUpdate($, m, up)} />}
              {up?.source === 'github' && up.repo && (
                <Button key={`pin-${m.id}`} label={`⌁ ${w.pin}`} onPress={() => void $.prompt.submit({ text: w.askPin(m.label, m.id, up.repo ?? '') })} />
              )}
              {!m.builtin &&
                (pending === m.id ? (
                  <Button key={`rm-${m.id}`} variant="primary" label={w.sure} onPress={() => void act($, 'uninstall', m)} />
                ) : (
                  <Button key={`rm-${m.id}`} label={w.uninstall} dimColor onPress={() => void update($, confirm, () => m.id)} />
                ))}
            </Box>
          )}
        </Box>
      )
    }

    const heldCard = (b: Blocked) => (
      <Box key={`held-${b.name}`} flexDirection="column" borderStyle="round" borderColor="warning" paddingX={1} marginBottom={1}>
        <Box gap={1}>
          <Text color="warning">⚠</Text>
          <Text bold>{b.name}</Text>
          <Text dimColor>{b.version ? `v${b.version}` : ''}</Text>
        </Box>
        <Text color="warning" wrap="wrap">{w.pendingAudit}</Text>
        {b.caps.length > 0 && (
          <Text wrap="wrap">
            {b.caps.map((c, i) => (
              <Text key={`hcap-${b.name}-${c}`} color={LOUD.includes(c) ? 'warning' : undefined} dimColor={!LOUD.includes(c)}>
                {`${i ? ' · ' : ''}${w.caps[c]}`}
              </Text>
            ))}
          </Text>
        )}
        <Box gap={1} marginTop={1} flexWrap="wrap">
          <Button key={`audit-${b.name}`} variant="primary" label={w.auditNow} onPress={() => void $.prompt.submit({ text: w.askAudit(b.name, b.version, b.root) })} />
          <Button
            key={`allow-${b.name}`}
            dimColor
            label={w.allowAnyway}
            onPress={() => void approve($, b, 'manual').then(() => recheck($))}
          />
        </Box>
      </Box>
    )

    const bandLabel = (plugin: string) => list.find(m => shortName(m.id) === plugin)?.label ?? plugin
    const bandsBody = (
      <Box flexDirection="column" marginTop={1}>
        <Text bold>{w.bandsTitle}</Text>
        {seenBands.length === 0 && <Text dimColor wrap="wrap">{w.noBands}</Text>}
        {seenBands.map(plugin => {
          const off = hidden.includes(plugin)
          return (
            <Box key={`band-row-${plugin}`} justifyContent="space-between" alignItems="center" gap={1} minWidth={0}>
              <Box gap={1} flexShrink={1} minWidth={0} overflow="hidden">
                <Text bold={!off} dimColor={off} wrap="truncate-end">{bandLabel(plugin)}</Text>
                {!drawing.includes(plugin) && <Text dimColor wrap="truncate-end">{`· ${w.bandQuiet}`}</Text>}
              </Box>
              <Button key={`band-${plugin}`} plain onPress={() => void toggleBand($, plugin)}>
                {off ? <Text dimColor>{`○ ${w.bandHidden}`}</Text> : <Text color="success" bold>{`● ${w.bandShown}`}</Text>}
              </Button>
            </Box>
          )
        })}
      </Box>
    )

    const modRows = list.filter(m => m.isMod)
    const plugins = list.filter(m => !m.isMod)
    const tabRows = which === 'mods' ? modRows : plugins
    const modsBody = (
      <Box flexDirection="column">
        {held.map(heldCard)}
        <Box gap={1} marginBottom={1}>
          <Button key="tab-mods" variant={which === 'mods' ? 'primary' : 'secondary'} label={`${w.mods} ${modRows.length}`} onPress={() => void update($, tab, () => 'mods')} />
          <Button key="tab-plugins" variant={which === 'plugins' ? 'primary' : 'secondary'} label={`${w.plugins} ${plugins.length}`} onPress={() => void update($, tab, () => 'plugins')} />
        </Box>
        {list.length === 0 && <Text dimColor>{w.loading}</Text>}
        {list.length > 0 && which === 'plugins' && plugins.length === 0 && <Text dimColor>{w.emptyPlugins}</Text>}
        {tabRows.map(card)}
        <Box gap={1} flexWrap="wrap">
          <Button key="lo-check" label={isChecking ? w.checking : `↻ ${w.checkAll}`} onPress={() => void checkUpdates($, false)} />
          <Button key="lo-refresh" hotkey="r" dimColor label={w.refresh} onPress={() => void loadMods($).then(() => recheck($)).then(() => checkUpdates($, true))} />
        </Box>
        <Text dimColor wrap="wrap">{`🛡 ${w.safeNote}`}</Text>
        {bandsBody}
      </Box>
    )

    return (
      <Box flexDirection="column">
        <Box marginBottom={1} gap={1}>
          <Text bold color="claude">{`⚔ ${w.inventory}`}</Text>
          <Text dimColor>{`· ${w.active(modRows.filter(m => m.enabled).length, modRows.length)}`}</Text>
        </Box>
        {modsBody}
      </Box>
    )
  })
}
