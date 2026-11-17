const tones = {
  brand: 'bg-brand/10 text-brand',
  neutral: 'bg-gray-100 text-gray-700',
  warning: 'bg-amber-50 text-amber-800',
  danger: 'bg-red-50 text-status-danger',
  ok: 'bg-emerald-50 text-emerald-700',
} as const

export default function StatusBadge({
  label,
  tone = 'neutral',
}: {
  label: string
  tone?: keyof typeof tones
}) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {label}
    </span>
  )
}
