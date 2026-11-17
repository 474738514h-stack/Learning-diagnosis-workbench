import { readText, appendLog } from './fsutil'
import type { EvalItem } from './store'
import {
  allErrors,
  gatesOf,
  knowledgeOf,
  promptsOf,
  savePrompts,
  saveVersions,
  sensitiveWords,
  versionsOf,
} from './store'
import type {
  AttributionResult,
  Citation,
  ErrorTag,
  EvalReport,
  GuardrailEvent,
  KnowledgeChunk,
  PracticeItem,
  PromptVersion,
  RequestHit,
} from '../src/lib/types'

const ERROR_TAGS = new Set<ErrorTag>(['概念混淆', '计算错误', '审题偏差', '知识遗忘'])
const ID_RE = /^M[0-9]-C[0-9]-K[0-9]+$/
const STAGE_RANK: Record<string, number> = { 七年级: 7, 八年级: 8, 九年级: 9, 初中: 9 }

const RULES: Array<{ test: (text: string) => boolean; tag: ErrorTag; knowledge_id: string }> = [
  { test: (text) => text.includes('有理化'), tag: '知识遗忘', knowledge_id: 'M9-C1-K3' },
  { test: (text) => text.includes('加减'), tag: '知识遗忘', knowledge_id: 'M9-C1-K2' },
  { test: (text) => text.includes('化简') || text.includes('√'), tag: '知识遗忘', knowledge_id: 'M9-C1-K1' },
  { test: (text) => text.includes('交点'), tag: '审题偏差', knowledge_id: 'M9-C3-K3' },
  { test: (text) => text.includes('对称轴') || text.includes('顶点'), tag: '计算错误', knowledge_id: 'M9-C3-K2' },
  { test: (text) => text.includes('SAS') || text.includes('全等'), tag: '计算错误', knowledge_id: 'M8-C1-K2' },
  { test: (text) => text.includes('SSS') || text.includes('三边'), tag: '知识遗忘', knowledge_id: 'M8-C1-K1' },
  { test: (text) => text.includes('等腰'), tag: '审题偏差', knowledge_id: 'M8-C2-K2' },
  { test: (text) => text.includes('一次函数') || text.includes('增减'), tag: '概念混淆', knowledge_id: 'M8-C3-K2' },
  { test: (text) => text.includes('移项'), tag: '概念混淆', knowledge_id: 'M7-C3-K1' },
  { test: (text) => text.includes('开方') || text.includes('(x'), tag: '概念混淆', knowledge_id: 'M9-C2-K1' },
  { test: (text) => text.includes('解方程') || text.includes('方程'), tag: '概念混淆', knowledge_id: 'M9-C2-K3' },
]

export function nowIso(): string {
  return new Date().toISOString()
}

export function requestId(): string {
  return `R${Date.now().toString(36)}`
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_all, key: string) => vars[key.trim()] ?? '')
}

export function pickVersion(root: string, task: string, seed: string): string {
  const versions = versionsOf(root)
  const taskCfg = versions.tasks[task]
  if (!taskCfg) return 'unknown'
  if (taskCfg.canary_version && unitInterval(`${seed}:${task}`) < taskCfg.canary_ratio) {
    return taskCfg.canary_version
  }
  return taskCfg.active_version
}

function unitInterval(seed: string): number {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 2 ** 32
}

export function recordHit(root: string, hit: RequestHit): void {
  const versions = structuredClone(versionsOf(root))
  versions.request_log = [...versions.request_log, hit].slice(-200)
  saveVersions(root, versions)
  appendLog(root, 'logs/requests.log', JSON.stringify(hit))
}

export function filledPrompt(
  root: string,
  version: PromptVersion | undefined,
  vars: Record<string, string>,
): string {
  if (!version) return ''
  const raw = readText(root, `prompts/${version.template_file}`)
  return fillTemplate(raw, vars)
}

export function versionById(root: string, id: string): PromptVersion | undefined {
  return promptsOf(root).versions.find((item) => item.id === id)
}

function chunkById(chunks: KnowledgeChunk[], id: string): KnowledgeChunk | undefined {
  return chunks.find((chunk) => chunk.knowledge_id === id)
}

function keywordScore(chunk: KnowledgeChunk, text: string): number {
  const hay = [chunk.name, chunk.chapter, chunk.definition, chunk.common_errors, ...chunk.examples].join('\n')
  let score = 0
  if (text.includes(chunk.knowledge_id)) score += 3
  if (text.includes(chunk.name)) score += 2
  if (chunk.examples.some((example) => text.includes(example) || example.includes(text))) score += 3
  for (const token of chunk.name.split(/[\s·]/)) {
    if (token.length >= 2 && text.includes(token)) score += 1
  }
  const words = hay.match(/[\u4e00-\u9fa5]{2,}/g) ?? []
  const seen = new Set<string>()
  for (const word of words) {
    if (seen.has(word)) continue
    seen.add(word)
    if (word.length >= 2 && text.includes(word)) score += 0.35
  }
  return score
}

function cosine(a: number[], b: number[]): number {
  let dot = 0
  let na = 0
  let nb = 0
  const length = Math.min(a.length, b.length)
  for (let i = 0; i < length; i += 1) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (na === 0 || nb === 0) return 0
  return dot / Math.sqrt(na * nb)
}

export function retrieve(root: string, text: string, limit = 3): Citation[] {
  const chunks = knowledgeOf(root).chunks
  const matched = chunks
    .map((chunk) => ({ chunk, keyword: keywordScore(chunk, text) }))
    .filter((item) => item.keyword > 0)
  const query =
    matched.length === 0
      ? chunks[0].embedding_mock
      : chunks[0].embedding_mock.map((_, index) => {
          const weight = matched.reduce((sum, item) => sum + item.keyword, 0)
          return matched.reduce((sum, item) => sum + item.chunk.embedding_mock[index] * item.keyword, 0) / weight
        })
  return chunks
    .map((chunk) => {
      const keyword = keywordScore(chunk, text)
      const embed = cosine(chunk.embedding_mock, query)
      const score = keyword <= 0 ? embed * 0.15 : Math.min(0.99, 0.15 + keyword * 0.12 + embed * 0.25)
      return { chunk, score }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(limit, 5))
    .slice(0, limit)
    .map(({ chunk, score }) => ({
      knowledge_id: chunk.knowledge_id,
      title: chunk.name,
      definition: chunk.definition,
      common_errors: chunk.common_errors,
      score: Number(score.toFixed(3)),
    }))
}

function ruleAttribution(text: string, chunks: KnowledgeChunk[]): { tag: ErrorTag; chunk: KnowledgeChunk } {
  const named = chunks
    .filter((chunk) => chunk.name.length >= 2 && text.includes(chunk.name))
    .sort((a, b) => b.name.length - a.name.length)[0]
  if (named) return { tag: '概念混淆', chunk: named }
  const rule = RULES.find((item) => item.test(text))
  const fallback = chunkById(chunks, 'M9-C2-K3') ?? chunks[0]
  if (!rule) return { tag: '审题偏差', chunk: fallback }
  return { tag: rule.tag, chunk: chunkById(chunks, rule.knowledge_id) ?? fallback }
}

export function attributeCase(
  root: string,
  input: {
    question_text: string
    student_answer: string
    correct_answer: string
    stage: string
  },
  events: GuardrailEvent[],
): AttributionResult {
  const chunks = knowledgeOf(root).chunks
  const corpus = `${input.question_text}\n${input.student_answer}\n${input.correct_answer}`
  const known = allErrors(root).find((item) => item.question_text === input.question_text)
  let tag: string
  let knowledgeId: string
  let knowledgeName: string
  let confidence: number
  let marking = ''
  if (input.question_text.includes('SCHEMA_FAIL')) {
    tag = '概念混淆'
    knowledgeId = 'INVALID'
    knowledgeName = ''
    confidence = 1.4
    marking = '模拟结构化输出越界'
  } else if (known) {
    tag = known.gold_error_tag
    knowledgeId = known.gold_knowledge_id
    knowledgeName = known.gold_knowledge_name
    confidence = known.confidence
    marking = known.marking_trace ?? ''
  } else {
    const ruled = ruleAttribution(corpus, chunks)
    tag = ruled.tag
    knowledgeId = ruled.chunk.knowledge_id
    knowledgeName = ruled.chunk.name
    const answerMatches = input.student_answer.trim() === input.correct_answer.trim()
    confidence = answerMatches ? 0.58 : input.correct_answer.includes(input.student_answer) ? 0.64 : 0.81
    marking = answerMatches ? '答案与标答一致，过程仍可能有误' : '按题干关键词映射到知识点'
  }
  const citations = retrieve(root, corpus, 3)
  const raw: AttributionResult = {
    question_text: input.question_text,
    student_answer: input.student_answer,
    correct_answer: input.correct_answer,
    error_tag: tag,
    knowledge_id: knowledgeId,
    knowledge_name: knowledgeName,
    confidence,
    marking_trace: marking,
    citations,
    needs_review: confidence < 0.6,
  }
  const checked = applySchema(raw, events)
  const chunk = chunkById(chunks, checked.knowledge_id)
  if (chunk && stageRank(chunk.stage) > stageRank(input.stage)) {
    events.push({
      at: nowIso(),
      rule: '超纲拦截',
      detail: `${chunk.knowledge_id} 属于${chunk.stage}，高于当前学段${input.stage}`,
    })
    checked.needs_review = true
  }
  return checked
}

function stageRank(stage: string): number {
  return STAGE_RANK[stage] ?? 9
}

export function applySchema(raw: AttributionResult, events: GuardrailEvent[]): AttributionResult {
  const problems: string[] = []
  if (!raw.question_text) problems.push('question_text')
  if (!ERROR_TAGS.has(raw.error_tag as ErrorTag)) problems.push('error_tag')
  if (!ID_RE.test(raw.knowledge_id)) problems.push('knowledge_id')
  if (!raw.knowledge_name) problems.push('knowledge_name')
  if (!(raw.confidence >= 0 && raw.confidence <= 1)) problems.push('confidence')
  if (!Array.isArray(raw.citations)) problems.push('citations')
  if (problems.length === 0) return raw
  events.push({
    at: nowIso(),
    rule: 'Schema 校验',
    detail: `字段不合规（${problems.join('、')}），已改写为兜底对象`,
  })
  return {
    question_text: raw.question_text || '（未能解析题目）',
    student_answer: raw.student_answer || '',
    correct_answer: raw.correct_answer || '',
    error_tag: '知识遗忘',
    knowledge_id: 'M9-C2-K3',
    knowledge_name: '因式分解法解一元二次方程',
    confidence: 0.3,
    marking_trace: raw.marking_trace,
    citations: raw.citations ?? [],
    schema_fallback: true,
    needs_review: true,
  }
}

export function redactAndScan(
  root: string,
  text: string,
  studentId: string,
  events: GuardrailEvent[],
): { text: string; blocked: boolean } {
  let next = text
  const name = next.match(/姓名[:：]\s*([\u4e00-\u9fa5]{2,4})/)
  if (name) {
    next = next.replace(/姓名[:：]\s*[\u4e00-\u9fa5]{2,4}/g, `姓名：${studentId}`)
    events.push({
      at: nowIso(),
      rule: 'PII 脱敏',
      detail: `姓名已替换为学号 ${studentId}`,
    })
  }
  const hit = sensitiveWords(root).find((word) => next.includes(word))
  if (hit) {
    events.push({
      at: nowIso(),
      rule: '敏感词拦截',
      detail: `命中「${hit}」，已中止生成`,
    })
    return { text: next, blocked: true }
  }
  return { text: next, blocked: false }
}

export function assertStage(root: string, stage: string, events: GuardrailEvent[]): boolean {
  const allowed = knowledgeOf(root).stage_whitelist
  if (allowed.includes(stage)) return true
  events.push({
    at: nowIso(),
    rule: '学段白名单',
    detail: `${stage} 不在白名单（${allowed.join('、')}）`,
  })
  return false
}

const TIERS = ['基础', '巩固', '拓展'] as const

export function generatePractice(
  root: string,
  input: { stage: string; topic: string; knowledgeId?: string },
  events: GuardrailEvent[],
): PracticeItem[] {
  const chunks = knowledgeOf(root).chunks
  const preferred =
    (input.knowledgeId && chunkById(chunks, input.knowledgeId)) ||
    chunks.find((chunk) => chunk.chapter === input.topic || chunk.name.includes(input.topic)) ||
    chunks.find((chunk) => chunk.chapter.includes('一元二次')) ||
    chunks[0]
  const existing = new Set(allErrors(root).map((item) => item.question_text.trim()))
  const items: PracticeItem[] = []
  TIERS.forEach((tier, index) => {
    const example = preferred.examples[Math.min(index, preferred.examples.length - 1)] ?? preferred.name
    const source = tier === '拓展' ? 'llm_variant' : 'retrieved'
    const question =
      tier === '基础'
        ? `【基础】根据「${preferred.name}」完成：${example}`
        : tier === '巩固'
          ? `【巩固】${example}。写出关键步骤。`
          : `【拓展】在「${preferred.name}」上变式：把「${example}」中的数字各加 1 后求解，并说明易错点。`
    if (existing.has(question.trim())) {
      events.push({
        at: nowIso(),
        rule: '重复题拦截',
        detail: `与已有错题题干重复，已丢弃：${question}`,
      })
      return
    }
    if (stageRank(preferred.stage) > stageRank(input.stage)) {
      events.push({
        at: nowIso(),
        rule: '超纲拦截',
        detail: `${preferred.knowledge_id}（${preferred.stage}）超出${input.stage}，未纳入${tier}档`,
      })
      return
    }
    const sensitive = sensitiveWords(root).find((word) => question.includes(word) || preferred.definition.includes(word))
    if (sensitive) {
      events.push({
        at: nowIso(),
        rule: '敏感词拦截',
        detail: `练习草稿命中「${sensitive}」`,
      })
      return
    }
    items.push({
      tier,
      question_text: question,
      answer: tier === '拓展' ? '按变式后的条件重新求解，过程需检验两个根或端点。' : example,
      explanation: `${preferred.definition} 易错点：${preferred.common_errors}`,
      knowledge_id: preferred.knowledge_id,
      knowledge_name: preferred.name,
      source,
    })
  })
  return items
}

export function weakestTopic(scores: Record<string, number>): { topic: string; errorRate: number } {
  const entries = Object.entries(scores)
  if (entries.length === 0) return { topic: '一元二次方程', errorRate: 0.5 }
  const [topic, mastery] = entries.reduce((worst, item) => (item[1] < worst[1] ? item : worst))
  return { topic, errorRate: Number((1 - mastery).toFixed(3)) }
}

export function classWeakness(
  students: Array<{ weakness_scores: Record<string, number> }>,
): { topic: string; error_rate: number }[] {
  const topics = ['一元二次方程', '全等三角形', '函数与图像', '二次根式', '一次函数']
  return topics.map((topic) => {
    const values = students.map((student) => student.weakness_scores[topic]).filter((value) => typeof value === 'number')
    const mastery = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0.5
    return { topic, error_rate: Number((1 - mastery).toFixed(3)) }
  })
}

export function runEval(root: string, versionId: string, items: EvalItem[]): EvalReport {
  const gates = gatesOf(root)
  let tagHit = 0
  let top1 = 0
  let top3 = 0
  let syllabus = 0
  for (const item of items) {
    const events: GuardrailEvent[] = []
    const result = attributeCase(
      root,
      {
        question_text: item.question_text,
        student_answer: item.student_answer,
        correct_answer: item.correct_answer,
        stage: '九年级',
      },
      events,
    )
    if (result.error_tag === item.gold_error_tag) tagHit += 1
    if (result.knowledge_id === item.gold_knowledge_id) top1 += 1
    const cited = result.citations.some((citation) => citation.knowledge_id === item.gold_knowledge_id)
    if (result.knowledge_id === item.gold_knowledge_id || cited) top3 += 1
    if (events.some((event) => event.rule === '超纲拦截')) syllabus += 1
  }
  const total = items.length || 1
  const metrics = {
    error_tag_acc: tagHit / total,
    knowledge_top1: top1 / total,
    knowledge_top3_recall: top3 / total,
    out_of_syllabus: syllabus / total,
    duplicate_rate: 0,
  }
  const baseline = promptsOf(root).eval_reports.find((report) => report.prompt_version === gates.baseline_version)
  const dropPt = baseline ? (baseline.metrics.error_tag_acc - metrics.error_tag_acc) * 100 : 0
  const reasons: string[] = []
  if (metrics.error_tag_acc < gates.attribution_accuracy_min) {
    reasons.push(`错因准确率 ${(metrics.error_tag_acc * 100).toFixed(1)}% 低于 ${(gates.attribution_accuracy_min * 100).toFixed(0)}%`)
  }
  if (metrics.out_of_syllabus > gates.out_of_syllabus_rate_max) {
    reasons.push('超纲率超过闸门')
  }
  if (dropPt > gates.baseline_drop_max_pt) {
    reasons.push(`相对基线下降 ${dropPt.toFixed(1)} 个百分点`)
  }
  const report: EvalReport = {
    id: `eval-${versionId}-${Date.now().toString(36)}`,
    prompt_version: versionId,
    dataset_version: 'v1',
    metrics,
    gate_passed: reasons.length === 0,
    created_at: nowIso(),
    gate_reason: reasons.length === 0 ? '达到发布闸门（合成集上的 mock 自检，不是真实模型指标）' : reasons.join('；'),
  }
  const prompts = structuredClone(promptsOf(root))
  prompts.eval_reports = [report, ...prompts.eval_reports]
  const version = prompts.versions.find((item) => item.id === versionId)
  if (version) {
    version.linked_eval_report_id = report.id
    version.gate_passed = report.gate_passed
  }
  prompts.change_log = [
    {
      at: report.created_at,
      author: '系统',
      action: `${versionId} 评测${report.gate_passed ? '通过闸门' : '未通过闸门'}`,
      version_id: versionId,
    },
    ...prompts.change_log,
  ]
  savePrompts(root, prompts)
  return report
}

export function transitionVersion(
  root: string,
  id: string,
  action: 'canary' | 'full' | 'rollback',
  ratio: number,
): { ok: true } | { ok: false; error: string } {
  const prompts = structuredClone(promptsOf(root))
  const versions = structuredClone(versionsOf(root))
  const current = prompts.versions.find((item) => item.id === id)
  if (!current) return { ok: false, error: '版本不存在' }
  const task = versions.tasks[current.task]
  if (!task) return { ok: false, error: '任务路由不存在' }

  if (action === 'canary') {
    if (!current.gate_passed) {
      return { ok: false, error: '评测闸门未通过，不能进入灰度' }
    }
    if (current.status === 'full') return { ok: false, error: '全量版本无需再进灰度' }
    prompts.versions.forEach((item) => {
      if (item.task === current.task && item.status === 'canary' && item.id !== current.id) {
        item.status = 'rolled_back'
      }
    })
    current.status = 'canary'
    current.canary_ratio = ratio
    task.canary_version = current.id
    task.canary_ratio = ratio
  } else if (action === 'full') {
    if (!current.gate_passed) return { ok: false, error: '评测闸门未通过，不能全量' }
    if (current.status !== 'canary' && current.status !== 'full') {
      return { ok: false, error: '只有灰度版本可以全量' }
    }
    prompts.versions.forEach((item) => {
      if (item.task === current.task && item.status === 'full' && item.id !== current.id) {
        item.status = 'rolled_back'
      }
    })
    current.status = 'full'
    current.canary_ratio = 0
    task.active_version = current.id
    if (task.canary_version === current.id) {
      task.canary_version = null
      task.canary_ratio = 0
    }
  } else {
    current.status = 'rolled_back'
    current.canary_ratio = 0
    if (task.canary_version === current.id) {
      task.canary_version = null
      task.canary_ratio = 0
    }
    if (task.active_version === current.id) {
      const restore = prompts.versions
        .filter((item) => item.task === current.task && item.id !== current.id && item.gate_passed)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
      if (!restore) return { ok: false, error: '没有可回滚的已通过版本' }
      restore.status = 'full'
      task.active_version = restore.id
    }
  }

  prompts.change_log = [
    {
      at: nowIso(),
      author: '演示操作者',
      action:
        action === 'canary'
          ? `${current.id} 进入灰度 ${Math.round(ratio * 100)}%`
          : action === 'full'
            ? `${current.id} 全量发布`
            : `${current.id} 回滚`,
      version_id: current.id,
    },
    ...prompts.change_log,
  ]
  savePrompts(root, prompts)
  saveVersions(root, versions)
  return { ok: true }
}
