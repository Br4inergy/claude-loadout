/**
 * Loadout's words in English and Spanish, picked by Claude Code's `language` setting, then the locale (nothing to configure).
 */
export type Lang = 'en' | 'es'

const EN = {
  loadout: 'Loadout',
  mods: 'Mods',
  plugins: 'Plugins',
  on: 'Equipped',
  off: 'Equip',
  open: 'Open',
  more: 'More',
  less: 'Less',
  update: 'Audit & update',
  uninstall: 'Uninstall',
  sure: 'Sure? Uninstall',
  refresh: 'Refresh',
  checkAll: 'Check updates',
  builtin: 'built-in',
  loading: 'Loading your loadout…',
  emptyPlugins: 'No classic plugins.',
  active: (on: number, total: number) => `${on} of ${total} active`,
  inventory: 'Inventory',
  rarity: { poor: 'Stored', common: 'Common', uncommon: 'Enhanced', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' },
  level: (v: string) => `v${v}`,
  kindMod: 'Mod',
  kindPlugin: 'Plugin',
  item: (rarity: string, kind: string) => `${rarity} ${kind}`,
  turning: (on: boolean, name: string) => `${on ? 'Turning on' : 'Turning off'} ${name}…`,
  removing: (name: string) => `Uninstalling ${name}…`,
  done: (verb: 'enable' | 'disable' | 'uninstall', name: string, applied: boolean) =>
    `${name} ${verb === 'enable' ? 'is on' : verb === 'disable' ? 'is off' : 'uninstalled'}${applied ? '' : ' · applies in your next session'}`,
  failed: (why: string) => `Couldn't do it: ${why}`,
  caps: {
    cmd: 'runs commands',
    write: 'writes files',
    net: 'network',
    prompt: 'sends prompts',
    model: 'calls the model',
    tools: 'adds tools',
    gate: 'watches tool calls',
    system: 'edits the system prompt',
    pane: 'own panel',
  },
  spent: (calls: number, tokens: string, usd: string) => `This session: ${calls} model ${calls === 1 ? 'call' : 'calls'} · ${tokens} tokens · ≈$${usd}`,
  bandsTitle: 'Bands above the prompt',
  bandShown: 'shown',
  bandHidden: 'hidden',
  noBands: 'No other mod has drawn a band yet.',
  bandQuiet: 'nothing to show right now',
  // Safe updates and the patch keeper
  behind: (n: number) => `↑ ${n} new ${n === 1 ? 'change' : 'changes'} from its author`,
  newVersion: (v: string) => `↑ v${v} available`,
  yourChanges: (n: number) => `✎ Your changes: ${n} ${n === 1 ? 'file' : 'files'} · kept when it updates`,
  fromStore: (repo: string | null) => `Installed from a marketplace${repo ? ` (${repo})` : ''}: updates when you approve them`,
  fromLocalGit: (sha: string) => `Installed from a git copy on this computer (commit ${sha}): you can edit it; the author's updates come only when you approve them`,
  fromFolder: 'Installed from a folder on this computer: your edits apply when you reload',
  fileStatus: (code: string) => ({ M: 'modified', A: 'added', D: 'deleted', '??': 'new', R: 'renamed' })[code === '??' ? '??' : code.charAt(0)] ?? code,
  patchAt: (p: string) => `Backup: ${p}`,
  explainChanges: 'Explain my changes',
  askExplain: (label: string, dir: string) =>
    `Loadout: explain in a few lines, for a non-programmer, what my own uncommitted changes to the mod «${label}» do. Run \`git -C ${dir} status\` and \`git -C ${dir} diff HEAD\` and read them; do not change anything.`,
  checking: 'Checking for updates…',
  upToDate: 'Everything is up to date',
  updatesFound: (n: number) => (n === 1 ? '1 update available' : `${n} updates available`),
  safeNote: 'New versions never run until you approve them.',
  updating: 'Claude is updating it…',
  pin: 'Pin to keep my changes',
  askSafeUpdate: (label: string, id: string, steps: string) =>
    `Loadout: update the mod «${label}» (${id}) safely. Follow these steps in order and STOP at step 2 if it is not safe.\n${steps}`,
  stepsFolder: (dir: string, behind: number, changed: number, patch: string | null, ref: string) =>
    [
      `1. Its code is a pinned git clone at ${dir}, ${behind} commits behind its author. Show me what changed: \`git -C ${dir} log --oneline HEAD..${ref}\` and the diff.`,
      '2. Audit the new code like a security review: network calls, commands, writes outside its folder, reads of secrets or env vars, rewrites of prompts or tool calls, obfuscated code; run `claude plugin validate` on it. Give me a verdict with the evidence.',
      changed > 0
        ? `3. If it is safe, keep my own changes (${changed} files, backed up at ${patch ?? 'the patch folder'}): \`git -C ${dir} stash\`, ${ref === '@{u}' ? `\`git -C ${dir} merge --ff-only @{u}\`` : `\`git -C ${dir} checkout --detach ${ref}\``}, \`git -C ${dir} stash pop\`. Resolve any conflict keeping both my change's intent and the author's new behavior, and tell me how.`
        : `3. If it is safe: ${ref === '@{u}' ? `\`git -C ${dir} merge --ff-only @{u}\`` : `\`git -C ${dir} checkout --detach ${ref}\``}.`,
      '4. Run `claude plugin validate` and `claude plugin test` (when it has tests) on the plugin folder until they pass.',
      '5. Approve the new version in ~/.claude/loadout/approved.json: `"<plugin name>": { "version": "<its plugin.json version>", "by": "audit", "approvedAt": "<ISO date>" }`, keeping the other entries.',
      '6. Tell me in a few lines what changed, your verdict, and to press Reload in Loadout.',
    ].join('\n'),
  stepsGithub: (id: string, dir: string, installed: string, latest: string, installPath: string) =>
    [
      `1. It is installed at v${installed} from a GitHub marketplace; the marketplace (refreshed at ${dir}) lists v${latest}. Show me what changed between the installed copy at ${installPath} and the new source.`,
      '2. Audit the new code like a security review: network calls, commands, writes outside its folder, reads of secrets or env vars, rewrites of prompts or tool calls, obfuscated code; run `claude plugin validate` on it. Give me a verdict with the evidence.',
      `3. If it is safe: \`claude plugin update ${id} --scope user\`.`,
      '4. Run `claude plugin validate` on the updated copy.',
      `5. Approve v${latest} in ~/.claude/loadout/approved.json: \`"<plugin name>": { "version": "${latest}", "by": "audit", "approvedAt": "<ISO date>" }\`, keeping the other entries.`,
      '6. Tell me in a few lines what changed, your verdict, and to press Reload in Loadout.',
    ].join('\n'),
  askPin: (label: string, id: string, repo: string) =>
    `Loadout: pin the mod «${label}» (${id}) so I can change it and still update it safely. 1. Clone https://github.com/${repo} ` +
    'into ~/.claude/loadout/pinned/<repo name> and check out the commit installed now (gitCommitSha in ~/.claude/plugins/installed_plugins.json). ' +
    '2. `claude plugin marketplace add` that folder. 3. Uninstall the current copy and install the same plugin from the new marketplace with `--scope user`. ' +
    '4. Run `claude plugin validate` on it. 5. Tell me to press Reload in Loadout. Its approval in ~/.claude/loadout/approved.json stays as is.',
  // Gate
  blocked: (n: number) => (n === 1 ? '1 mod blocked' : `${n} mods blocked`),
  blockedToast: (name: string) => `Loadout blocked «${name}»: not audited yet. Open Loadout to audit it.`,
  pendingAudit: 'Waiting for audit: its code has not run',
  auditNow: 'Audit with Claude',
  allowAnyway: 'Allow without audit',
  approvedReload: 'Approved · reloading',
  askAudit: (name: string, version: string, root: string) =>
    `Loadout blocked the mod «${name}» v${version} (${root}) because it has not been audited. Audit it now: read every file of its hooks ` +
    'module, run `claude plugin validate` on it, and check for network calls, commands, writes outside its folder, reads of secrets or ' +
    'env vars, rewrites of prompts or tool calls, and obfuscated code. Give me a clear verdict with the evidence. Only if it is safe, ' +
    `add it to ~/.claude/loadout/approved.json as "${name}": { "version": "${version}", "by": "audit", "approvedAt": <ISO date> } ` +
    '(keep the other entries), log it in ~/.claude/loadout/audit-log.txt and tell me to press Reload in Loadout.',
  askUpdate: (label: string, id: string) =>
    `Loadout: check whether the mod «${label}» (${id}) has a newer version in its marketplace or repository. If it does, ` +
    'audit it like a security review (claude plugin validate plus a manual review of network calls, commands, writes, secrets, ' +
    'rewrites and obfuscated code) and only if it passes update it and approve the new version in ~/.claude/loadout/approved.json. ' +
    'If there is none, say so in one line.',
}

const ES: typeof EN = {
  loadout: 'Loadout',
  mods: 'Mods',
  plugins: 'Plugins',
  on: 'Equipado',
  off: 'Equipar',
  open: 'Abrir',
  more: 'Más',
  less: 'Menos',
  update: 'Auditar y actualizar',
  uninstall: 'Desinstalar',
  sure: '¿Seguro? Desinstalar',
  refresh: 'Recargar',
  checkAll: 'Buscar actualizaciones',
  builtin: 'integrado',
  loading: 'Cargando tu loadout…',
  emptyPlugins: 'Sin plugins clásicos.',
  active: (on, total) => `${on} de ${total} activos`,
  inventory: 'Inventario',
  rarity: { poor: 'Guardado', common: 'Común', uncommon: 'Mejorado', rare: 'Raro', epic: 'Épico', legendary: 'Legendario' },
  level: v => `v${v}`,
  kindMod: 'Mod',
  kindPlugin: 'Plugin',
  item: (rarity, kind) => `${kind} ${rarity}`,
  turning: (on, name) => `${on ? 'Prendiendo' : 'Apagando'} ${name}…`,
  removing: name => `Desinstalando ${name}…`,
  done: (verb, name, applied) =>
    `${name} ${verb === 'enable' ? 'prendido' : verb === 'disable' ? 'apagado' : 'desinstalado'}${applied ? '' : ' · aplica en tu siguiente sesión'}`,
  failed: why => `No se pudo: ${why}`,
  caps: {
    cmd: 'corre comandos',
    write: 'escribe archivos',
    net: 'red',
    prompt: 'envía prompts',
    model: 'usa el modelo',
    tools: 'agrega herramientas',
    gate: 'vigila herramientas',
    system: 'edita el system prompt',
    pane: 'panel propio',
  },
  spent: (calls, tokens, usd) => `Esta sesión: ${calls} ${calls === 1 ? 'consulta' : 'consultas'} al modelo · ${tokens} tokens · ≈$${usd}`,
  bandsTitle: 'Bandas sobre el prompt',
  bandShown: 'visible',
  bandHidden: 'oculta',
  noBands: 'Ningún otro mod ha dibujado una banda todavía.',
  bandQuiet: 'sin nada que mostrar ahora',
  behind: n => `↑ ${n} ${n === 1 ? 'cambio nuevo' : 'cambios nuevos'} de su autor`,
  newVersion: v => `↑ v${v} disponible`,
  yourChanges: n => `✎ Tus cambios: ${n} ${n === 1 ? 'archivo' : 'archivos'} · se conservan al actualizar`,
  fromStore: repo => `Instalado desde una tienda${repo ? ` (${repo})` : ''}: se actualiza cuando lo apruebas`,
  fromLocalGit: sha => `Instalado desde una copia git en este equipo (commit ${sha}): puedes editarlo; las novedades del autor llegan solo cuando las apruebas`,
  fromFolder: 'Instalado desde una carpeta de este equipo: tus cambios aplican al recargar',
  fileStatus: code => ({ M: 'modificado', A: 'agregado', D: 'borrado', '??': 'nuevo', R: 'renombrado' })[code === '??' ? '??' : code.charAt(0)] ?? code,
  patchAt: p => `Respaldo: ${p}`,
  explainChanges: 'Explicar mis cambios',
  askExplain: (label, dir) =>
    `Loadout: explícame en pocas líneas, para alguien que no programa, qué hacen mis cambios sin commitear al mod «${label}». Corre \`git -C ${dir} status\` y \`git -C ${dir} diff HEAD\` y léelos; no cambies nada.`,
  checking: 'Buscando actualizaciones…',
  upToDate: 'Todo está al día',
  updatesFound: n => (n === 1 ? '1 actualización disponible' : `${n} actualizaciones disponibles`),
  safeNote: 'Las versiones nuevas no corren hasta que las apruebes.',
  updating: 'Actualizándose con Claude…',
  pin: 'Fijar para conservar mis cambios',
  askSafeUpdate: (label, id, steps) =>
    `Loadout: actualiza el mod «${label}» (${id}) de forma segura. Sigue estos pasos en orden y DETENTE en el paso 2 si no es seguro.\n${steps}`,
  stepsFolder: (dir, behind, changed, patch, ref) =>
    [
      `1. Su código es una copia git fijada en ${dir}, ${behind} commits detrás de su autor. Muéstrame qué cambió: \`git -C ${dir} log --oneline HEAD..${ref}\` y el diff.`,
      '2. Audita el código nuevo como una revisión de seguridad: llamadas de red, comandos, escrituras fuera de su carpeta, lectura de secretos o variables de entorno, reescritura de prompts o herramientas, código ofuscado; corre `claude plugin validate`. Dame un veredicto con la evidencia.',
      changed > 0
        ? `3. Si es seguro, conserva mis cambios (${changed} archivos, respaldados en ${patch ?? 'la carpeta de parches'}): \`git -C ${dir} stash\`, ${ref === '@{u}' ? `\`git -C ${dir} merge --ff-only @{u}\`` : `\`git -C ${dir} checkout --detach ${ref}\``}, \`git -C ${dir} stash pop\`. Resuelve cualquier conflicto conservando la intención de mi cambio y lo nuevo del autor, y dime cómo.`
        : `3. Si es seguro: ${ref === '@{u}' ? `\`git -C ${dir} merge --ff-only @{u}\`` : `\`git -C ${dir} checkout --detach ${ref}\``}.`,
      '4. Corre `claude plugin validate` y `claude plugin test` (si tiene pruebas) sobre la carpeta del plugin hasta que pasen.',
      '5. Aprueba la versión nueva en ~/.claude/loadout/approved.json: `"<nombre del plugin>": { "version": "<versión de su plugin.json>", "by": "audit", "approvedAt": "<fecha ISO>" }`, sin borrar las demás entradas.',
      '6. Dime en pocas líneas qué cambió, tu veredicto, y que presione Recargar en Loadout.',
    ].join('\n'),
  stepsGithub: (id, dir, installed, latest, installPath) =>
    [
      `1. Está instalado en v${installed} desde un marketplace de GitHub; el marketplace (actualizado en ${dir}) ofrece v${latest}. Muéstrame qué cambió entre la copia instalada en ${installPath} y la nueva.`,
      '2. Audita el código nuevo como una revisión de seguridad: llamadas de red, comandos, escrituras fuera de su carpeta, lectura de secretos o variables de entorno, reescritura de prompts o herramientas, código ofuscado; corre `claude plugin validate`. Dame un veredicto con la evidencia.',
      `3. Si es seguro: \`claude plugin update ${id} --scope user\`.`,
      '4. Corre `claude plugin validate` sobre la copia actualizada.',
      `5. Aprueba v${latest} en ~/.claude/loadout/approved.json: \`"<nombre del plugin>": { "version": "${latest}", "by": "audit", "approvedAt": "<fecha ISO>" }\`, sin borrar las demás entradas.`,
      '6. Dime en pocas líneas qué cambió, tu veredicto, y que presione Recargar en Loadout.',
    ].join('\n'),
  askPin: (label, id, repo) =>
    `Loadout: fija el mod «${label}» (${id}) para poder modificarlo y seguir actualizándolo seguro. 1. Clona https://github.com/${repo} ` +
    'en ~/.claude/loadout/pinned/<nombre del repo> y cambia al commit instalado hoy (gitCommitSha en ~/.claude/plugins/installed_plugins.json). ' +
    '2. `claude plugin marketplace add` esa carpeta. 3. Desinstala la copia actual e instala el mismo plugin desde el marketplace nuevo con `--scope user`. ' +
    '4. Corre `claude plugin validate`. 5. Dime que presione Recargar en Loadout. Su aprobación en ~/.claude/loadout/approved.json se queda igual.',
  blocked: n => (n === 1 ? '1 mod bloqueado' : `${n} mods bloqueados`),
  blockedToast: name => `Loadout bloqueó «${name}»: aún no está auditado. Abre Loadout para auditarlo.`,
  pendingAudit: 'Esperando auditoría: su código no ha corrido',
  auditNow: 'Auditar con Claude',
  allowAnyway: 'Permitir sin auditar',
  approvedReload: 'Aprobado · recargando',
  askAudit: (name, version, root) =>
    `Loadout bloqueó el mod «${name}» v${version} (${root}) porque no está auditado. Audítalo ahora: lee todos los archivos de su ` +
    'módulo de hooks, corre `claude plugin validate` y revisa llamadas de red, comandos, escrituras fuera de su carpeta, lectura de ' +
    'secretos o variables de entorno, reescritura de prompts o de herramientas, y código ofuscado. Dame un veredicto claro con la ' +
    `evidencia. Solo si es seguro, agrégalo a ~/.claude/loadout/approved.json como "${name}": { "version": "${version}", "by": "audit", ` +
    '"approvedAt": <fecha ISO> } (sin borrar las demás entradas), anótalo en ~/.claude/loadout/audit-log.txt y dime que presione ' +
    'Recargar en Loadout.',
  askUpdate: (label, id) =>
    `Loadout: revisa si el mod «${label}» (${id}) tiene una versión nueva en su marketplace o repositorio. Si la hay, ` +
    'audítala como una revisión de seguridad (claude plugin validate + revisión manual de llamadas de red, comandos, escrituras, ' +
    'secretos, reescrituras y código ofuscado) y solo si pasa actualízala y apruébala en ~/.claude/loadout/approved.json. ' +
    'Si no hay versión nueva, dímelo en una línea.',
}

export type Words = typeof EN

export const words = (lang: Lang): Words => (lang === 'es' ? ES : EN)

/** Claude Code's `language` setting, then LANG/LC_ALL; English otherwise. An explicit 'en' or 'es' first wins (tests). */
export function pickLang(option: unknown, settingsLanguage: unknown, locale: string | null): Lang {
  if (option === 'en' || option === 'es') return option
  const s = typeof settingsLanguage === 'string' ? settingsLanguage.toLowerCase() : ''
  if (s) return s.startsWith('es') || s.startsWith('span') || s.startsWith('espa') ? 'es' : 'en'
  return (locale ?? '').toLowerCase().startsWith('es') ? 'es' : 'en'
}
