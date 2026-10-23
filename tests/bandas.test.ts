// Each other mod's band, shown or hidden on its own: `claude plugin test <mod folder>`.
import { expect, mock, test } from 'claude-code/testing'

import { aboutFolds } from '../hooks/about'
import { buttonsOnly, mergeSeen, splitBands } from '../hooks/bandas'

const row = (text: string) => ({ type: 'Text', children: [text] })
const nest = (own: unknown, below: unknown) => ({ type: 'Box', props: { flexDirection: 'column' }, children: [own, below] })

test('pure logic: a mod that nests the bands beneath gets its own row only, every band apart', () => {
  const c = row('cuota-band')
  const b = nest(row('brujula-band'), c)
  const a = nest(row('aduana-band'), b)
  const { bands, rest } = splitBands([
    { index: 0, plugin: 'aduana', returned: a },
    { index: 1, plugin: 'brujula', returned: b },
    { index: 2, plugin: 'cuota', returned: c },
    { index: 3, plugin: 'engine', returned: { type: 'engine', ref: 0 } },
  ])
  expect(bands.map(x => x.plugin)).toEqual(['aduana', 'brujula', 'cuota'])
  expect(JSON.stringify(bands[0]?.tree)).toContain('aduana-band')
  expect(JSON.stringify(bands[0]?.tree)).not.toContain('brujula-band')
  expect(JSON.stringify(bands[1]?.tree)).not.toContain('cuota-band')
  expect(JSON.stringify(bands)).not.toContain('"engine"')
  expect(rest).toBe(null)
})

test('pure logic: a mod that only passes draws nothing; Loadout itself and the placeholder never count', () => {
  const c = row('cuota-band')
  const { bands } = splitBands([
    { index: 0, plugin: 'loadout', returned: nest(row('lo'), c) },
    { index: 1, plugin: 'quiet', returned: c },
    { index: 2, plugin: 'cuota', returned: c },
    { index: 3, plugin: 'engine', returned: { type: 'engine', ref: 0 } },
  ])
  expect(bands.map(x => x.plugin)).toEqual(['cuota'])
  // A mod that nests only the placeholder (nothing beneath drew) keeps its own row.
  const alone = splitBands([
    { index: 0, plugin: 'brujula', returned: nest(row('brujula-band'), { type: 'engine', ref: 0 }) },
    { index: 1, plugin: 'engine', returned: { type: 'engine', ref: 0 } },
  ])
  expect(alone.bands.map(x => x.plugin)).toEqual(['brujula'])
  expect(JSON.stringify(alone.bands[0]?.tree)).not.toContain('"engine"')
})

test('pure logic: a mod that hides the ones beneath is still its own band', () => {
  const { bands } = splitBands([
    { index: 0, plugin: 'solo', returned: row('solo-band') },
    { index: 1, plugin: 'engine', returned: undefined },
  ])
  expect(bands.map(x => x.plugin)).toEqual(['solo'])
  expect(mergeSeen(['a', 'b'], ['b', 'c'])).toEqual(['a', 'b', 'c'])
})

const BAND = {
  plugin: 'loadout',
  component: 'AbovePrompt',
  requestId: 'band',
  props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 160, scroll: { offset: 0, bodyRows: 6 }, view: {} },
} as const

const PANE = {
  plugin: 'loadout',
  component: 'Pane',
  requestId: 'loadout',
  props: { title: 'Loadout', isFocused: true, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

test('the panel lists each band that drew, and hiding one leaves the others (and keeps it hidden)', async ($, on) => {
  const clock = mock.clock(on)
  const store = new Map<string, unknown>()
  on('session.start', ($, e) => ({ cwd: e.cwd }) as never)
  on('command.register', () => ({ value: undefined }) as never)
  on('command.list', () => ({ value: [] }) as never)
  on('store.get', ($, e) => ({ value: store.get((e as { key: string }).key) }) as never)
  on('store.set', ($, e) => {
    store.set((e as { key: string }).key, (e as { value: unknown }).value)
    return { value: undefined } as never
  })
  on('store.delete', () => ({ value: undefined }) as never)
  on('ui.render', { component: 'AbovePrompt' }, () => row('other-band') as never)
  await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true } as never)
  for (const surface of ['terminal', 'desktop'] as const) {
    const band = await $.ui.mount({ ...BAND, surface })
    expect(JSON.stringify(await band.drawn())).toContain('other-band')
    await clock.advance(1)
    const pane = await $.ui.mount({ ...PANE, surface })
    expect(JSON.stringify(await pane.find({ key: 'band-test' }))).toContain('●')
    await pane.press({ key: 'band-test' })
    expect(JSON.stringify(await pane.find({ key: 'band-test' }))).toContain('○')
    expect(JSON.stringify(await band.drawn())).not.toContain('other-band')
    expect(JSON.stringify(await band.drawn())).toContain('⚙ Loadout')
    expect(store.get('hiddenBands')).toEqual(['test'])
    await pane.press({ key: 'band-test' })
    expect(JSON.stringify(await band.drawn())).toContain('other-band')
    await pane.unmount()
    await band.unmount()
  }
})

test('pure logic: the ▸ shows only when the description would be cut, never when the width is unknown', () => {
  expect(aboutFolds('Corto', 40)).toBe(false)
  expect(aboutFolds('x'.repeat(38), 40)).toBe(false)
  expect(aboutFolds('x'.repeat(39), 40)).toBe(true)
  expect(aboutFolds('x'.repeat(500), null)).toBe(false)
})

test('pure logic: a band of only buttons joins the Loadout row; anything else keeps its own row', () => {
  const btn = { type: 'Button', props: { label: '◉ Bob' } }
  expect(buttonsOnly({ type: 'Box', props: { flexDirection: 'column' }, children: [{ type: 'Box', children: [btn] }] })).toEqual([btn])
  expect(buttonsOnly(btn)).toEqual([btn])
  expect(buttonsOnly({ type: 'Box', children: [btn, row('text')] })).toBe(null)
  expect(buttonsOnly({ type: 'Box', children: [] })).toBe(null)
  expect(buttonsOnly(row('only text'))).toBe(null)
  expect(buttonsOnly('text')).toBe(null)
})

test('a mod whose band is only a button draws it on the Loadout row, and pressing it still reaches that mod', async ($, on) => {
  let pressed = 0
  mock.clock(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }) as never)
  on('command.register', () => ({ value: undefined }) as never)
  on('command.list', () => ({ value: [] }) as never)
  on('store.get', () => ({ value: undefined }) as never)
  on('store.set', () => ({ value: undefined }) as never)
  on('store.delete', () => ({ value: undefined }) as never)
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box, Button } = $.ui.resolve(e)
    return Box({ children: [Button({ key: 'x-open', label: '◉ Bob', onPress: () => void pressed++ })] }) as never
  })
  await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true } as never)
  for (const surface of ['terminal', 'desktop'] as const) {
    const band = await $.ui.mount({ ...BAND, surface })
    const loRow = JSON.stringify(await band.find({ key: 'lo-row' }))
    expect(loRow).toContain('◉ Bob')
    expect(loRow).toContain('⚙ Loadout')
    await band.press({ key: 'x-open', plugin: 'test' })
    await band.unmount()
  }
  expect(pressed).toBe(2)
})
