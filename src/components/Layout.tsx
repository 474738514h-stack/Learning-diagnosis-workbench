import { NavLink, Outlet, useLocation } from 'react-router-dom'
import RoleSwitcher from './RoleSwitcher'

const teacherLinks = [
  { to: '/teacher/upload', label: '错题录入' },
  { to: '/teacher/dashboard', label: '班级看板' },
]

const studentLinks = [{ to: '/student/report', label: '个人报告' }]

const adminLinks = [
  { to: '/admin/prompts', label: 'Prompt 版本' },
  { to: '/admin/evals', label: '评测回归' },
  { to: '/admin/knowledge', label: '知识点库' },
  { to: '/admin/monitor', label: '效果监控' },
  { to: '/admin/review-queue', label: '复核队列' },
]

function NavGroup({ title, links }: { title: string; links: { to: string; label: string }[] }) {
  return (
    <div className="mb-6">
      <div className="mb-2 px-3 text-xs font-medium uppercase tracking-wide text-gray-400">
        {title}
      </div>
      <nav className="flex flex-col gap-0.5">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `rounded-lg px-3 py-2 text-sm transition-colors duration-fade ${
                isActive
                  ? 'bg-brand/10 font-medium text-brand'
                  : 'text-gray-700 hover:bg-gray-100'
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export default function Layout() {
  const location = useLocation()
  const isAdmin = location.pathname.startsWith('/admin')

  return (
    <div className="flex min-h-screen bg-page">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-white">
        <div className="border-b border-border px-4 py-4">
          <div className="text-sm font-semibold text-gray-900">学情诊断工作台</div>
          <div className="mt-1 text-xs text-gray-500">演示环境</div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-4">
          <NavGroup title="教师端" links={teacherLinks} />
          <NavGroup title="学生端" links={studentLinks} />
          <NavGroup title="运营后台" links={adminLinks} />
        </div>
        <div className="space-y-2 border-t border-border px-4 py-3">
          {isAdmin && <RoleSwitcher />}
          <span className="inline-flex items-center rounded-md border border-border bg-page px-2 py-0.5 text-xs text-gray-600">
            演示数据
          </span>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
