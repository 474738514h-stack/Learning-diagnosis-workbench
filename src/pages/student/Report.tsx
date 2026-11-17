import { useEffect, useState } from 'react'
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from 'recharts'
import AttributionCard from '../../components/AttributionCard'
import DemoBanner from '../../components/DemoBanner'
import { api } from '../../lib/api'
import type { AttributionResult, PracticeItem, PracticeResponse, StoredError, Student } from '../../lib/types'

type StudentPayload = {
  student: Student
  errors: StoredError[]
  weakest: { topic: string; errorRate: number }
}

type GradeResponse = {
  correct: boolean
  attribution: AttributionResult | null
  guardrails: { rule: string; detail: string }[]
}

export default function StudentReportPage() {
  const [studentId, setStudentId] = useState('S2024-01')
  const [students, setStudents] = useState<Student[]>([])
  const [payload, setPayload] = useState<StudentPayload | null>(null)
  const [practice, setPractice] = useState<PracticeItem | null>(null)
  const [answer, setAnswer] = useState('')
  const [grade, setGrade] = useState<GradeResponse | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api<{ students: Student[] }>('/api/catalog')
      .then((catalog) => setStudents(catalog.students))
      .catch((reason: Error) => setError(reason.message))
  }, [])

  useEffect(() => {
    api<StudentPayload>(`/api/students/${encodeURIComponent(studentId)}`)
      .then((next) => {
        setPayload(next)
        setPractice(null)
        setGrade(null)
        setAnswer('')
      })
      .catch((reason: Error) => setError(reason.message))
  }, [studentId])

  async function makePractice() {
    if (!payload) return
    setError('')
    try {
      const response = await api<PracticeResponse>('/api/practice/generate', {
        method: 'POST',
        body: JSON.stringify({ class_id: payload.student.class_id, stage: '九年级' }),
      })
      setPractice(response.items[0] ?? null)
      setGrade(null)
      setAnswer('')
      if (!response.items[0]) setError('没有可作答的题目')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '出题失败')
    }
  }

  async function submitAnswer() {
    if (!practice || !payload) return
    setError('')
    try {
      const response = await api<GradeResponse>('/api/practice/grade', {
        method: 'POST',
        body: JSON.stringify({
          student_id: payload.student.student_id,
          question_text: practice.question_text,
          student_answer: answer,
          correct_answer: practice.answer,
          stage: '九年级',
        }),
      })
      setGrade(response)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '批改失败')
    }
  }

  const radar = Object.entries(payload?.student.weakness_scores ?? {}).map(([topic, mastery]) => ({
    topic,
    mastery: Math.round(mastery * 100),
  }))

  return (
    <div className="mx-auto max-w-4xl">
      <DemoBanner text="学生端复盘使用演示学号，不展示真实姓名。批改结果来自本地规则。" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">个人报告</h1>
        <label className="text-sm text-gray-600">
          学号
          <select className="field mt-1" value={studentId} onChange={(event) => setStudentId(event.target.value)}>
            {students.map((student) => (
              <option key={student.student_id} value={student.student_id}>
                {student.display_name} · {student.class_id}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && <p className="mt-3 text-sm text-status-danger">{error}</p>}
      {payload && (
        <p className="mt-2 text-sm text-gray-600">
          最弱主题 {payload.weakest.topic}，估计错误率 {(payload.weakest.errorRate * 100).toFixed(0)}%。
        </p>
      )}
      <div className="card mt-4 h-72 p-4">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radar}>
            <PolarGrid />
            <PolarAngleAxis dataKey="topic" tick={{ fontSize: 12 }} />
            <Radar dataKey="mastery" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.35} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <section className="card mt-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-gray-800">靶向练习</h2>
          <button type="button" className="btn-primary" onClick={() => void makePractice()}>
            出一道基础题
          </button>
        </div>
        {practice && (
          <div className="mt-3">
            <p className="text-sm text-gray-900">{practice.question_text}</p>
            <p className="mt-1 text-xs text-gray-500">
              {practice.knowledge_id} {practice.knowledge_name}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                className="field max-w-md"
                value={answer}
                placeholder="输入你的答案"
                onChange={(event) => setAnswer(event.target.value)}
              />
              <button type="button" className="btn-secondary" onClick={() => void submitAnswer()}>
                提交批改
              </button>
            </div>
            {grade && (
              <div className="mt-3">
                <p className={grade.correct ? 'text-sm text-emerald-700' : 'text-sm text-status-danger'}>
                  {grade.correct ? '答案与参考一致。' : '答案不一致，下面是错因复盘。'}
                </p>
                {grade.attribution && (
                  <div className="mt-3">
                    <AttributionCard data={grade.attribution} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="mt-4">
        <h2 className="mb-2 text-sm font-medium text-gray-800">历史错题</h2>
        <ul className="space-y-2">
          {(payload?.errors ?? []).map((item) => (
            <li key={item.id} className="card p-3 text-sm">
              <div className="font-medium text-gray-900">{item.question_text}</div>
              <div className="mt-1 text-gray-600">
                你的答案 {item.student_answer} · 标答 {item.correct_answer}
              </div>
              <div className="mt-1 text-gray-500">
                {item.gold_error_tag} · {item.gold_knowledge_name}
              </div>
            </li>
          ))}
          {payload && payload.errors.length === 0 && <li className="text-sm text-gray-500">还没有错题记录。</li>}
        </ul>
      </section>
    </div>
  )
}
