import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/app-shell'
import { AcademicPage } from '@/features/academic/pages/academic-page'
import { AdminPage } from '@/features/admin/pages/admin-page'
import { LoginPage } from '@/features/auth/pages/login-page'
import { ChatPage } from '@/features/chat/pages/chat-page'
import { DashboardPage } from '@/features/dashboard/pages/dashboard-page'
import { FinancePage } from '@/features/finance/pages/finance-page'
import { ProfilePage } from '@/features/profile/pages/profile-page'
import { RequireAnyPermission, RequireAuth, RequirePermission } from '@/routes/protected-route'

export function AppRouter() {
  return (
    <Routes>
      <Route path="/auth/login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/profile" element={<ProfilePage />} />

          <Route element={<RequireAnyPermission permissions={['manage:subjects', 'input:grades', 'view:grades']} />}>
            <Route path="/academic" element={<AcademicPage />} />
          </Route>

          <Route element={<RequireAnyPermission permissions={['manage:payments', 'view:payments']} />}>
            <Route path="/finance" element={<FinancePage />} />
          </Route>

          <Route element={<RequirePermission permission="chat:send" />}>
            <Route path="/chat" element={<ChatPage />} />
          </Route>

          <Route element={<RequirePermission permission="manage:announcements" />}>
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
