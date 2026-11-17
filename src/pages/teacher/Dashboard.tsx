import { useEffect, useState } from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import DemoBanner from '../../components/DemoBanner'
import GuardrailLog from '../../components/GuardrailLog'
import Heatmap from '../../components/Heatmap'
import { api } from '../../lib/api'
import type { ClassRoom, GuardrailEvent, PracticeItem, PracticeResponse, StoredError } from '../../lib/types'

type DashboardData = {
  classroom?: ClassRoom
  weakness: { topic: string; error_rate: number }[]
  errors: StoredError[]
  classes: ClassRoom[]
}

export default function DashboardPage() {
  const [classId, setClassId] = useState('C2024-A')
  const [data, setData] = useState<DashboardData | null>(null)
  const [practice, setPractice] = useState<PracticeResponse | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    api<DashboardData>(`/api/dashboard?class_id=${encodeURIComponent(classId)}`)
      .then(setData)
      .catch((reason: Error) => setError(reason.message))
  }, [classId])

  async function generate() {
    setPending(true)
    setError('')
    try {
      const response = await api<PracticeResponse>('/api/practice/generate', {
        method: 'POST',
        body: JSON.stringify({ class_id: classId, stage: '九年级' }),
      })
      setPractice(response)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '生成失败')
    } finally {
      setPending(false)
    }
  }

  function exportPractice() {
    if (!practice) return
    const blob = new Blob([JSON.stringify(practice.items, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${classId}-practice.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const heatmap = heatmapFrom(data)

  return (
    <div className="mx-auto max-w-5xl">
      <DemoBanner />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">班级看板</h1>
          <p className="mt-1 text-sm text-gray-500">薄弱点按 1 − 掌握度 估计，颜色越深表示错得越集中。</p>
        </div>
        <label className="text-sm text-gray-600">
          班级
          <select className="field mt-1" value={classId} onChange={(event) => setClassId(event.target.value)}>
            {(data?.classes ?? []).map((item) => (
              <option key={item.class_id} value={item.class_id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="mt-3 text-sm text-status-danger">{error}</p>}

      <section className="card mt-4 p-4">
        <h2 className="mb-3 text-sm font-medium text-gray-800">{data?.classroom?.name ?? '班级'} 共性薄弱点</h2>
        {heatmap.rows.length > 0 && (
          <Heatmap rows={heatmap.rows} cols={heatmap.cols} values={heatmap.values} />
        )}
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.weakness ?? []}>
              <XAxis dataKey="topic" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(value: number) => `${Math.round(value * 100)}%`} />
              <Tooltip formatter={(value) => `${(Number(value) * 100).toFixed(0)}%`} />
              <Bar dataKey="error_rate" fill="#4f46e5" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="mt-4">
        <div className="mb-2 flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={() => void generate()} disabled={pending}>
            {pending ? '生成中…' : '生成分层练习'}
          </button>
          <button type="button" className="btn-secondary" onClick={exportPractice} disabled={!practice}>
            导出 JSON
          </button>
        </div>
        {practice && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              生成版本 {practice.prompt_version} · 请求 {practice.request_id}。题目来自知识点库示例与规则变式。
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              {practice.items.map((item) => (
                <PracticeCard key={item.tier} item={item} />
              ))}
            </div>
            {practice.items.length === 0 && <p className="text-sm text-gray-500">护栏未放行任何题目。</p>}
            <GuardrailLog events={practice.guardrails as GuardrailEvent[]} />
          </div>
        )}
      </section>

      <section className="card mt-4 p-4">
        <h2 className="text-sm font-medium text-gray-800">本班错题</h2>
        <ul className="mt-3 divide-y divide-border">
          {(data?.errors ?? []).map((item) => (
            <li key={item.id} className="py-2 text-sm">
              <div className="font-medium text-gray-900">{item.question_text}</div>
              <div className="text-gray-500">
                {item.student_id} · {item.gold_error_tag} · {item.gold_knowledge_id} · 置信度{' '}
                {(item.confidence * 100).toFixed(0)}%
              </div>
            </li>
          ))}
          {data && data.errors.length === 0 && <li className="py-2 text-sm text-gray-500">这个班还没有错题。</li>}
        </ul>
      </section>
    </div>
  )
}

function PracticeCard({ item }: { item: PracticeItem }) {
  return (
    <article className="card p-4">
      <div className="text-xs font-medium text-brand">
        {item.tier} · {item.source === 'retrieved' ? '检索' : '变式'}
      </div>
      <h3 className="mt-2 text-sm font-medium text-gray-900">{item.question_text}</h3>
      <p className="mt-2 text-xs text-gray-500">
        {item.knowledge_id} {item.knowledge_name}
      </p>
      <p className="mt-2 text-sm text-gray-700">参考：{item.answer}</p>
    </article>
  )
}

function heatmapFrom(data: DashboardData | null): { rows: string[]; cols: string[]; values: number[][] } {
  if (!data?.classroom) return { rows: [], cols: [], values: [] }
  return {
    rows: data.weakness.map((item) => item.topic),
    cols: [data.classroom.name],
    values: data.weakness.map((item) => [item.error_rate]),
  }
}
