# ⚔ Loadout — Mod Manager for Claude Code

**Loadout is a mod manager for Claude Code: install, update and manage your plugins and mods without running code nobody
reviewed.** Loadout puts an audit gate in front of
every mod: a new mod, or a new version of one you already trust, stays blocked until Claude reviews its code and you
approve it. It tells you when updates are out, audits them before they install, and keeps the changes you made yourself.
All of it from one inventory panel inside Claude Code.

[![Claude Code plugin](https://img.shields.io/badge/Claude%20Code-plugin-d9730d)](#install)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
![macOS · Linux · Windows](https://img.shields.io/badge/macOS%20%C2%B7%20Linux%20%C2%B7%20Windows-supported-555)
![Uses no tokens of its own](https://img.shields.io/badge/tokens%20of%20its%20own-0-2ea043)

<p align="center">
  <img src="docs/inventory.svg" alt="Loadout inventory panel in Claude Code: a Legendary card in orange, an Epic card in purple, a Rare card in blue and a Poor (off) card in grey" width="600">
</p>

```
/plugin install loadout --marketplace Br4inergy/claude-loadout
```

## Why Loadout

Claude Code mods are code that runs on your machine with your permissions. They can run commands, write files, reach the
network and send prompts to the model. An update can change any of that overnight. Loadout makes sure you know what you are
running before it runs.

### 1. 🛡 Every mod is audited before it can run

A mod whose name and version you have not approved **never loads**. Loadout shows it as held and offers **Audit with
Claude**: Claude reads the mod's code and gives you a verdict with evidence. You approve it, or you leave it
off. You can also choose **Allow without audit**, and every block is written to a log.

### 2. 🔄 Updates are audited too, not just installs

Loadout checks for new versions on its own: the marketplace version for a GitHub install, or the author's new commits
for a copy you pinned. **Audit & update** has Claude review *what changed* before the new version installs. A new
version is treated like a new mod, so a trusted plugin can't quietly turn into something else.

### 3. ✍️ Your own changes survive updates

Tweaked a mod to fit your setup? Loadout backs up your changes and puts them back when the author's update lands.
**Pin** turns a marketplace install into a git copy on your computer that you can edit, and **Explain my changes** has
Claude walk you through what you changed.

### 4. 🔍 See what each mod's code can really do

Loadout reads each mod's code with `claude plugin validate`, not its description, and shows what it can do:
`+runs commands`, `+writes files`, `+network`, `+sends prompts`, `+calls the model`, `+adds tools`, `+watches tool calls`,
`+edits the system prompt`, `+own panel`. The risky ones are highlighted, and each card's [rarity colour](#rarity) tells
you at a glance how much power a mod has.

### 5. 🎒 One inventory for everything

Every mod and plugin you have, in one panel: equip or unequip with one switch, see the version, where it came from and
what it spent on the model this session, open its panel, or uninstall it. Mods that draw a band above the prompt show
under Loadout's, and you can show or hide each one.

**Loadout uses no tokens of its own.** Audits and updates are Claude turns that start only when you press a button.

## Install

```
/plugin install loadout --marketplace Br4inergy/claude-loadout
```

Then press **⚙ Loadout** in the band above the prompt, or type `/loadout`. It needs Claude Code 2.1.275 or later
(mods with hooks modules).

## How it works

1. **Install a mod** the way you always do. Loadout sees it and holds it before its code loads.
2. **Press Audit with Claude.** Claude reviews the code and gives you a verdict with evidence.
3. **Approve it.** Loadout records the name and version in `~/.claude/loadout/approved.json` and the mod loads.
4. **When an update is out**, Loadout tells you. **Audit & update** reviews the change, installs it and keeps your own
   edits.

Each card shows only what the mod itself says: its name, the description from its own `plugin.json` and what its code
can do. Loadout keeps no hand-written list of mods, so it works the same for any mod, yours or anyone else's.

## Your own mods: trusted folders

Mods you write yourself don't need to wait for an audit on every version. List the folders they live in, in
`~/.claude/loadout/trusted.json`:

```json
{ "folders": ["/Users/you/code/my-mods"] }
```

A mod loaded from inside one of those folders (a folder marketplace on your computer) runs in any version, without an
audit. Only absolute paths count, and Loadout never writes this file: you do. Mods from anywhere else still go through
the gate, even if they share a name with one of yours.

## FAQ

**Is it safe to install Claude Code plugins from GitHub or a marketplace?**
A plugin can run code on your machine, so it is only as safe as its code. Loadout keeps any mod you have not approved
from loading and lets Claude audit the code first, so you decide with evidence instead of trusting a description.

**How do I audit a Claude Code plugin before installing it?**
Install Loadout, then install the plugin. Loadout holds it and offers **Audit with Claude**, which reviews the code and
gives a verdict before anything runs.

**What happens when a plugin I trust gets an update?**
The new version is held like a new mod. Loadout tells you it is there, and **Audit & update** reviews the change before
it installs.

**Will an update erase the changes I made to a mod?**
No. Loadout backs up your changes and puts them back after the update.

**Does Loadout cost tokens?**
Not by itself. Only the audits and updates you start with a button use Claude.

**Does it work with plain plugins (skills, commands, MCP servers)?**
They show in the inventory with their details and can be turned on, off or uninstalled. The audit gate covers mods,
which are plugins with code that runs inside Claude Code.

## Rarity

Each card's colour tells you, at a glance, how much the mod can do. It is worked out from each mod's own code, so it
works the same for any mod, yours or anyone else's:

| Rarity | Colour | When |
| --- | --- | --- |
| Stored | grey | Turned off, kept in the inventory |
| Common | white | A plain plugin (skills, commands, MCP servers): the audit gate does not cover it |
| Enhanced | green | A mod: it passed the audit gate to load |
| Rare | blue | Its code draws a panel of its own |
| Epic | purple | Its code runs commands on your machine |
| Legendary | orange | Loadout itself |

A mod that is turned off is always Poor. Otherwise the highest rarity that applies wins: a mod that runs commands and
also has a panel is Epic. Epic and Legendary cards get a double border. The colours come from Claude
Code's theme, so they read in both light and dark mode.

## Files

All under `~/.claude/loadout/`:

| File | What it holds |
| --- | --- |
| `approved.json` | The mods and versions you approved: `"name": { "version", "by": "audit" \| "manual", "approvedAt" }` |
| `blocked.log` | Every time the gate held a mod back |
| `audit-log.txt` | One line per audit Claude did for you, with its verdict |
| `patches/` | Backups of your own changes to pinned mods |
| `pinned/` | Local clones made by **Pin** |

## Language

Loadout speaks English or Spanish and follows Claude Code's language setting, then your system's locale. There is
nothing to configure. Works on macOS, Linux and Windows (it reads `HOME`, or `USERPROFILE` on Windows). Rarities read
"Epic Mod" in English and "Mod Épico" in Spanish.

## Development

```
claude plugin validate <loadout folder>
claude plugin test <loadout folder>
```

`hooks/catalogo.ts` (the rows, capabilities and rarity), `hooks/gate.ts` (the audit gate), `hooks/updates.ts` (version
checks), `hooks/bandas.ts` (bands above the prompt) and `hooks/pricing.ts` are pure functions, tested in `tests/`.
`hooks/register.tsx` connects them to the panel, the band and the disk.

## License

MIT. See [LICENSE](LICENSE).
