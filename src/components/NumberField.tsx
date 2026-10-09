import { useState } from 'react'

type Props = {
  label: string
  value: number
  /** Values below this are flagged. */
  min?: number
  step?: number
  onChange: (v: number) => void
}

/** A number input that keeps the raw text while it has focus, so "1" on the way to "10" is not reformatted. */
export default function NumberField({ label, value, min = 0, step, onChange }: Props) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = Number.isFinite(value) ? String(+value.toFixed(3)) : ''
  const bad = !Number.isFinite(value) || value < min
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step={step ?? 'any'}
        className={bad ? 'bad' : undefined}
        aria-invalid={bad}
        value={draft ?? shown}
        onChange={(e) => {
          setDraft(e.target.value)
          const v = e.target.value.trim()
          onChange(v === '' ? NaN : Number(v))
        }}
        onBlur={() => setDraft(null)}
      />
    </label>
  )
}
