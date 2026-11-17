import { useState } from 'react'
import type { AttributionResult } from '../lib/types'
import StatusBadge from './StatusBadge'

export default function AttributionCard({ data }: { data: AttributionResult }) {
  const [open, setOpen] = useState(false)
  const low = data.confidence < 0.6

  return (
    <article className="card fade-in p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <StatusBadge label={data.error_tag} tone="brand" />
        <StatusBadge
          label={`${data.knowledge_id} · ${data.knowledge_name}`}
          tone="neutral"
        />
        <span className="tabular text-sm text-gray-700">
          置信度 {(data.confidence * 100).toFixed(0)}%
        </span>
        {low && <StatusBadge label="待复核" tone="warning" />}
        {data.schema_fallback && <StatusBadge label="Schema 兜底" tone="danger" />}
      </div>

      <dl className="grid gap-2 text-body">
        <div>
          <dt className="text-xs text-gray-500">题目</dt>
          <dd className="text-gray-900">{data.question_text}</dd>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <dt className="text-xs text-gray-500">学生答案</dt>
            <dd className="text-gray-900">{data.student_answer}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">正确答案</dt>
            <dd className="text-gray-900">{data.correct_answer}</dd>
          </div>
        </div>
        {data.marking_trace && (
          <div>
            <dt className="text-xs text-gray-500">批改痕迹</dt>
            <dd className="text-gray-700">{data.marking_trace}</dd>
          </div>
        )}
      </dl>

      <button
        type="button"
        className="btn-secondary mt-3"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? '收起引用来源' : '展开 Top-3 检索引用'}
      </button>

      {open && (
        <ul className="mt-3 space-y-2">
          {data.citations.map((c) => (
            <li key={c.knowledge_id} className="rounded-lg border border-border bg-page p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-gray-900">
                  {c.knowledge_id} {c.title}
                </span>
                <span className="tabular text-xs text-gray-500">
                  分 {(c.score * 100).toFixed(1)}
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-700">{c.definition}</p>
              {c.common_errors && (
                <p className="mt-1 text-xs text-gray-500">易错点：{c.common_errors}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}
