import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import PromptsPage from './pages/admin/Prompts'
import EvalsPage from './pages/admin/Evals'
import KnowledgePage from './pages/admin/Knowledge'
import MonitorPage from './pages/admin/Monitor'
import ReviewQueuePage from './pages/admin/ReviewQueue'
import StudentReportPage from './pages/student/Report'
import DashboardPage from './pages/teacher/Dashboard'
import UploadPage from './pages/teacher/Upload'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/teacher/upload" replace />} />
        <Route path="/teacher/upload" element={<UploadPage />} />
        <Route path="/teacher/dashboard" element={<DashboardPage />} />
        <Route path="/teacher/review" element={<Navigate to="/admin/review-queue" replace />} />
        <Route path="/student/report" element={<StudentReportPage />} />
        <Route path="/admin" element={<Navigate to="/admin/prompts" replace />} />
        <Route path="/admin/prompts" element={<PromptsPage />} />
        <Route path="/admin/evals" element={<EvalsPage />} />
        <Route path="/admin/knowledge" element={<KnowledgePage />} />
        <Route path="/admin/monitor" element={<MonitorPage />} />
        <Route path="/admin/review-queue" element={<ReviewQueuePage />} />
      </Route>
    </Routes>
  )
}
