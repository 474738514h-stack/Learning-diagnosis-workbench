import { useEffect, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import DemoBanner from '../../components/DemoBanner'
import { api, formatTime, percent } from '../../lib/api'
import type { EvalReport, RequestHit } from '../../lib/types'

type MonitorPayload = {
  request_log: RequestHit[]
  routes: Record<string, { active_version: string; canary_version: string | null; canary_ratio: number }>
  reports: EvalReport[]
}

export default function MonitorPage() {
  const [data, setData] = useState<MonitorPayload | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api<MonitorPayload>('/api/monitor')
      .then(setData)
      .catch((reason: Error) => setError(reason.message))
  }, [])

  const series = [...(data?.reports ?? [])]
    .reverse()
    .map((report) => ({
      name: report.prompt_version.replace('attribute-', ''),
      acc: Number((report.metrics.error_tag_acc * 100).toFixed(1)),
    }))

  return (
    <div className="mx-auto max-w-5xl">
      <DemoBanner text="曲线读取的是合成评测报告和本次演示产生的命中日志，不是线上真实流量。" />
      <h1 className="text-xl font-semibold text-gray-900">效果监控</h1>
      {error && <p className="mt-3 text-sm text-status-danger">{error}</p>}
      <section className="card mt-4 h-64 p-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series}>
            <CartesianGrid stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 100]} tickFormatter={(value: number) => `${value}%`} />
            <Tooltip formatter={(value) => `${value}%`} />
            <Line type="monotone" dataKey="acc" stroke="#4f46e5" strokeWidth={2} dot />
          </LineChart>
        </ResponsiveContainer>
      </section>
      <section className="card mt-4 p-4">
        <h2 className="text-sm font-medium text-gray-800">请求命中版本</h2>
        {(data?.request_log.length ?? 0) === 0 && (
          <p className="mt-2 text-sm text-gray-500">还没有请求。先在错题录入或练习生成里跑一条链路。</p>
        )}
        <ul className="mt-2 divide-y divide-border text-sm">
          {(data?.request_log ?? []).slice().reverse().map((hit) => (
            <li key={`${hit.request_id}-${hit.task}`} className="flex flex-wrap justify-between gap-2 py-2">
              <span className="text-gray-800">
                {hit.route} · {hit.task}
              </span>
              <span className="text-brand">{hit.version_id}</span>
              <span className="tabular text-gray-400">{formatTime(hit.at)} 上海</span>
            </li>
          ))}
        </ul>
      </section>
      <p className="mt-3 text-xs text-gray-500">
        最近一份报告错因准确率{' '}
        {data?.reports[0] ? percent(data.reports[0].metrics.error_tag_acc) : '尚无'}。
      </p>
    </div>
  )
}
