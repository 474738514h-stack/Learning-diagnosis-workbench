import { useEffect, useState } from 'react'
import DemoBanner from '../../components/DemoBanner'
import StatusBadge from '../../components/StatusBadge'
import { api, formatTime, percent } from '../../lib/api'
import type { EvalReport, PromptVersion } from '../../lib/types'

type EvalPayload = {
  reports: EvalReport[]
  gates: {
    attribution_accuracy_min: number
    baseline_drop_max_pt: number
    out_of_syllabus_rate_max: number
    baseline_version: string
  }
  versions: PromptVersion[]
}

export default function EvalsPage() {
  const [data, setData] = useState<EvalPayload | null>(null)
  const [versionId, setVersionId] = useState('attribute-v1.2.0-draft')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  function load() {
    api<EvalPayload>('/api/evals')
      .then(setData)
      .catch((reason: Error) => setError(reason.message))
  }

  useEffect(load, [])

  async function run() {
    setPending(true)
    setError('')
    try {
      await api('/api/evals/run', {
        method: 'POST',
        body: JSON.stringify({ prompt_version: versionId }),
      })
      load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '评测失败')
    } finally {
      setPending(false)
    }
  }

  const latest = data?.reports.find((report) => report.prompt_version === versionId)

  return (
    <div className="mx-auto max-w-5xl">
      <DemoBanner text="评测集是合成数据。页面数字是 mock 规则在该集合上的自检结果，不能当作真实模型效果。" />
      <h1 className="text-xl font-semibold text-gray-900">评测回归</h1>
      <p className="mt-1 text-sm text-gray-500">
        闸门：错因准确率 ≥ {data ? percent(data.gates.attribution_accuracy_min) : '—'}，超纲率 ≤{' '}
        {data ? percent(data.gates.out_of_syllabus_rate_max) : '—'}，相对 {data?.gates.baseline_version ?? '基线'}{' '}
        下降不超过 {data?.gates.baseline_drop_max_pt ?? '—'} 个百分点。
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="text-sm text-gray-600">
          版本
          <select className="field mt-1" value={versionId} onChange={(event) => setVersionId(event.target.value)}>
            {(data?.versions ?? []).map((version) => (
              <option key={version.id} value={version.id}>
                {version.id}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn-primary" disabled={pending} onClick={() => void run()}>
          {pending ? '评测中…' : '运行评测'}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-status-danger">{error}</p>}
      {latest && (
        <article className="card mt-4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-medium text-gray-900">{latest.id}</h2>
            <StatusBadge label={latest.gate_passed ? '闸门通过' : '闸门未过'} tone={latest.gate_passed ? 'ok' : 'danger'} />
          </div>
          <p className="mt-2 text-sm text-gray-600">{latest.gate_reason}</p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-5">
            <Metric label="错因准确率" value={percent(latest.metrics.error_tag_acc)} />
            <Metric label="知识点 Top1" value={percent(latest.metrics.knowledge_top1)} />
            <Metric label="Top3 召回" value={percent(latest.metrics.knowledge_top3_recall)} />
            <Metric label="超纲率" value={percent(latest.metrics.out_of_syllabus)} />
            <Metric label="重复率" value={percent(latest.metrics.duplicate_rate)} />
          </dl>
        </article>
      )}
      <ul className="mt-4 space-y-2">
        {(data?.reports ?? []).map((report) => (
          <li key={report.id} className="card flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
            <span className="text-gray-800">
              {report.prompt_version} · {formatTime(report.created_at)} 上海
            </span>
            <span className="tabular text-gray-600">错因 {percent(report.metrics.error_tag_acc)}</span>
            <StatusBadge label={report.gate_passed ? '通过' : '未过'} tone={report.gate_passed ? 'ok' : 'danger'} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-page px-2 py-2">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="tabular font-medium text-gray-900">{value}</dd>
    </div>
  )
}
