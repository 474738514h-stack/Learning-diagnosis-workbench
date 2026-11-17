import { useEffect, useState } from 'react'
import DemoBanner from '../../components/DemoBanner'
import StatusBadge from '../../components/StatusBadge'
import { api } from '../../lib/api'
import { ERROR_TAGS, type ReviewItem } from '../../lib/types'

type QueuePayload = {
  queue: ReviewItem[]
  candidates: Array<Record<string, unknown>>
}

export default function ReviewQueuePage() {
  const [data, setData] = useState<QueuePayload | null>(null)
  const [error, setError] = useState('')

  function load() {
    api<QueuePayload>('/api/review-queue')
      .then(setData)
      .catch((reason: Error) => setError(reason.message))
  }

  useEffect(load, [])

  async function resolve(item: ReviewItem, accept: boolean, goldTag: string, goldId: string) {
    setError('')
    try {
      await api(`/api/review-queue/${encodeURIComponent(item.id)}/resolve`, {
        method: 'POST',
        body: JSON.stringify({
          accept,
          gold_error_tag: goldTag,
          gold_knowledge_id: goldId,
        }),
      })
      load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '提交失败')
    }
  }

  const pending = (data?.queue ?? []).filter((item) => item.status === 'pending')

  return (
    <div className="mx-auto max-w-4xl">
      <DemoBanner text="低置信度条目进入复核。采纳后写入候选评测集，不会改写原始种子文件。" />
      <h1 className="text-xl font-semibold text-gray-900">复核队列</h1>
      <p className="mt-1 text-sm text-gray-500">
        待处理 {pending.length} 条 · 候选评测 {data?.candidates.length ?? 0} 条
      </p>
      {error && <p className="mt-3 text-sm text-status-danger">{error}</p>}
      <ul className="mt-4 space-y-3">
        {pending.map((item) => (
          <ReviewCard key={item.id} item={item} onResolve={resolve} />
        ))}
        {data && pending.length === 0 && <li className="text-sm text-gray-500">队列已清空。</li>}
      </ul>
    </div>
  )
}

function ReviewCard({
  item,
  onResolve,
}: {
  item: ReviewItem
  onResolve: (item: ReviewItem, accept: boolean, goldTag: string, goldId: string) => Promise<void>
}) {
  const [tag, setTag] = useState(item.predicted_error_tag)
  const [knowledgeId, setKnowledgeId] = useState(item.predicted_knowledge_id)

  return (
    <li className="card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge label={item.predicted_error_tag} tone="warning" />
        <span className="text-xs text-gray-500">置信度 {(item.confidence * 100).toFixed(0)}%</span>
        <span className="text-xs text-gray-400">{item.student_id}</span>
      </div>
      <p className="mt-2 text-sm font-medium text-gray-900">{item.question_text}</p>
      <p className="mt-1 text-sm text-gray-600">
        学生 {item.student_answer} · 标答 {item.correct_answer}
      </p>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <label className="text-xs text-gray-500">
          金标错因
          <select className="field mt-1" value={tag} onChange={(event) => setTag(event.target.value)}>
            {ERROR_TAGS.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-500">
          金标知识点
          <input className="field mt-1" value={knowledgeId} onChange={(event) => setKnowledgeId(event.target.value)} />
        </label>
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" className="btn-primary" onClick={() => void onResolve(item, true, tag, knowledgeId)}>
          采纳并回流
        </button>
        <button type="button" className="btn-secondary" onClick={() => void onResolve(item, false, tag, knowledgeId)}>
          驳回
        </button>
      </div>
    </li>
  )
}
