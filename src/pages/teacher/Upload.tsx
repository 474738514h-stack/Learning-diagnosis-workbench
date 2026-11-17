import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AttributionCard from '../../components/AttributionCard'
import DemoBanner from '../../components/DemoBanner'
import GuardrailLog from '../../components/GuardrailLog'
import { api } from '../../lib/api'
import type { ClassRoom, GuardrailEvent, IngestResponse, Student } from '../../lib/types'

type Catalog = {
  classes: ClassRoom[]
  students: Student[]
  stages: string[]
}

const empty = {
  stage: '九年级',
  class_id: 'C2024-A',
  student_id: 'S2024-01',
  question_text: '',
  student_answer: '',
  correct_answer: '',
}

export default function UploadPage() {
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [form, setForm] = useState(empty)
  const [result, setResult] = useState<IngestResponse | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    api<Catalog>('/api/catalog')
      .then(setCatalog)
      .catch((reason: Error) => setError(reason.message))
  }, [])

  const students = (catalog?.students ?? []).filter((student) => student.class_id === form.class_id)

  async function submit() {
    setPending(true)
    setError('')
    try {
      const response = await api<IngestResponse>('/api/workflow/ingest', {
        method: 'POST',
        body: JSON.stringify({ ...form, input_type: '文本' }),
      })
      setResult(response)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '提交失败')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <DemoBanner />
      <h1 className="text-xl font-semibold text-gray-900">错题录入</h1>
      <p className="mt-1 text-sm text-gray-500">本地 mock 链路：解析 → 归因 → 检索 → 护栏。不会调用外部模型。</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-secondary"
          onClick={() =>
            setForm({
              stage: '九年级',
              class_id: 'C2024-A',
              student_id: 'S2024-01',
              question_text: '解方程 x²-5x+6=0',
              student_answer: 'x=2',
              correct_answer: 'x=2 或 x=3',
            })
          }
        >
          填入示例错题
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() =>
            setForm({
              stage: '九年级',
              class_id: 'C2024-A',
              student_id: 'S2024-01',
              question_text: '解方程 x²-5x+6=0（姓名：王小明）',
              student_answer: 'x=2',
              correct_answer: 'x=2 或 x=3',
            })
          }
        >
          填入含姓名文本
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() =>
            setForm({
              stage: '七年级',
              class_id: 'C2024-A',
              student_id: 'S2024-01',
              question_text: '求二次函数顶点',
              student_answer: '(1,1)',
              correct_answer: '(1,0)',
            })
          }
        >
          填入超纲学段
        </button>
      </div>

      <form
        className="card mt-4 grid gap-3 p-4"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm text-gray-600">
            学段
            <select
              className="field mt-1"
              value={form.stage}
              onChange={(event) => setForm({ ...form, stage: event.target.value })}
            >
              {(catalog?.stages ?? ['九年级']).map((stage) => (
                <option key={stage}>{stage}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-gray-600">
            班级
            <select
              className="field mt-1"
              value={form.class_id}
              onChange={(event) => setForm({ ...form, class_id: event.target.value })}
            >
              {(catalog?.classes ?? []).map((item) => (
                <option key={item.class_id} value={item.class_id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-gray-600">
            学生
            <select
              className="field mt-1"
              value={form.student_id}
              onChange={(event) => setForm({ ...form, student_id: event.target.value })}
            >
              {students.map((student) => (
                <option key={student.student_id} value={student.student_id}>
                  {student.display_name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="text-sm text-gray-600">
          题目
          <textarea
            className="field mt-1 min-h-20"
            value={form.question_text}
            onChange={(event) => setForm({ ...form, question_text: event.target.value })}
          />
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm text-gray-600">
            学生答案
            <input
              className="field mt-1"
              value={form.student_answer}
              onChange={(event) => setForm({ ...form, student_answer: event.target.value })}
            />
          </label>
          <label className="text-sm text-gray-600">
            正确答案
            <input
              className="field mt-1"
              value={form.correct_answer}
              onChange={(event) => setForm({ ...form, correct_answer: event.target.value })}
            />
          </label>
        </div>
        {error && <p className="text-sm text-status-danger">{error}</p>}
        <div className="flex items-center gap-3">
          <button className="btn-primary" type="submit" disabled={pending}>
            {pending ? '归因中…' : '解析并归因'}
          </button>
          <Link className="text-sm text-brand" to="/teacher/dashboard">
            去班级看板
          </Link>
        </div>
      </form>

      {result && (
        <div className="mt-4 space-y-3">
          <div className="text-sm text-gray-500">
            请求 {result.request_id} · 解析 {result.prompt_versions.parse} · 归因 {result.prompt_versions.attribute}
            {result.blocked ? ' · 已拦截' : ''}
          </div>
          {result.attribution && <AttributionCard data={result.attribution} />}
          <GuardrailLog events={result.guardrails as GuardrailEvent[]} />
          <details className="card p-4 text-sm text-gray-700">
            <summary className="cursor-pointer font-medium text-gray-900">查看填充后的 Prompt</summary>
            <pre className="mt-3 whitespace-pre-wrap text-xs text-gray-600">{result.filled_prompts.attribute}</pre>
          </details>
        </div>
      )}
    </div>
  )
}
