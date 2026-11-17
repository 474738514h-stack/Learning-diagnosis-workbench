import express, { type NextFunction, type Request, type Response } from 'express'
import {
  allErrors,
  classesOf,
  evalItems,
  gatesOf,
  knowledgeOf,
  promptsOf,
  rememberError,
  savePrompts,
  studentsOf,
  versionsOf,
} from './store'
import {
  assertStage,
  attributeCase,
  classWeakness,
  filledPrompt,
  generatePractice,
  nowIso,
  pickVersion,
  recordHit,
  redactAndScan,
  requestId,
  runEval,
  transitionVersion,
  versionById,
  weakestTopic,
} from './pipeline'
import type { GuardrailEvent, ReviewItem, StoredError } from '../src/lib/types'

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asyncRoute(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next)
  }
}

export function createApi(root: string): express.Express {
  const app = express()
  app.use(express.json({ limit: '1mb' }))

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, mock: true })
  })

  app.get('/api/catalog', (_req, res) => {
    res.json({
      classes: classesOf(root),
      students: studentsOf(root),
      errors: allErrors(root),
      stages: knowledgeOf(root).stage_whitelist,
    })
  })

  app.get('/api/dashboard', (req, res) => {
    const classId = text(req.query.class_id) || classesOf(root)[0]?.class_id || ''
    const classroom = classesOf(root).find((item) => item.class_id === classId)
    const students = studentsOf(root).filter((student) => student.class_id === classId)
    const errors = allErrors(root).filter((item) => item.class_id === classId)
    res.json({
      classroom,
      weakness: classWeakness(students),
      errors,
      classes: classesOf(root),
    })
  })

  app.get('/api/students/:id', (req, res) => {
    const student = studentsOf(root).find((item) => item.student_id === req.params.id)
    if (!student) {
      res.status(404).json({ error: '学生不存在' })
      return
    }
    const errors = allErrors(root).filter((item) => item.student_id === student.student_id)
    res.json({ student, errors, weakest: weakestTopic(student.weakness_scores) })
  })

  app.post(
    '/api/workflow/ingest',
    asyncRoute(async (req, res) => {
      const stage = text(req.body?.stage) || '九年级'
      const studentId = text(req.body?.student_id)
      const classId = text(req.body?.class_id)
      const events: GuardrailEvent[] = []
      if (!assertStage(root, stage, events)) {
        res.status(400).json({ error: events[0]?.detail || '学段不合法', guardrails: events })
        return
      }
      const scannedQuestion = redactAndScan(root, text(req.body?.question_text), studentId || '未知学号', events)
      const scannedAnswer = redactAndScan(root, text(req.body?.student_answer), studentId || '未知学号', events)
      const scannedCorrect = redactAndScan(root, text(req.body?.correct_answer), studentId || '未知学号', events)
      if (!scannedQuestion.text || !studentId || !classId) {
        res.status(400).json({ error: '题目、学生和班级为必填', guardrails: events })
        return
      }
      const id = requestId()
      const parseVersion = pickVersion(root, 'parse', id)
      const attributeVersion = pickVersion(root, 'attribute', id)
      const vars = {
        学段: stage,
        输入类型: text(req.body?.input_type) || '文本',
        题目文本: scannedQuestion.text,
        学生答案: scannedAnswer.text,
        正确答案: scannedCorrect.text,
        候选知识点: knowledgeOf(root)
          .chunks.slice(0, 8)
          .map((chunk) => `${chunk.knowledge_id} ${chunk.name}`)
          .join('\n'),
      }
      recordHit(root, { at: nowIso(), request_id: id, task: 'parse', version_id: parseVersion, route: 'ingest' })
      recordHit(root, {
        at: nowIso(),
        request_id: id,
        task: 'attribute',
        version_id: attributeVersion,
        route: 'ingest',
      })
      if (scannedQuestion.blocked || scannedAnswer.blocked || scannedCorrect.blocked) {
        res.json({
          request_id: id,
          blocked: true,
          prompt_versions: { parse: parseVersion, attribute: attributeVersion },
          filled_prompts: {
            parse: filledPrompt(root, versionById(root, parseVersion), vars),
            attribute: filledPrompt(root, versionById(root, attributeVersion), vars),
          },
          attribution: null,
          guardrails: events,
        })
        return
      }
      const attribution = attributeCase(
        root,
        {
          question_text: scannedQuestion.text,
          student_answer: scannedAnswer.text,
          correct_answer: scannedCorrect.text,
          stage,
        },
        events,
      )
      attribution.prompt_version = attributeVersion
      const stored: StoredError = {
        id: `ING-${id}`,
        question_text: attribution.question_text,
        student_answer: attribution.student_answer,
        correct_answer: attribution.correct_answer,
        marking_trace: attribution.marking_trace,
        gold_error_tag: attribution.error_tag,
        gold_knowledge_id: attribution.knowledge_id,
        gold_knowledge_name: attribution.knowledge_name,
        confidence: attribution.confidence,
        student_id: studentId,
        class_id: classId,
        schema_fallback: attribution.schema_fallback,
      }
      rememberError(root, stored)
      if (attribution.needs_review || (attribution.confidence ?? 1) < 0.6) {
        const prompts = structuredClone(promptsOf(root))
        const review: ReviewItem = {
          id: `RQ-${id}`,
          error_id: stored.id,
          question_text: stored.question_text,
          student_answer: stored.student_answer,
          correct_answer: stored.correct_answer,
          predicted_error_tag: stored.gold_error_tag,
          predicted_knowledge_id: stored.gold_knowledge_id,
          confidence: stored.confidence,
          status: 'pending',
          student_id: studentId,
        }
        prompts.review_queue = [review, ...prompts.review_queue]
        savePrompts(root, prompts)
      }
      res.json({
        request_id: id,
        blocked: false,
        prompt_versions: { parse: parseVersion, attribute: attributeVersion },
        filled_prompts: {
          parse: filledPrompt(root, versionById(root, parseVersion), vars),
          attribute: filledPrompt(root, versionById(root, attributeVersion), vars),
        },
        attribution,
        guardrails: events,
      })
    }),
  )

  app.post(
    '/api/practice/generate',
    asyncRoute(async (req, res) => {
      const stage = text(req.body?.stage) || '九年级'
      const classId = text(req.body?.class_id)
      const events: GuardrailEvent[] = []
      if (!assertStage(root, stage, events)) {
        res.status(400).json({ error: events[0]?.detail || '学段不合法', guardrails: events })
        return
      }
      const students = studentsOf(root).filter((student) => !classId || student.class_id === classId)
      const weakness = classWeakness(students)
      const topic = [...weakness].sort((a, b) => b.error_rate - a.error_rate)[0]?.topic || '一元二次方程'
      const id = requestId()
      const promptVersion = pickVersion(root, 'generate', id)
      recordHit(root, {
        at: nowIso(),
        request_id: id,
        task: 'generate',
        version_id: promptVersion,
        route: 'practice',
      })
      const items = generatePractice(
        root,
        { stage, topic, knowledgeId: text(req.body?.knowledge_id) || undefined },
        events,
      )
      res.json({ request_id: id, prompt_version: promptVersion, items, guardrails: events, weakness })
    }),
  )

  app.post(
    '/api/practice/grade',
    asyncRoute(async (req, res) => {
      const studentId = text(req.body?.student_id)
      const question = text(req.body?.question_text)
      const answer = text(req.body?.student_answer)
      const expected = text(req.body?.correct_answer)
      const stage = text(req.body?.stage) || '九年级'
      if (!studentId || !question || !expected) {
        res.status(400).json({ error: '缺少题目或学生' })
        return
      }
      const events: GuardrailEvent[] = []
      const scanned = redactAndScan(root, answer, studentId, events)
      const correct = scanned.text.replace(/\s+/g, '') === expected.replace(/\s+/g, '')
      const attribution = correct
        ? null
        : attributeCase(
            root,
            {
              question_text: question,
              student_answer: scanned.text,
              correct_answer: expected,
              stage,
            },
            events,
          )
      res.json({ correct, attribution, guardrails: events })
    }),
  )

  app.get('/api/prompts', (_req, res) => {
    const prompts = promptsOf(root)
    res.json({
      versions: prompts.versions,
      change_log: prompts.change_log,
      routes: versionsOf(root).tasks,
    })
  })

  app.post(
    '/api/prompts/:id/transition',
    asyncRoute(async (req, res) => {
      const action = text(req.body?.action)
      if (action !== 'canary' && action !== 'full' && action !== 'rollback') {
        res.status(400).json({ error: '不支持的状态迁移' })
        return
      }
      const ratioRaw = Number(req.body?.canary_ratio)
      const ratio = Number.isFinite(ratioRaw) ? Math.min(1, Math.max(0.05, ratioRaw)) : 0.1
      const result = transitionVersion(root, req.params.id, action, ratio)
      if (!result.ok) {
        res.status(400).json({ error: result.error })
        return
      }
      res.json({ ok: true, versions: promptsOf(root).versions, routes: versionsOf(root).tasks })
    }),
  )

  app.get('/api/evals', (_req, res) => {
    const prompts = promptsOf(root)
    res.json({
      reports: prompts.eval_reports,
      gates: gatesOf(root),
      versions: prompts.versions,
    })
  })

  app.post(
    '/api/evals/run',
    asyncRoute(async (req, res) => {
      const versionId = text(req.body?.prompt_version)
      const version = versionById(root, versionId)
      if (!version) {
        res.status(404).json({ error: '版本不存在' })
        return
      }
      const report = runEval(root, versionId, evalItems(root))
      res.json({ report })
    }),
  )

  app.get('/api/knowledge', (req, res) => {
    const query = text(req.query.q).toLowerCase()
    const file = knowledgeOf(root)
    const chunks = file.chunks.filter((chunk) => {
      if (!query) return true
      const hay = `${chunk.knowledge_id} ${chunk.name} ${chunk.chapter} ${chunk.definition}`.toLowerCase()
      return hay.includes(query)
    })
    res.json({ index_version: file.index_version, chunks })
  })

  app.get('/api/monitor', (_req, res) => {
    const versions = versionsOf(root)
    res.json({
      request_log: versions.request_log,
      routes: versions.tasks,
      reports: promptsOf(root).eval_reports,
    })
  })

  app.get('/api/review-queue', (_req, res) => {
    const prompts = promptsOf(root)
    res.json({
      queue: prompts.review_queue,
      candidates: prompts.candidate_eval_items,
    })
  })

  app.post(
    '/api/review-queue/:id/resolve',
    asyncRoute(async (req, res) => {
      const prompts = structuredClone(promptsOf(root))
      const item = prompts.review_queue.find((entry) => entry.id === req.params.id)
      if (!item) {
        res.status(404).json({ error: '复核条目不存在' })
        return
      }
      const accept = Boolean(req.body?.accept)
      const goldTag = text(req.body?.gold_error_tag) || item.predicted_error_tag
      const goldId = text(req.body?.gold_knowledge_id) || item.predicted_knowledge_id
      item.status = accept ? 'accepted' : 'rejected'
      item.predicted_error_tag = goldTag
      item.predicted_knowledge_id = goldId
      if (accept) {
        prompts.candidate_eval_items = [
          {
            id: `CAND-${item.id}`,
            question_text: item.question_text,
            student_answer: item.student_answer,
            correct_answer: item.correct_answer,
            gold_error_tag: goldTag,
            gold_knowledge_id: goldId,
            source_error_id: item.error_id,
            synthetic: false,
          },
          ...prompts.candidate_eval_items,
        ]
      }
      savePrompts(root, prompts)
      res.json({ item, candidates: prompts.candidate_eval_items })
    }),
  )

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'not_found' })
  })

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = error instanceof Error ? error.message : '服务器错误'
    res.status(500).json({ error: message })
  })

  return app
}
