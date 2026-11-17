import { useEffect, useState } from 'react'
import DemoBanner from '../../components/DemoBanner'
import StatusBadge from '../../components/StatusBadge'
import { api, formatTime } from '../../lib/api'
import type { ChangeLogEntry, PromptVersion } from '../../lib/types'

type PromptPayload = {
  versions: PromptVersion[]
  change_log: ChangeLogEntry[]
  routes: Record<string, { active_version: string; canary_version: string | null; canary_ratio: number }>
}

const STATUS_LABEL = {
  draft: '草稿',
  canary: '灰度',
  full: '全量',
  rolled_back: '已回滚',
} as const

export default function PromptsPage() {
  const [data, setData] = useState<PromptPayload | null>(null)
  const [ratio, setRatio] = useState(0.1)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  function load() {
    api<PromptPayload>('/api/prompts')
      .then(setData)
      .catch((reason: Error) => setError(reason.message))
  }

  useEffect(load, [])

  async function transition(id: string, action: 'canary' | 'full' | 'rollback') {
    setError('')
    setMessage('')
    try {
      await api(`/api/prompts/${encodeURIComponent(id)}/transition`, {
        method: 'POST',
        body: JSON.stringify({ action, canary_ratio: ratio }),
      })
      setMessage(`${id} 已${action === 'canary' ? '进入灰度' : action === 'full' ? '全量' : '回滚'}`)
      load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '迁移失败')
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <DemoBanner text="版本状态机跑在本地配置上。未通过评测闸门的草稿不能进入灰度。" />
      <h1 className="text-xl font-semibold text-gray-900">Prompt 版本</h1>
      {error && <p className="mt-3 text-sm text-status-danger">{error}</p>}
      {message && <p className="mt-3 text-sm text-emerald-700">{message}</p>}
      <label className="mt-4 block max-w-xs text-sm text-gray-600">
        灰度流量比例
        <input
          className="field mt-1"
          type="number"
          min={0.05}
          max={1}
          step={0.05}
          value={ratio}
          onChange={(event) => setRatio(Number(event.target.value))}
        />
      </label>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="border-b border-border px-2 py-2 font-medium">版本</th>
              <th className="border-b border-border px-2 py-2 font-medium">状态</th>
              <th className="border-b border-border px-2 py-2 font-medium">闸门</th>
              <th className="border-b border-border px-2 py-2 font-medium">说明</th>
              <th className="border-b border-border px-2 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {(data?.versions ?? []).map((version) => (
              <tr key={version.id}>
                <td className="border-b border-border px-2 py-2">
                  <div className="font-medium text-gray-900">{version.id}</div>
                  <div className="text-xs text-gray-500">{version.task}</div>
                </td>
                <td className="border-b border-border px-2 py-2">
                  <StatusBadge label={STATUS_LABEL[version.status]} tone={toneOf(version.status)} />
                </td>
                <td className="border-b border-border px-2 py-2">
                  <StatusBadge label={version.gate_passed ? '已通过' : '未通过'} tone={version.gate_passed ? 'ok' : 'danger'} />
                </td>
                <td className="border-b border-border px-2 py-2 text-gray-700">{version.changelog}</td>
                <td className="border-b border-border px-2 py-2">
                  <div className="flex flex-wrap gap-2">
                    {version.status === 'draft' && (
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={!version.gate_passed}
                        onClick={() => void transition(version.id, 'canary')}
                      >
                        进入灰度
                      </button>
                    )}
                    {version.status === 'canary' && (
                      <button type="button" className="btn-secondary" onClick={() => void transition(version.id, 'full')}>
                        全量
                      </button>
                    )}
                    {(version.status === 'canary' || version.status === 'full') && (
                      <button type="button" className="btn-secondary" onClick={() => void transition(version.id, 'rollback')}>
                        回滚
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="card mt-4 p-4">
        <h2 className="text-sm font-medium text-gray-800">当前路由</h2>
        <ul className="mt-2 space-y-1 text-sm text-gray-700">
          {Object.entries(data?.routes ?? {}).map(([task, route]) => (
            <li key={task}>
              {task}：全量 {route.active_version}
              {route.canary_version ? `，灰度 ${route.canary_version} ${(route.canary_ratio * 100).toFixed(0)}%` : ''}
            </li>
          ))}
        </ul>
      </section>
      <section className="card mt-4 p-4">
        <h2 className="text-sm font-medium text-gray-800">变更记录</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {(data?.change_log ?? []).map((entry) => (
            <li key={`${entry.at}-${entry.action}`}>
              <span className="tabular text-gray-400">{formatTime(entry.at)} 上海</span>
              <span className="ml-2 text-gray-800">
                {entry.author} · {entry.action}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function toneOf(status: PromptVersion['status']): 'neutral' | 'warning' | 'ok' | 'danger' {
  if (status === 'full') return 'ok'
  if (status === 'canary') return 'warning'
  if (status === 'rolled_back') return 'danger'
  return 'neutral'
}
