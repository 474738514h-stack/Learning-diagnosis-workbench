import { readJson, writeJson } from './fsutil'
import type {
  ChangeLogEntry,
  ClassRoom,
  EvalReport,
  KnowledgeChunk,
  PromptVersion,
  RequestHit,
  ReviewItem,
  StoredError,
  Student,
} from '../src/lib/types'

export type PromptsFile = {
  is_demo_data: boolean
  versions: PromptVersion[]
  change_log: ChangeLogEntry[]
  eval_reports: EvalReport[]
  review_queue: ReviewItem[]
  candidate_eval_items: Array<Record<string, unknown>>
}

export type VersionsFile = {
  is_demo_data: boolean
  tasks: Record<string, { active_version: string; canary_version: string | null; canary_ratio: number }>
  request_log: RequestHit[]
}

export type KnowledgeFile = {
  is_demo_data: boolean
  index_version: string
  stage_whitelist: string[]
  chunks: KnowledgeChunk[]
}

export type GatesFile = {
  is_demo_data: boolean
  attribution_accuracy_min: number
  baseline_drop_max_pt: number
  out_of_syllabus_rate_max: number
  baseline_version: string
}

type RuntimeState = {
  prompts?: PromptsFile
  versions?: VersionsFile
  ingested: StoredError[]
}

const RUNTIME = 'logs/runtime-state.json'

function emptyRuntime(): RuntimeState {
  return { ingested: [] }
}

export function readRuntime(root: string): RuntimeState {
  try {
    const saved = readJson<RuntimeState>(root, RUNTIME)
    return { ingested: saved.ingested ?? [], prompts: saved.prompts, versions: saved.versions }
  } catch {
    return emptyRuntime()
  }
}

export function writeRuntime(root: string, state: RuntimeState): void {
  writeJson(root, RUNTIME, state)
}

export function promptsOf(root: string): PromptsFile {
  return readRuntime(root).prompts ?? readJson<PromptsFile>(root, 'config/prompts_registry.json')
}

export function versionsOf(root: string): VersionsFile {
  return readRuntime(root).versions ?? readJson<VersionsFile>(root, 'config/versions.json')
}

export function savePrompts(root: string, prompts: PromptsFile): void {
  const state = readRuntime(root)
  state.prompts = prompts
  writeRuntime(root, state)
}

export function saveVersions(root: string, versions: VersionsFile): void {
  const state = readRuntime(root)
  state.versions = versions
  writeRuntime(root, state)
}

export function seedErrors(root: string): StoredError[] {
  const file = readJson<{ items: StoredError[] }>(root, 'data/errors.json')
  return file.items
}

export function allErrors(root: string): StoredError[] {
  return [...seedErrors(root), ...readRuntime(root).ingested]
}

export function rememberError(root: string, item: StoredError): void {
  const state = readRuntime(root)
  state.ingested = [...state.ingested, item]
  writeRuntime(root, state)
}

export function classesOf(root: string): ClassRoom[] {
  return readJson<{ classes: ClassRoom[] }>(root, 'data/classes.json').classes
}

export function studentsOf(root: string): Student[] {
  return readJson<{ students: Student[] }>(root, 'data/students.json').students
}

export function knowledgeOf(root: string): KnowledgeFile {
  return readJson<KnowledgeFile>(root, 'data/knowledge_base.json')
}

export function gatesOf(root: string): GatesFile {
  return readJson<GatesFile>(root, 'config/gates.json')
}

export function sensitiveWords(root: string): string[] {
  return readJson<{ words: string[] }>(root, 'data/sensitive_words.json').words
}

export type EvalItem = {
  id: string
  question_text: string
  student_answer: string
  correct_answer: string
  gold_error_tag: string
  gold_knowledge_id: string
  gold_knowledge_name: string
  keywords: string[]
}

export function evalItems(root: string): EvalItem[] {
  return readJson<{ items: EvalItem[] }>(root, 'data/eval_set_v1.json').items
}
