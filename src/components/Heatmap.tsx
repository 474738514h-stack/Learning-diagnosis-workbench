export default function Heatmap({
  rows,
  cols,
  values,
}: {
  rows: string[]
  cols: string[]
  values: number[][]
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-border bg-page px-2 py-1.5 text-left font-medium text-gray-500">
              知识点 \\ 班级
            </th>
            {cols.map((c) => (
              <th
                key={c}
                className="border border-border bg-page px-2 py-1.5 text-right font-medium text-gray-600"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r}>
              <td className="border border-border px-2 py-1.5 text-gray-800">{r}</td>
              {cols.map((c, j) => {
                const v = values[i]?.[j] ?? 0
                const alpha = 0.12 + v * 0.55
                return (
                  <td
                    key={`${r}-${c}`}
                    className="tabular border border-border px-2 py-1.5 text-right text-gray-900"
                    style={{ backgroundColor: `rgba(79, 70, 229, ${alpha})` }}
                  >
                    {(v * 100).toFixed(0)}%
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
