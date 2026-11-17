import fs from 'node:fs'
import path from 'node:path'

export function readJson<T>(root: string, rel: string): T {
  const p = path.join(root, rel)
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as T
}

export function writeJson(root: string, rel: string, data: unknown): void {
  const p = path.join(root, rel)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf-8')
}

export function readText(root: string, rel: string): string {
  return fs.readFileSync(path.join(root, rel), 'utf-8')
}

export function appendLog(root: string, rel: string, line: string): void {
  const p = path.join(root, rel)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.appendFileSync(p, line.endsWith('\n') ? line : line + '\n', 'utf-8')
}
