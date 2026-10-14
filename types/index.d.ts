// Loadout's state contract.

/** What a mod's code can do, read from `claude plugin validate`. */
export type Cap = 'cmd' | 'write' | 'net' | 'prompt' | 'model' | 'tools' | 'gate' | 'system' | 'pane'

/** One installed mod or plugin as the panel shows it. */
export type ModRow = {
  id: string
  /** Where it was installed from: a marketplace on GitHub, a folder (a git copy or not) on this computer, or other. */
  origin?: { kind: 'github' | 'folder' | 'other'; repo: string | null }
  label: string
  enabled: boolean
  /** true when it ships function hooks (a mod with UI), false for a classic plugin. */
  isMod: boolean
  builtin: boolean
  version: string
  /** What it does, one line. */
  about: string
  /** Glyph drawn beside its name. */
  icon: string
  /** Where its code lives (for the capability scan). */
  path: string | null
  /** Pinned commit, short. */
  pin: string | null
}

/** What a mod spent on the model in this session (its own `$.model` calls). */
export type Spend = { calls: number; tokens: number; usd: number }

/** What Loadout knows about one mod's updates and your own changes to it. */
export type UpdateInfo = {
  source: 'folder' | 'github' | 'other'
  /** Commits the author pushed past the pinned one (a folder that is a git clone). */
  behind: number
  /** A newer version in the marketplace (a GitHub marketplace). */
  latest: string | null
  /** Files you changed in a pinned clone: kept and re-applied on update. */
  changed: number
  /** Your changed files in a pinned clone, from git status. */
  files: { status: string; path: string }[]
  /** Where your changes are backed up as a patch, when there are any. */
  patch: string | null
  /** The pinned clone's folder, or the refreshed marketplace's. */
  dir: string | null
  /** The author's ref a pinned clone is compared with: its upstream branch, or origin/HEAD for a detached pin. */
  ref: string | null
  /** An audited update was asked of Claude and has not been checked again yet. */
  requested?: boolean
  /** owner/name of its GitHub repository, when it comes from one. */
  repo: string | null
}

/** A mod the audit gate kept from loading. */
export type Blocked = { name: string; version: string; root: string; caps: Cap[] }

/** One approved mod in ~/.claude/loadout/approved.json. */
export type Approval = { version: string; by: 'audit' | 'manual'; approvedAt: string }

declare module 'claude-code' {
  interface PluginState {
    loadout: {
      mods: ModRow[]
      /** Commands in this session and the plugin that added each. */
      commands: { name: string; plugin?: string }[]
      /** Id of the mod waiting for a second click to uninstall. */
      confirm: string | null
      /** Id of the mod whose card shows its extra actions. */
      expanded: string | null
      /** The card whose long description is unfolded. */
      aboutOpen: string | null
      /** The card whose list of your changes is unfolded. */
      changesOpen: string | null
      /** Id of the mod with an action running. */
      busy: string | null
      /** Which list the panel shows. */
      tab: 'mods' | 'plugins'
      /** Capabilities per mod id. */
      caps: Record<string, Cap[]>
      /** Whether the Loadout panel is open (lights its button). */
      paneUp: boolean
      /** Mods the audit gate kept from loading. */
      blocked: Blocked[]
      /** The mods seen drawing a band of their own, in the order first seen. */
      bands: string[]
      /** The mods whose band you hid. */
      hiddenBands: string[]
      /** Model spend per plugin name, this session. */
      spend: Record<string, Spend>
      /** Updates and your own changes, per plugin id. */
      updates: Record<string, UpdateInfo>
      /** Whether an update check is running. */
      checking: boolean
    }
  }
}
