import { useEffect, useState } from 'react'

const ROLES = ['教研', '运营'] as const

export default function RoleSwitcher() {
  const [role, setRole] = useState<(typeof ROLES)[number]>('教研')

  useEffect(() => {
    const saved = window.localStorage.getItem('demo-role')
    if (saved === '教研' || saved === '运营') setRole(saved)
  }, [])

  return (
    <label className="block text-xs text-gray-500">
      后台角色
      <select
        className="field mt-1"
        value={role}
        onChange={(event) => {
          const next = event.target.value === '运营' ? '运营' : '教研'
          setRole(next)
          window.localStorage.setItem('demo-role', next)
        }}
      >
        {ROLES.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </label>
  )
}
