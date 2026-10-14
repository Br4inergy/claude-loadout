# ⚔ Loadout

**Your Claude Code mods, as an RPG inventory.** Loadout lists every mod and plugin you have installed, shows what each
one's code can actually do, and keeps code you have not reviewed from running. A new mod or a new version stays blocked
until you approve it, usually after Claude audits it for you.

<p align="center">
  <img src="docs/inventory.svg" alt="Loadout inventory: a Legendary card in orange, an Epic card in purple, a Rare card in blue and a Poor (off) card in grey" width="600">
</p>

## Install

```
/plugin install loadout --marketplace Br4inergy/claude-loadout
```

Then press **⚙ Loadout** in the band above the prompt, or type `/loadout`. It needs Claude Code 2.1.275 or later
(mods with hooks modules).

## What it does

- **Inventory panel.** Every mod and plugin you have installed, with an Equip / Equipped switch, its version, where it
  was installed from (a marketplace, or a folder or git copy on your computer), its own description (from its
  `plugin.json`, folded into one line you can unfold), what its code can do, what
  it spent on the model this session, and Uninstall (it asks you to confirm).
- **Nothing hand-written.** Each card shows the plugin's own name and the description from its own `plugin.json`,
  exactly what its author wrote. Loadout keeps no list of mods it knows: everything on a card is read from the mod.
  **Open ↗** appears for a mod whose code draws a panel, and runs the command that mod added (the one named like the
  mod, or its only one).
- **What the code can do**, read from the code itself with `claude plugin validate`, not taken from the mod's own
  description: `+runs commands`, `+writes files`, `+network`, `+sends prompts`, `+calls the model`, `+adds tools`,
  `+watches tool calls`, `+edits the system prompt`, `+own panel`. The risky ones are highlighted.
- **Audit gate.** A mod whose name and version you have not approved never loads. Loadout shows it as held, with
  **Audit with Claude**, which asks Claude to review the code and give a verdict with evidence, and **Allow without
  audit**. Every block is logged.
- **Safe updates.** It checks for new versions (the author's new commits for a pinned clone, the marketplace version
  for a GitHub install). **Audit & update** has Claude review the change before installing it. If you changed a mod
  yourself, Loadout backs up your changes and keeps them when the author's update lands. **Pin** turns a marketplace install
  into a git copy on your computer that you can edit. Your own changes unfold into the list of files, with an
  **Explain my changes** button.
- **Bands above the prompt.** Mods that draw a band above the prompt show under Loadout's own band, and you can show or
  hide each one.

Loadout uses no tokens of its own. Audits and updates are Claude turns that you start with a button.

## Rarity

Each card's colour tells you, at a glance, how much the mod can do. It is worked out from each mod's own code, so it
works the same for any mod, yours or anyone else's:

| Rarity | Colour | When |
| --- | --- | --- |
| Poor | grey | Turned off |
| Common | white | A plain plugin (skills, commands, MCP servers): the audit gate does not cover it |
| Uncommon | green | A mod: it passed the audit gate to load |
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
