import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { tr, type T } from './i18n'
import { downloadText } from './download'
import { buildBox, checkParams } from './lib/box'
import { sheetToDxf } from './lib/exportDxf'
import { sheetToSvg } from './lib/exportSvg'
import { layoutParts } from './lib/layout'
import { loadState, saveState, type AppState } from './state'
import Controls from './components/Controls'
import SheetView from './components/SheetView'

const Preview3D = lazy(() => import('./components/Preview3D'))

const fmt = (n: number) => String(+n.toFixed(2))

export default function App() {
  const [state, setState] = useState<AppState>(loadState)
  const [tab, setTab] = useState<'sheet' | '3d'>('sheet')
  const [sheetIdx, setSheetIdx] = useState(0)
  const [explode, setExplode] = useState(0)
  const { params, sheet, settings } = state
  const t: T = useMemo(() => (s, ...a) => tr(settings.lang, s, ...a), [settings.lang])

  useEffect(() => saveState(state), [state])
  useEffect(() => {
    const root = document.documentElement
    if (settings.theme === 'auto') delete root.dataset.theme
    else root.dataset.theme = settings.theme
    root.lang = settings.lang
    document.title = tr(settings.lang, 'Laser-cut box generator: finger-joint boxes as SVG and DXF')
  }, [settings.theme, settings.lang])

  const checked = useMemo(() => checkParams(params), [params])
  const sheetOk = Number.isFinite(sheet.sheetW) && Number.isFinite(sheet.sheetH) && Number.isFinite(sheet.spacing) && Number.isFinite(sheet.margin) && sheet.sheetW > 0 && sheet.sheetH > 0 && sheet.spacing >= 0 && sheet.margin >= 0
  const model = useMemo(() => (checked.errors.length === 0 ? buildBox(params) : null), [params, checked])
  const layout = useMemo(() => (model && sheetOk ? layoutParts(model.parts, sheet) : null), [model, sheet, sheetOk])

  const update = (patch: Partial<AppState>) => setState((s) => ({ ...s, ...patch }))
  const nSheets = layout?.sheets.length ?? 1
  const idx = Math.min(sheetIdx, nSheets - 1)
  const placed = useMemo(() => layout?.sheets[idx] ?? [], [layout, idx])
  const errors = [...checked.errors, ...(sheetOk ? [] : [['Sheet size, spacing and margin must be valid numbers.'] as [string]])]
  const warnings = [...checked.warnings, ...(model?.warnings.filter((w) => !checked.warnings.some((c) => c[0] === w)).map((w) => [w] as [string]) ?? [])]
  const msg = (m: [string, ...(string | number)[]]) => t(m[0], ...m.slice(1))

  const name = `box-${fmt(model?.dims.W ?? 0)}x${fmt(model?.dims.D ?? 0)}x${fmt(model?.dims.H ?? 0)}${nSheets > 1 ? `-sheet${idx + 1}` : ''}`
  const exportSvg = () => downloadText(`${name}.svg`, sheetToSvg(placed, sheet.sheetW, sheet.sheetH), 'image/svg+xml')
  const exportDxf = () => downloadText(`${name}.dxf`, sheetToDxf(placed, sheet.sheetW, sheet.sheetH, settings.dxfMode), 'application/dxf')
  const d = model?.dims
  const partsOnSheet = placed.length
  const totalCut = useMemo(() => {
    if (!layout) return 0
    let len = 0
    for (const p of placed) for (const c of [p.part.outline, ...p.part.holes]) for (let i = 0; i < c.length; i++) len += Math.hypot(c[(i + 1) % c.length][0] - c[i][0], c[(i + 1) % c.length][1] - c[i][1])
    return len
  }, [layout, placed])

  return (
    <div className="app">
      <header className="toolbar">
        <span className="brand">{t('Laser-cut box generator')}</span>
        <span className="hint">{t('Finger-joint and living-hinge boxes for the laser cutter. Exports SVG and DXF.')}</span>
      </header>
      <div className="body">
        <aside className="side">
          <div className="panel">
            <Controls state={state} t={t} onParams={(p) => update({ params: p })} onSheet={(s) => update({ sheet: s })} onSettings={(s) => update({ settings: s })} />
          </div>
        </aside>
        <main className="main">
          <div className="box">
            {d && (
              <p className="summary">
                <strong>{t('Outer')}</strong> {fmt(d.W)} × {fmt(d.D)} × {fmt(d.H)} {t('mm')} · <strong>{t('Inner')}</strong> {fmt(d.Win)} × {fmt(d.Din)} × {fmt(d.Hin)} {t('mm')}
              </p>
            )}
            {errors.map((e, i) => (
              <p key={i} className="err-text" role="alert">
                {msg(e)}
              </p>
            ))}
            {warnings.map((w, i) => (
              <p key={i} className="warn-text">
                {msg(w)}
              </p>
            ))}
            {layout && layout.oversize.length > 0 && <p className="warn-text">{t('Some parts are larger than the sheet: {0}', layout.oversize.length)}</p>}
            <div className="row tabs" role="tablist">
              <button role="tab" aria-selected={tab === 'sheet'} className={tab === 'sheet' ? 'tab on' : 'tab'} onClick={() => setTab('sheet')}>
                {t('Sheet layout')}
              </button>
              <button role="tab" aria-selected={tab === '3d'} className={tab === '3d' ? 'tab on' : 'tab'} onClick={() => setTab('3d')}>
                {t('3D preview')}
              </button>
              <span className="spacer" />
              <button onClick={exportSvg} disabled={!layout}>
                {t('Download SVG')}
              </button>
              <button onClick={exportDxf} disabled={!layout}>
                {t('Download DXF')}
              </button>
            </div>
            {tab === 'sheet' && layout && (
              <>
                {nSheets > 1 && (
                  <div className="row">
                    <button className="small" disabled={idx === 0} onClick={() => setSheetIdx(idx - 1)} aria-label={t('Previous sheet')}>
                      ‹
                    </button>
                    <span>{t('Sheet {0} of {1}', idx + 1, nSheets)}</span>
                    <button className="small" disabled={idx >= nSheets - 1} onClick={() => setSheetIdx(idx + 1)} aria-label={t('Next sheet')}>
                      ›
                    </button>
                  </div>
                )}
                <SheetView placed={placed} sheetW={sheet.sheetW} sheetH={sheet.sheetH} oversize={layout.oversize} t={t} />
                <p className="hint">
                  {t('{0} parts on this sheet, {1} mm of cut line.', partsOnSheet, Math.round(totalCut))} {t('Red lines are cut, blue lines are engraved.')}
                </p>
              </>
            )}
            {tab === '3d' && model && (
              <>
                <Suspense fallback={<div className="scene-canvas" />}>
                  <Preview3D solids={model.solids} dims={model.dims} explode={explode} theme={settings.theme} t={t} />
                </Suspense>
                <div className="row">
                  <label htmlFor="explode">{t('Explode')}</label>
                  <input id="explode" type="range" min="0" max="1" step="0.01" value={explode} onChange={(e) => setExplode(Number(e.target.value))} className="grow" />
                </div>
                <p className="hint">{t('Drag to rotate, scroll to zoom. The preview shows the panels in their assembled positions.')}</p>
              </>
            )}
            {!layout && tab === 'sheet' && <p className="hint">{t('Fix the highlighted values to see the layout.')}</p>}
          </div>
          {model && (
            <div className="box">
              <h3>{t('Parts')}</h3>
              <table className="data">
                <tbody>
                  {model.parts.map((p) => (
                    <tr key={p.id}>
                      <td>{t(p.name, ...p.nameArgs)}</td>
                      <td>
                        {fmt(p.w)} × {fmt(p.h)} {t('mm')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
      <p className="hint foot">
        {t('Everything runs in your browser; nothing is uploaded.')}{' '}
        <a href="https://github.com/hermes98761234/laser-cut-box-generator">{t('Source on GitHub')}</a>
      </p>
    </div>
  )
}
