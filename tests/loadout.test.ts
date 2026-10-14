// Loadout against the engine: `claude plugin test <mod folder>`.
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { builtinIds, capsOf, isSafeId, openCommandFor, pinsOf, rarityOf, sortRows, toRow } from '../hooks/catalogo'
import { isApproved, usesText } from '../hooks/gate'
import { pickLang, words } from '../hooks/i18n'
import { costOf } from '../hooks/pricing'
import { changedFiles, changedList, compareVersions, listedVersion, sourceOf } from '../hooks/updates'

const BAND = {
  plugin: 'loadout',
  component: 'AbovePrompt',
  requestId: 'band',
  props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 160 as number, scroll: { offset: 0, bodyRows: 6 }, view: {} },
} as const

const PANE = {
  plugin: 'loadout',
  component: 'Pane',
  requestId: 'loadout',
  props: { title: 'Loadout', isFocused: true, bodyColumns: 44 as number, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

const LIST = [
  { id: 'savvy-progress@claude-kit', version: '1.2.0', enabled: true, installPath: '/p/savvy' },
  { id: 'filetree@claude-code-filetree', version: '0.2.24', enabled: true, installPath: '/p/filetree' },
  { id: 'codex@openai-codex', version: '1.0.6', enabled: true, installPath: '/p/codex' },
  { id: 'discord@claude-plugins-official', version: '0.0.4', enabled: false, installPath: '/p/discord' },
]

/** What each fake plugin's own plugin.json says it does. */
const DESCRIPTIONS: Record<string, string> = {
  '/p/savvy/.claude-plugin/plugin.json': 'savvy-progress: progress bar and an agents panel',
  '/p/codex/.claude-plugin/plugin.json': 'Use Codex from Claude Code to review code or delegate tasks. It also runs adversarial reviews of your changes.',
}

const VALIDATE = `  ❯ ./register.tsx hooks: session.start, tool.call{tool=Agent}, ui.render{component=AbovePrompt}, ui.render{component=Pane, requestId=x}
  ❯ ./register.tsx calls: $.process.run (via x), $.tool.register, $.ui.open`

/** A fake engine: commands, usage, the plugin CLI and each plugin's hooks.json. */
function engine(on: On, below: unknown = { type: 'Text', children: [''] }, language?: string) {
  const runs: string[][] = []
  const ran: string[] = []
  const panes: string[] = []
  const hidden = new Set<string>()
  const toasts: string[] = []
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: undefined }) as never)
  on('command.list', () => ({ value: [['agents-info', 'savvy-progress'], ['filetree', 'filetree']].map(([name, plugin]) => ({ name, plugin, description: '', source: 'plugin' })) }) as never)
  on('command.run', ($, e) => {
    ran.push(e.args ? `${e.command} ${e.args}` : e.command)
    return {}
  })
  on('env.get', ($, e) => ({ value: (e as { name?: string }).name === 'HOME' ? '/home/user' : undefined }) as never)
  on('fs.exists', () => ({ value: false }) as never)
  on('fs.write', () => ({ value: undefined }) as never)
  on('fs.read', ($, e) => {
    const path = String((e as { path: string }).path)
    if (path.endsWith('known_marketplaces.json'))
      return {
        value: JSON.stringify({
          'claude-kit': { source: { source: 'directory', path: '/pin/claude-kit' }, installLocation: '/pin/claude-kit' },
          'openai-codex': { source: { source: 'github', repo: 'openai/codex-plugin-cc' }, installLocation: '/mkt/openai-codex' },
        }),
      } as never
    if (path === '/mkt/openai-codex/.claude-plugin/marketplace.json') return { value: JSON.stringify({ plugins: [{ name: 'codex', version: '1.1.0' }] }) } as never
    if (path.endsWith('/.claude-plugin/plugin.json')) return { value: JSON.stringify({ description: DESCRIPTIONS[path] }) } as never
    if (path.endsWith('installed_plugins.json')) return { value: JSON.stringify({ plugins: { 'savvy-progress@claude-kit': [{ gitCommitSha: '272a877f39b6' }] } }) } as never
    return { value: path.includes('savvy') || path.includes('filetree') ? '{"modules":["./register.tsx"]}' : '{"hooks":{}}' } as never
  })
  on('settings.read', () => ({ value: { enabledPlugins: { 'cc-plugin-you-should-know@builtin': true }, language } }) as never)
  on('process.run', ($, e) => {
    const argv = (e as { argv: string[] }).argv
    runs.push(argv)
    const git = argv[0] === 'git' ? argv.slice(3).join(' ') : ''
    // A pin on a commit, like a real pinned clone: no upstream branch, origin/HEAD exists.
    if (git.startsWith('rev-parse --abbrev-ref @{u}')) return { value: { exitCode: 128, stdout: '', stderr: 'fatal: HEAD does not point to a branch', isStdoutTruncated: false, isStderrTruncated: false } } as never
    const stdout = git.startsWith('rev-parse')
      ? 'b6c42326903af3dd\n'
      : git.startsWith('rev-list')
        ? '3\n'
        : git.startsWith('status')
          ? ' M plugins/savvy-progress/hooks/register.tsx\n M plugins/savvy-progress/README.md\n'
          : git.startsWith('diff')
            ? 'diff --git a/x b/x\n'
            : argv.includes('list')
              ? JSON.stringify(LIST)
              : argv.includes('validate')
                ? VALIDATE
                : ''
    return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } } as never
  })
  on('ui.open', ($, e) => {
    const id = (e as { id: string }).id
    hidden.delete(id)
    if (panes.includes(id)) return { value: { isPlaced: true } } as never
    panes.push(id)
    return { value: { isPlaced: true } } as never
  })
  on('ui.close', ($, e) => {
    const id = (e as { id: string }).id
    panes.splice(panes.indexOf(id), 1)
    return { value: undefined } as never
  })
  on('ui.panes', () => ({ value: panes.map(id => ({ id, title: id, isShown: !hidden.has(id), isFocused: false, isPlaced: true })) }) as never)
  on('ui.toast', ($, e) => {
    toasts.push(String((e as { text?: string }).text ?? JSON.stringify(e)))
    return { value: undefined } as never
  })
  const prompts: string[] = []
  on('prompt.submit', ($, e) => {
    prompts.push(String((e as { text?: string }).text ?? ''))
    return { text: String((e as { text?: string }).text ?? '') } as never
  })
  on('ui.render', { component: 'AbovePrompt' }, () => below as never)
  return { runs, ran, toasts, panes, hidden, prompts }
}

const start = ($: Engine) => $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true } as never)

test("the band has Loadout's own button and lets the other mods' bands show below it", async ($, on) => {
  engine(on, { type: 'Text', children: ['other-mod-band'] })
  await start($)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    const text = JSON.stringify(await ui.drawn())
    expect(text).toContain('⚙ Loadout')
    expect(text).toContain('other-mod-band')
    // The meters and the launcher buttons are gone.
    expect(text).not.toContain('"Svg"')
    expect(text).not.toContain('42%')
    expect(text).not.toContain('lo-agents')
    expect(text).not.toContain('lo-files')
    expect(text).not.toContain('lo-size')
    expect(text).not.toContain('lo-blocked')
    expect(text).not.toContain('lo-updates')
    await ui.unmount()
  }
})

test('the ⚙ Loadout button opens and closes the panel, and lights up while it is open', async ($, on) => {
  const { panes, ran } = engine(on)
  await start($)
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(JSON.stringify(await band.find({ key: 'lo-open' }))).not.toContain('primary')
  await band.press({ key: 'lo-open' })
  expect(panes).toEqual(['loadout'])
  expect(JSON.stringify(await band.find({ key: 'lo-open' }))).toContain('primary')
  await band.press({ key: 'lo-open' })
  expect(panes).toEqual([])
  expect(JSON.stringify(await band.find({ key: 'lo-open' }))).not.toContain('primary')
  // The /loadout command opens it too, and the button then closes it.
  await $.command.run({ command: 'loadout' } as never)
  expect(panes).toEqual(['loadout'])
  expect(JSON.stringify(await band.find({ key: 'lo-open' }))).toContain('primary')
  await band.press({ key: 'lo-open' })
  expect(panes).toEqual([])
  expect(ran).toEqual([])
  await band.unmount()
})

test('a panel hidden behind another tab comes forward, never closed', async ($, on) => {
  const { panes, hidden } = engine(on)
  await start($)
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await band.press({ key: 'lo-open' })
  expect(panes).toEqual(['loadout'])
  hidden.add('loadout')
  await band.press({ key: 'lo-open' })
  expect(panes).toEqual(['loadout'])
  expect(hidden.has('loadout')).toBe(false)
  expect(JSON.stringify(await band.find({ key: 'lo-open' }))).toContain('primary')
  // In view now: the next press closes it.
  await band.press({ key: 'lo-open' })
  expect(panes).toEqual([])
  await band.unmount()
})

test("never nests Claude Code's own placeholder (the desktop would drop the band)", async ($, on) => {
  engine(on, { type: 'engine', ref: 0 })
  await start($)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface, props: { ...BAND.props, bodyColumns: 0 } })
    const text = JSON.stringify(await ui.drawn())
    expect(text).toContain('⚙ Loadout')
    expect(text).not.toContain('"engine"')
    expect(text).not.toContain('"width":0')
    await ui.unmount()
  }
})

test('draws even when nothing below draws', async ($, on) => {
  engine(on)
  on('ui.render', { component: 'AbovePrompt' }, () => {
    throw new Error('nothing below')
  })
  await start($)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(JSON.stringify(await ui.drawn())).toContain('⚙ Loadout')
  await ui.unmount()
})

test('the panel: tabs, cards with ON/OFF, capabilities and pin; toggling uses the user scope', async ($, on) => {
  const { runs, toasts } = engine(on)
  await start($)
  await $.command.run({ command: 'loadout' } as never)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const text = JSON.stringify(await ui.drawn())
    expect(text).toContain('savvy-progress')
    expect(text).toContain('filetree')
    expect(text).toContain('cc-plugin-you-should-know')
    expect(text).toContain('runs commands')
    expect(text).toContain('git copy on this computer (commit 272a877)')
    expect(text).toContain('3 of 3 active')
    expect(text).not.toContain('codex')
    // No Cockpit sections, gauges or per-mod section buttons.
    expect(text).not.toContain('"Svg"')
    expect(text).not.toContain('cockpit-')
    expect(text).not.toContain('make-')
    expect(text).not.toContain('Cockpit')
    await ui.unmount()
  }
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'tab-plugins' })
  expect(JSON.stringify(await ui.drawn())).toContain('codex')
  await ui.press({ key: 'toggle-discord@claude-plugins-official' })
  expect(runs.some(a => a.join(' ').endsWith('plugin enable discord@claude-plugins-official --scope user'))).toBe(true)
  expect(toasts.some(t => t.includes('discord'))).toBe(true)
  await ui.unmount()
})

test('uninstall needs a second click', async ($, on) => {
  const { runs } = engine(on)
  await start($)
  await $.command.run({ command: 'loadout' } as never)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'more-filetree@claude-code-filetree' })
  await ui.press({ key: 'rm-filetree@claude-code-filetree' })
  expect(runs.some(a => a.includes('uninstall'))).toBe(false)
  await ui.press({ key: 'rm-filetree@claude-code-filetree' })
  expect(runs.some(a => a.includes('uninstall') && a.includes('filetree@claude-code-filetree'))).toBe(true)
  await ui.unmount()
})

test('pure logic: safe ids, order, capabilities, pins, language', () => {
  expect(isSafeId('savvy-progress@claude-kit')).toBe(true)
  expect(isSafeId('x; rm -rf /@y')).toBe(false)
  const rows = sortRows([toRow({ id: 'loadout@my-mods' }, true, 'en'), toRow({ id: 'codex@openai-codex' }, false, 'en'), toRow({ id: 'filetree@x' }, true, 'en')])
  expect(rows.map(r => r.id)).toEqual(['filetree@x', 'codex@openai-codex', 'loadout@my-mods'])
  expect(capsOf(VALIDATE)).toEqual(['cmd', 'tools', 'gate', 'pane'])
  expect(pinsOf('{"plugins":{"a@b":[{"gitCommitSha":"abcdef123"}]}}')).toEqual({ 'a@b': 'abcdef1' })
  expect(pickLang('auto', 'spanish', null)).toBe('es')
  expect(pickLang('auto', undefined, 'es_MX.UTF-8')).toBe('es')
  expect(pickLang('auto', undefined, null)).toBe('en')
  expect(pickLang('es', 'english', null)).toBe('es')
  // A row is named after the plugin itself and carries no per-mod knowledge.
  const row = toRow({ id: 'savvy-progress@claude-kit' }, true, 'en')
  expect(row.label).toBe('savvy-progress')
  expect(row).not.toHaveProperty('open')
  expect(row).not.toHaveProperty('openArgs')
  expect([toRow({ id: 'loadout@x' }, true, 'en').icon, toRow({ id: 'a@x' }, true, 'en').icon, toRow({ id: 'a@x' }, false, 'en').icon]).toEqual(['⚙', '◇', '▪'])
})

test('openCommandFor: same-name command first, else the only one, else none; other plugins are ignored', () => {
  expect(openCommandFor('foo', [{ name: 'bar', plugin: 'foo' }, { name: 'foo', plugin: 'foo' }])).toBe('foo')
  expect(openCommandFor('foo', [{ name: 'bar', plugin: 'foo' }])).toBe('bar')
  expect(openCommandFor('foo', [{ name: 'a', plugin: 'foo' }, { name: 'b', plugin: 'foo' }])).toBeNull()
  expect(openCommandFor('foo', [{ name: 'foo', plugin: 'other' }, { name: 'x' }])).toBeNull()
  expect(openCommandFor('foo', [])).toBeNull()
})

test('builtinIds: the @builtin keys, sorted', () => {
  expect(builtinIds({ 'b@builtin': true, 'a@x': true, 'a@builtin': false })).toEqual(['a@builtin', 'b@builtin'])
  expect(builtinIds(undefined)).toEqual([])
})

test('pure logic: the gate reads versions and scans, prices are estimated', () => {
  expect(isApproved({ x: { version: '1.0.0' } }, 'x', '1.0.0')).toBe(true)
  expect(isApproved({ x: { version: '1.0.0' } }, 'x', '1.0.1')).toBe(false)
  expect(isApproved({}, 'y', '1.0.0')).toBe(false)
  expect(capsOf(usesText({ events: ['tool.call{tool=Bash}', 'prompt.compose'], calls: ['$.http.fetch', '$.fs.write'] }))).toEqual(['write', 'net', 'gate', 'system'])
  const million = { input_tokens: 1_000_000, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
  expect(costOf('claude-opus-5-5', million)).toBe(4)
  expect(costOf('claude-sonnet-5-5', million)).toBe(2)
  expect(costOf('something-new', million)).toBe(4)
})

test('"Open ↗" runs the mod\'s own command, found from the commands it added', async ($, on) => {
  const { ran } = engine(on)
  await start($)
  await $.command.run({ command: 'loadout' } as never)
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await pane.press({ key: 'open-savvy-progress@claude-kit' })
  await pane.press({ key: 'open-filetree@claude-code-filetree' })
  expect(ran).toEqual(['agents-info', 'filetree'])
  await pane.unmount()
})

test('safe updates: a pinned clone behind its author and a newer GitHub version show on their cards; your changes are kept', async ($, on) => {
  const { prompts, runs } = engine(on)
  await start($)
  await $.command.run({ command: 'loadout' } as never)
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await pane.press({ key: 'lo-check' })
  let text = JSON.stringify(await pane.drawn())
  expect(text).toContain('3 new changes from its author')
  expect(text).toContain('Your changes: 2 files')
  expect(runs.some(a => a.join(' ') === 'git -C /pin/claude-kit fetch --quiet origin')).toBe(true)
  // The band tells there are updates waiting, and its button shows the panel.
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(JSON.stringify(await band.find({ key: 'lo-updates' }))).toContain('2 updates available')
  await band.press({ key: 'lo-updates' })
  expect(JSON.stringify(await band.find({ key: 'lo-open' }))).toContain('primary')
  await pane.press({ key: 'upd-now-savvy-progress@claude-kit' })
  // Once asked of Claude it no longer counts as waiting.
  expect(JSON.stringify(await band.find({ key: 'lo-updates' }))).toContain('1 update available')
  expect(prompts.at(-1)).toContain('git -C /pin/claude-kit stash')
  expect(prompts.at(-1)).toContain('git -C /pin/claude-kit checkout --detach origin/HEAD')
  expect(prompts.at(-1)).toContain('HEAD..origin/HEAD')
  // Asked once: the card says Claude is on it and the button is gone.
  text = JSON.stringify(await pane.drawn())
  expect(text).toContain('Claude is updating it')
  expect(text).not.toContain('upd-now-savvy-progress@claude-kit')
  expect(prompts.at(-1)).toContain('approved.json')
  await pane.press({ key: 'tab-plugins' })
  text = JSON.stringify(await pane.drawn())
  expect(text).toContain('v1.1.0 available')
  await pane.press({ key: 'upd-now-codex@openai-codex' })
  expect(prompts.at(-1)).toContain('claude plugin update codex@openai-codex --scope user')
  await band.unmount()
  await pane.unmount()
})

test('pure logic: sources, listed versions, version order, changed files', () => {
  const known = JSON.stringify({ k: { source: { source: 'directory', path: '/a' }, installLocation: '/a' }, g: { source: { source: 'github', repo: 'o/r' }, installLocation: '/m' } })
  expect(sourceOf('x@k', known)).toEqual({ kind: 'folder', marketplace: 'k', dir: '/a' })
  expect(sourceOf('y@g', known)).toEqual({ kind: 'github', marketplace: 'g', dir: '/m', repo: 'o/r' })
  expect(sourceOf('z@none', known)).toEqual({ kind: 'other', marketplace: 'none' })
  expect(listedVersion('{"plugins":[{"name":"a","version":"2.0.1"}]}', 'a')).toBe('2.0.1')
  expect(compareVersions('1.10.0', '1.9.2')).toBe(1)
  expect(compareVersions('1.2.0', '1.2')).toBe(0)
  expect(compareVersions('v0.9', '1.0.0')).toBe(-1)
  expect(changedFiles(' M a\n?? b\n\n')).toBe(2)
  expect(changedList(' M a.ts\nA  b.ts\n?? c.ts\n D d.ts\nR  old.ts -> new.ts\n\n')).toEqual([
    { status: 'M', path: 'a.ts' },
    { status: 'A', path: 'b.ts' },
    { status: '??', path: 'c.ts' },
    { status: 'D', path: 'd.ts' },
    { status: 'R', path: 'new.ts' },
  ])
})

test('descripción: siempre la del plugin.json del mod (sin el nombre repetido), nunca una nuestra', () => {
  expect(toRow({ id: 'repo-guard@my-mods', description: 'repo-guard — repos de otros: leer sí' }, true, 'es')).toMatchObject({ label: 'repo-guard', about: 'Repos de otros: leer sí' })
  expect(toRow({ id: 'loadout@my-mods', description: 'Loadout: manage your mods' }, true, 'es').about).toBe('Manage your mods')
  expect(toRow({ id: 'nuevo@x', description: ' Hace algo útil ' }, true, 'es').about).toBe('Hace algo útil')
  expect(toRow({ id: 'cc-plugin-you-should-know@builtin' }, true, 'es').about).toBe('')
  expect(toRow({ id: 'nuevo@x' }, true, 'es').about).toBe('')
})

test('rareza: apagado pobre, Loadout legendario, corre comandos épico, con panel raro, mod poco común, plugin común', () => {
  const row = (id: string, isMod: boolean, enabled = true) => toRow({ id, enabled }, isMod, 'es')
  expect(rarityOf(row('repo-guard@my-mods', true, false), ['cmd'])).toBe('poor')
  expect(rarityOf(row('loadout@my-mods', true), ['cmd'])).toBe('legendary')
  expect(rarityOf(row('repo-guard@my-mods', true), ['cmd', 'write'])).toBe('epic')
  expect(rarityOf(row('cualquiera@de-otro', true), ['write', 'pane'])).toBe('rare')
  expect(rarityOf(row('nuevo@x', true), [])).toBe('uncommon')
  expect(rarityOf(row('codex@openai-codex', false), [])).toBe('common')
})

test('rareza general: el panel propio se detecta en el código de cualquier mod; en español el orden es "Mod Épico"', () => {
  const out = '  ❯ ./register.tsx hooks: session.start, ui.render{component=Pane, requestId=x}\n  ❯ ./register.tsx calls: $.ui.open'
  expect(capsOf(out)).toContain('pane')
  expect(capsOf('  ❯ ./r.tsx hooks: ui.render{component=AbovePrompt}')).not.toContain('pane')
  expect(words('es').item(words('es').rarity.epic, words('es').kindMod)).toBe('Mod Épico')
  expect(words('en').item(words('en').rarity.epic, words('en').kindMod)).toBe('Epic Mod')
})

for (const [language, item, desc, equipped] of [
  ['es', 'Mod Épico', 'Progress bar and an agents panel', 'Equipado'],
  ['en', 'Epic Mod', 'Progress bar and an agents panel', 'Equipped'],
] as const) {
  test(`any user, ${language}: each card shows the mod's own description and rarity in the language's word order`, async ($, on) => {
    engine(on, undefined, language)
    await start($)
    await $.command.run({ command: 'loadout' } as never)
    const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
    const text = JSON.stringify(await pane.drawn())
    expect(text).toContain(item)
    expect(text).toContain(desc)
    expect(text).toContain(equipped)
    expect(text).toContain('savvy-progress')
    // A plain plugin's card, on the Plugins tab, shows its own description too.
    await pane.press({ key: 'tab-plugins' })
    expect(JSON.stringify(await pane.drawn())).toContain('Use Codex from Claude Code')
    await pane.unmount()
  })
}

for (const [surface, language, less, tail] of [
  ['terminal', 'en', 'Less', 'delegate tasks. It also runs adversarial reviews of your changes.'],
  ['desktop', 'es', 'Menos', 'delegate tasks. It also runs adversarial reviews of your changes.'],
] as const) {
  test(`a long description unfolds to its full text and folds back (${surface}, ${language})`, async ($, on) => {
    engine(on, undefined, language)
    await start($)
    await $.command.run({ command: 'loadout' } as never)
    const pane = await $.ui.mount({ ...PANE, surface })
    await pane.press({ key: 'tab-plugins' })
    expect(JSON.stringify(await pane.drawn())).not.toContain(`▴ ${less}`)
    await pane.press({ key: 'about-codex@openai-codex' })
    let text = JSON.stringify(await pane.drawn())
    expect(text).toContain(tail)
    expect(text).toContain(`▴ ${less}`)
    await pane.press({ key: 'about-codex@openai-codex' })
    text = JSON.stringify(await pane.drawn())
    expect(text).not.toContain(`▴ ${less}`)
    expect(text).toContain('▸')
    await pane.unmount()
  })
}

for (const [language, modified, backup] of [
  ['en', 'modified', 'Backup'],
  ['es', 'modificado', 'Respaldo'],
] as const) {
  test(`your changes to a pinned mod can be listed and explained (${language})`, async ($, on) => {
    const { prompts } = engine(on, undefined, language)
    await start($)
    await $.command.run({ command: 'loadout' } as never)
    for (const surface of ['terminal', 'desktop'] as const) {
      const pane = await $.ui.mount({ ...PANE, surface })
      await pane.press({ key: 'lo-check' })
      expect(JSON.stringify(await pane.drawn())).not.toContain('register.tsx')
      await pane.press({ key: 'changes-savvy-progress@claude-kit' })
      const text = JSON.stringify(await pane.drawn())
      expect(text).toContain(`${modified} · register.tsx`)
      expect(text).toContain(`${modified} · README.md`)
      expect(text).toContain(backup)
      await pane.press({ key: 'explain-savvy-progress@claude-kit' })
      expect(prompts.at(-1)).toContain('git -C /pin/claude-kit')
      // Folding it back returns the card to how it was.
      await pane.press({ key: 'changes-savvy-progress@claude-kit' })
      expect(JSON.stringify(await pane.drawn())).not.toContain('register.tsx')
      await pane.unmount()
    }
  })
}

test('each card says where the mod was installed from: a marketplace, or a git copy on this computer', async ($, on) => {
  engine(on)
  await start($)
  await $.command.run({ command: 'loadout' } as never)
  for (const surface of ['terminal', 'desktop'] as const) {
    const pane = await $.ui.mount({ ...PANE, surface })
    expect(JSON.stringify(await pane.drawn())).toContain('Installed from a git copy on this computer (commit 272a877)')
    await pane.press({ key: 'tab-plugins' })
    expect(JSON.stringify(await pane.drawn())).toContain('Installed from a marketplace (openai/codex-plugin-cc)')
    await pane.press({ key: 'tab-mods' })
    await pane.unmount()
  }
})

test('descriptions open folded, and opening the panel folds them again', async ($, on) => {
  engine(on)
  await start($)
  await $.command.run({ command: 'loadout' } as never)
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(JSON.stringify(await pane.drawn())).toContain('▸ “Progress bar and an agents panel”')
  await pane.press({ key: 'about-savvy-progress@claude-kit' })
  expect(JSON.stringify(await pane.drawn())).toContain('▴')
  await pane.unmount()
  await $.command.run({ command: 'loadout' } as never)
  const again = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(JSON.stringify(await again.drawn())).not.toContain('▴')
  await again.unmount()
})
