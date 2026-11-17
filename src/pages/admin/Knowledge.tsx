import { useEffect, useState } from 'react'
import DemoBanner from '../../components/DemoBanner'
import { api } from '../../lib/api'
import type { KnowledgeChunk } from '../../lib/types'

export default function KnowledgePage() {
  const [query, setQuery] = useState('')
  const [chunks, setChunks] = useState<KnowledgeChunk[]>([])
  const [indexVersion, setIndexVersion] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const handle = window.setTimeout(() => {
      api<{ index_version: string; chunks: KnowledgeChunk[] }>(`/api/knowledge?q=${encodeURIComponent(query)}`)
        .then((payload) => {
          setChunks(payload.chunks)
          setIndexVersion(payload.index_version)
        })
        .catch((reason: Error) => setError(reason.message))
    }, 150)
    return () => window.clearTimeout(handle)
  }, [query])

  return (
    <div className="mx-auto max-w-4xl">
      <DemoBanner text="知识点切片来自仓库内置库，检索打分是关键词加预置向量的 mock。" />
      <h1 className="text-xl font-semibold text-gray-900">知识点库</h1>
      <p className="mt-1 text-sm text-gray-500">索引 {indexVersion || '…'} · {chunks.length} 条</p>
      <input
        className="field mt-4 max-w-md"
        placeholder="搜索名称、章节或 ID"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {error && <p className="mt-3 text-sm text-status-danger">{error}</p>}
      <ul className="mt-4 space-y-2">
        {chunks.map((chunk) => (
          <li key={chunk.knowledge_id} className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-gray-900">
                {chunk.knowledge_id} {chunk.name}
              </h2>
              <span className="text-xs text-gray-500">
                {chunk.stage} · {chunk.chapter}
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-700">{chunk.definition}</p>
            <p className="mt-1 text-xs text-gray-500">易错点：{chunk.common_errors}</p>
          </li>
        ))}
        {chunks.length === 0 && <li className="text-sm text-gray-500">没有匹配的知识点。</li>}
      </ul>
    </div>
  )
}
