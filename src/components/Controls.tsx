import type { T } from '../i18n'
import { N } from '../i18n'
import type { BoxParams, LidType } from '../lib/types'
import { DEFAULT_STATE, type AppState, type Lang, type Settings, type SheetSettings, type Theme } from '../state'
import type { DxfMode } from '../lib/exportDxf'
import NumberField from './NumberField'

type Props = {
  state: AppState
  t: T
  onParams: (p: BoxParams) => void
  onSheet: (s: SheetSettings) => void
  onSettings: (s: Settings) => void
}

const PRESETS: { label: string; params: Partial<BoxParams> }[] = [
  { label: N('Storage box'), params: {} },
  { label: N('Pencil box'), params: { dimMode: 'inner', width: 190, depth: 55, height: 30, lid: 'sliding', dividersAcross: 0, dividersAlong: 0 } },
  { label: N('Tray with dividers'), params: { dimMode: 'inner', width: 160, depth: 100, height: 35, lid: 'none', dividersAcross: 1, dividersAlong: 2 } },
  { label: N('Hinged jewellery box'), params: { dimMode: 'inner', width: 90, depth: 60, height: 30, lid: 'hinged', label: 'Jewels', labelOn: 'lid' } },
  { label: N('Round trinket box'), params: { style: 'rounded', dimMode: 'outer', width: 90, depth: 90, height: 45, cornerRadius: 20, lid: 'lift-off' } },
]

const LIDS: [LidType, string][] = [
  ['none', N('None (open top)')],
  ['closed', N('Closed (fixed top)')],
  ['lift-off', N('Lift-off lid')],
  ['hinged', N('Hinged (living hinge)')],
  ['sliding', N('Sliding lid')],
]

export default function Controls({ state, t, onParams, onSheet, onSettings }: Props) {
  const { params: p, sheet: sh, settings } = state
  const set = <K extends keyof BoxParams>(k: K, v: BoxParams[K]) => onParams({ ...p, [k]: v })
  const setSheet = <K extends keyof SheetSettings>(k: K, v: SheetSettings[K]) => onSheet({ ...sh, [k]: v })
  const setSet = <K extends keyof Settings>(k: K, v: Settings[K]) => onSettings({ ...settings, [k]: v })
  const rounded = p.style === 'rounded'
  const mm = (s: string) => `${t(s)}, ${t('mm')}`
  const lids = rounded ? LIDS.filter(([k]) => k === 'none' || k === 'lift-off') : LIDS
  const lid = rounded && p.lid !== 'none' && p.lid !== 'lift-off' ? 'none' : p.lid

  return (
    <>
      <section className="section">
        <h3>{t('Presets')}</h3>
        <div className="row">
          {PRESETS.map((pr) => (
            <button key={pr.label} className="small" onClick={() => onParams({ ...DEFAULT_STATE.params, ...pr.params })}>
              {t(pr.label)}
            </button>
          ))}
        </div>
      </section>

      <section className="section">
        <h3>{t('Box')}</h3>
        <div className="grid2">
          <label className="field">
            <span>{t('Style')}</span>
            <select value={p.style} onChange={(e) => set('style', e.target.value as BoxParams['style'])}>
              <option value="finger">{t('Finger-joint box')}</option>
              <option value="rounded">{t('Rounded box, living hinge sides')}</option>
            </select>
          </label>
          <label className="field">
            <span>{t('Dimensions are')}</span>
            <select value={p.dimMode} onChange={(e) => set('dimMode', e.target.value as BoxParams['dimMode'])}>
              <option value="inner">{t('Inner (usable space)')}</option>
              <option value="outer">{t('Outer (finished size)')}</option>
            </select>
          </label>
        </div>
        <div className="grid3">
          <NumberField label={mm('Width')} value={p.width} onChange={(v) => set('width', v)} />
          <NumberField label={mm('Depth')} value={p.depth} onChange={(v) => set('depth', v)} />
          <NumberField label={mm('Height')} value={p.height} onChange={(v) => set('height', v)} />
        </div>
        <div className="grid2">
          <NumberField label={mm('Material thickness')} value={p.thickness} onChange={(v) => set('thickness', v)} />
          <NumberField label={mm('Kerf')} value={p.kerf} min={0} onChange={(v) => set('kerf', v)} />
        </div>
        <p className="hint">{t('Kerf is the width the laser burns away. Cut paths are offset by half of it so joints fit tightly.')}</p>
      </section>

      <section className="section">
        <h3>{t('Lid')}</h3>
        <label className="field">
          <span>{t('Lid type')}</span>
          <select value={lid} onChange={(e) => set('lid', e.target.value as LidType)}>
            {lids.map(([k, label]) => (
              <option key={k} value={k}>
                {t(label)}
              </option>
            ))}
          </select>
        </label>
        {lid !== 'none' && lid !== 'closed' && <NumberField label={mm('Lid clearance')} value={p.lidClearance} onChange={(v) => set('lidClearance', v)} />}
        {!rounded && lid === 'hinged' && <NumberField label={mm('Hinge strip width')} value={p.hingeWidth} min={1} onChange={(v) => set('hingeWidth', v)} />}
      </section>

      <section className="section">
        <h3>{t('Finger joints')}</h3>
        <label className="check">
          <input type="checkbox" checked={p.fingerAuto} onChange={(e) => set('fingerAuto', e.target.checked)} />
          {t('Automatic finger width')}
        </label>
        {!p.fingerAuto && <NumberField label={mm('Finger width')} value={p.fingerWidth} min={0.1} onChange={(v) => set('fingerWidth', v)} />}
        <p className="hint">{t('The width is adjusted per edge so every edge gets an odd number of equal fingers.')}</p>
      </section>

      {!rounded && (
        <section className="section">
          <h3>{t('Dividers')}</h3>
          <div className="grid2">
            <NumberField label={t('Across (parallel to front)')} value={p.dividersAcross} step={1} onChange={(v) => set('dividersAcross', Math.round(v))} />
            <NumberField label={t('Along (parallel to sides)')} value={p.dividersAlong} step={1} onChange={(v) => set('dividersAlong', Math.round(v))} />
          </div>
        </section>
      )}

      {rounded && (
        <section className="section">
          <h3>{t('Living hinge')}</h3>
          <NumberField label={mm('Outer corner radius')} value={p.cornerRadius} onChange={(v) => set('cornerRadius', v)} />
          <div className="grid3">
            <NumberField label={mm('Line spacing')} value={p.hingeSpacing} min={0.2} onChange={(v) => set('hingeSpacing', v)} />
            <NumberField label={mm('Slit length')} value={p.hingeSlit} min={1} onChange={(v) => set('hingeSlit', v)} />
            <NumberField label={mm('Bridge')} value={p.hingeBridge} min={0.5} onChange={(v) => set('hingeBridge', v)} />
          </div>
          <p className="hint">{t('Straight slits parallel to the bend, staggered row by row. Smaller spacing bends more easily.')}</p>
        </section>
      )}
      {!rounded && lid === 'hinged' && (
        <section className="section">
          <h3>{t('Living hinge')}</h3>
          <div className="grid3">
            <NumberField label={mm('Line spacing')} value={p.hingeSpacing} min={0.2} onChange={(v) => set('hingeSpacing', v)} />
            <NumberField label={mm('Slit length')} value={p.hingeSlit} min={1} onChange={(v) => set('hingeSlit', v)} />
            <NumberField label={mm('Bridge')} value={p.hingeBridge} min={0.5} onChange={(v) => set('hingeBridge', v)} />
          </div>
        </section>
      )}

      <section className="section">
        <h3>{t('Engraving')}</h3>
        <label className="field">
          <span>{t('Label text')}</span>
          <input type="text" value={p.label} maxLength={40} onChange={(e) => set('label', e.target.value)} />
        </label>
        <div className="grid2">
          <NumberField label={mm('Letter height')} value={p.labelSize} min={2} onChange={(v) => set('labelSize', v)} />
          <label className="field">
            <span>{t('Place on')}</span>
            <select value={p.labelOn} onChange={(e) => set('labelOn', e.target.value as BoxParams['labelOn'])}>
              <option value="front">{t('Front')}</option>
              <option value="lid">{t('Lid')}</option>
            </select>
          </label>
        </div>
      </section>

      <section className="section">
        <h3>{t('Sheet')}</h3>
        <div className="grid2">
          <NumberField label={mm('Sheet width')} value={sh.sheetW} min={10} onChange={(v) => setSheet('sheetW', v)} />
          <NumberField label={mm('Sheet height')} value={sh.sheetH} min={10} onChange={(v) => setSheet('sheetH', v)} />
          <NumberField label={mm('Spacing between parts')} value={sh.spacing} min={0} onChange={(v) => setSheet('spacing', v)} />
          <NumberField label={mm('Sheet margin')} value={sh.margin} min={0} onChange={(v) => setSheet('margin', v)} />
        </div>
        <label className="check">
          <input type="checkbox" checked={sh.allowRotate} onChange={(e) => setSheet('allowRotate', e.target.checked)} />
          {t('Allow turning parts by 90°')}
        </label>
      </section>

      <section className="section">
        <h3>{t('Settings')}</h3>
        <div className="grid2">
          <label className="field">
            <span>{t('Language')}</span>
            <select value={settings.lang} onChange={(e) => setSet('lang', e.target.value as Lang)}>
              <option value="en">English</option>
              <option value="uk">Українська</option>
            </select>
          </label>
          <label className="field">
            <span>{t('Theme')}</span>
            <select value={settings.theme} onChange={(e) => setSet('theme', e.target.value as Theme)}>
              <option value="auto">{t('System')}</option>
              <option value="light">{t('Light')}</option>
              <option value="dark">{t('Dark')}</option>
            </select>
          </label>
        </div>
        <label className="field">
          <span>{t('DXF format')}</span>
          <select value={settings.dxfMode} onChange={(e) => setSet('dxfMode', e.target.value as DxfMode)}>
            <option value="lines">{t('R12, LINE entities (most compatible)')}</option>
            <option value="lwpolyline">{t('LWPOLYLINE contours (joined paths)')}</option>
          </select>
        </label>
      </section>
    </>
  )
}
