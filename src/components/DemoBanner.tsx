export default function DemoBanner({ text }: { text?: string }) {
  return (
    <div className="mb-4 rounded-card border border-border bg-white px-3 py-2 text-xs text-gray-600 shadow-card">
      {text || '演示数据。以下结果由本地 mock 链路生成，不得作为真实模型效果或对外指标依据。'}
    </div>
  )
}
