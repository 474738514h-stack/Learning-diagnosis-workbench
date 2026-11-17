import { useState } from 'react'
import type { GuardrailEvent } from '../lib/types'

export default function GuardrailLog({ events }: { events: GuardrailEvent[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="card p-4">
      <button type="button" className="btn-secondary" onClick={() => setOpen((v) => !v)}>
        护栏拦截 {events.length} 条
      </button>
      {open && (
        <ul className="mt-3 space-y-2">
          {events.length === 0 && (
            <li className="text-sm text-gray-500">本次无拦截记录</li>
          )}
          {events.map((e, i) => (
            <li key={`${e.at}-${i}`} className="rounded-lg border border-border bg-page p-3 text-sm">
              <div className="flex justify-between gap-2">
                <span className="font-medium text-status-danger">{e.rule}</span>
                <span className="tabular text-xs text-gray-400">{e.at}</span>
              </div>
              <p className="mt-1 text-gray-700">{e.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
