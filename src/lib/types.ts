export const ERROR_TAGS = ['概念混淆', '计算错误', '审题偏差', '知识遗忘'] as const

export type ErrorTag = (typeof ERROR_TAGS)[number]

export type Citation = {
  knowledge_id: string
  title: string
  definition: string
  common_errors?: string
  score: number
}

export type AttributionResult = {
  question_text: string
  student_answer: string
  correct_answer: string
  error_tag: string
  knowledge_id: string
  knowledge_name: string
  confidence: number
  marking_trace?: string
  citations: Citation[]
  schema_fallback?: boolean
  needs_review?: boolean
  prompt_version?: string
}

export type GuardrailEvent = {
  at: string
  rule: string
  detail: string
}

export type KnowledgeChunk = {
  knowledge_id: string
  textbook: string
  chapter: string
  name: string
  definition: string
  examples: string[]
  common_errors: string
  stage: string
  embedding_mock: number[]
}

export type PracticeItem = {
  tier: '基础' | '巩固' | '拓展'
  question_text: string
  answer: string
  explanation: string
  knowledge_id: string
  knowledge_name: string
  source: 'retrieved' | 'llm_variant'
}

export type PromptStatus = 'draft' | 'canary' | 'full' | 'rolled_back'

export type PromptVersion = {
  id: string
  task: 'parse' | 'attribute' | 'generate'
  status: PromptStatus
  author: string
  created_at: string
  changelog: string
  template_file: string
  canary_ratio: number
  linked_eval_report_id: string | null
  gate_passed: boolean
}

export type ChangeLogEntry = {
  at: string
  author: string
  action: string
  version_id: string
}

export type EvalMetrics = {
  error_tag_acc: number
  knowledge_top1: number
  knowledge_top3_recall: number
  out_of_syllabus: number
  duplicate_rate: number
}

export type EvalReport = {
  id: string
  prompt_version: string
  dataset_version: string
  metrics: EvalMetrics
  gate_passed: boolean
  created_at: string
  gate_reason: string
}

export type ReviewItem = {
  id: string
  error_id: string
  question_text: string
  student_answer: string
  correct_answer: string
  predicted_error_tag: string
  predicted_knowledge_id: string
  confidence: number
  status: 'pending' | 'accepted' | 'rejected'
  student_id: string
}

export type StoredError = {
  id: string
  question_text: string
  student_answer: string
  correct_answer: string
  marking_trace?: string
  gold_error_tag: string
  gold_knowledge_id: string
  gold_knowledge_name: string
  confidence: number
  student_id: string
  class_id: string
  schema_fallback?: boolean
}

export type Student = {
  student_id: string
  display_name: string
  class_id: string
  weakness_scores: Record<string, number>
}

export type ClassRoom = {
  class_id: string
  name: string
  grade: string
  student_ids: string[]
}

export type RequestHit = {
  at: string
  request_id: string
  task: string
  version_id: string
  route: string
}

export type IngestResponse = {
  request_id: string
  blocked: boolean
  prompt_versions: { parse: string; attribute: string }
  filled_prompts: { parse: string; attribute: string }
  attribution: AttributionResult | null
  guardrails: GuardrailEvent[]
}

export type PracticeResponse = {
  request_id: string
  prompt_version: string
  items: PracticeItem[]
  guardrails: GuardrailEvent[]
  weakness: { topic: string; error_rate: number }[]
}
