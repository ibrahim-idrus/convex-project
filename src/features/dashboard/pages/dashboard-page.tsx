import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/features/auth/auth-context'
import { useDashboardData } from '@/hooks/use-dashboard-data'
import { markAsRead } from '@/lib/mock-api'
import { hasPermission } from '@/types/rbac'

function roleLabel(role: string) {
  return role
    .split('_')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ')
}

export function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const query = useDashboardData(user?.userId)
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<string[]>([])
  const [studentKeyword, setStudentKeyword] = useState('')

  const dismissNotification = (notificationId: string) => {
    setDismissedNotificationIds((prev) => (prev.includes(notificationId) ? prev : [...prev, notificationId]))
  }

  const restoreNotification = (notificationId: string) => {
    setDismissedNotificationIds((prev) => prev.filter((entry) => entry !== notificationId))
  }

  const markAsReadMutation = useMutation({
    mutationFn: (notificationId: string) =>
      markAsRead({
        actorUserId: user?.userId ?? '',
        notificationId,
      }),
    onMutate: async (notificationId) => {
      dismissNotification(notificationId)
    },
    onError: (_error, notificationId) => {
      restoreNotification(notificationId)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['dashboard', user?.userId] })
    },
  })

  if (!user) return null

  if (query.isLoading) {
    return <p className="text-sm text-[#5f7594]">Loading dashboard...</p>
  }

  if (query.error || !query.data) {
    return <p className="text-sm text-red-600">Failed to load dashboard data.</p>
  }

  const {
    stats,
    announcements,
    notifications,
    payments,
    studentProfile,
    campusSummary,
    users,
    userRoleMap,
    enrollments,
    semesters,
  } = query.data

  const visibleNotifications = notifications.filter((entry) => !dismissedNotificationIds.includes(entry._id))
  const unreadNotificationCount = visibleNotifications.filter((entry) => !entry.isRead).length

  const openChatFromNotification = async (notificationId: string, referenceId: string) => {
    try {
      await markAsReadMutation.mutateAsync(notificationId)
    } finally {
      navigate(`/chat?messageId=${encodeURIComponent(referenceId)}`)
    }
  }

  const isSuperAdmin = user.roles.includes('super_admin')
  const isCampusAdmin = user.roles.includes('campus_admin')
  const isLecturer = user.roles.includes('lecturer')
  const isStudent = user.roles.includes('student')
  const isCampusAdminOrSuperAdmin = isSuperAdmin || isCampusAdmin
  const canViewStudentDirectory = isCampusAdminOrSuperAdmin || isLecturer
  const canViewPaymentOverview = isStudent || isCampusAdminOrSuperAdmin
  const canViewReports = hasPermission(user.roles, 'view:reports')
  const semesterMap = new Map(semesters.map((semester) => [semester._id, `${semester.name} ${semester.academicYear}`]))
  const studentNameMap = new Map(users.map((entry) => [entry._id, entry.fullName]))

  const students = users.filter((entry) => userRoleMap[entry._id]?.includes('student'))
  const lecturerStudentIds = new Set(enrollments.map((entry) => entry.studentId))
  const visibleStudents = isLecturer
    ? students.filter((entry) => lecturerStudentIds.has(entry._id))
    : students
  const loweredStudentKeyword = studentKeyword.trim().toLowerCase()
  const filteredStudents = loweredStudentKeyword
    ? visibleStudents.filter(
        (entry) =>
          entry.fullName.toLowerCase().includes(loweredStudentKeyword) ||
          entry.email.toLowerCase().includes(loweredStudentKeyword),
      )
    : visibleStudents

  const paymentRows = isStudent
    ? payments.filter((entry) => entry.studentId === user.userId)
    : payments.filter((entry) => entry.status === 'paid')

  return (
    <div className="space-y-4">
      {isStudent && (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Current GPA" value={stats.gpa.toFixed(2)} helper="Auto calculated" />
          <MetricCard label="Attendance" value={`${stats.attendance}%`} helper="Semester based" />
          <MetricCard label="Active Semesters" value={String(stats.activeSemesters)} helper="Campus scoped" />
          <MetricCard label="Pending Payments" value={String(stats.pendingPayments)} helper="Student finance" />
        </section>
      )}

      <Card className="rounded-2xl p-5">
        <div className="flex flex-wrap items-center gap-2">
          {user.roles.map((role) => (
            <Badge key={role} variant={role === user.roles[0] ? 'secondary' : 'outline'}>
              {roleLabel(role)}
            </Badge>
          ))}
          <Badge variant="outline">Unread Notifications: {unreadNotificationCount}</Badge>
        </div>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <Card className="rounded-2xl p-5">
          <h2 className="mb-3 text-lg font-extrabold text-[#102f5f]">Campus Announcements</h2>
          <div className="space-y-3">
            {announcements.length === 0 && <p className="text-sm text-[#6f849f]">No announcements yet.</p>}
            {announcements.map((item) => (
              <div key={item._id} className="rounded-xl border border-[#e2e9f3] bg-[#f7faff] p-3">
                <p className="font-bold text-[#10233f]">{item.title}</p>
                <p className="text-sm text-[#4f6788]">{item.content}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="rounded-2xl p-5">
          <h2 className="mb-3 text-lg font-extrabold text-[#102f5f]">Recent Notifications</h2>
          <div className="space-y-2">
            {visibleNotifications.length === 0 && <p className="text-sm text-[#6f849f]">No notifications.</p>}
            {visibleNotifications.slice(0, 10).map((item) => (
              <div key={item._id} className="rounded-lg border border-[#e2e9f3] p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  {item.type === 'chat_message' ? (
                    <button
                      type="button"
                      className="text-left"
                      onClick={() => void openChatFromNotification(item._id, item.referenceId)}
                    >
                      <p className="font-semibold text-[#193863] underline underline-offset-2">chat_message</p>
                      <p className="text-xs text-[#69809d]">Klik untuk buka halaman chat terbaru</p>
                    </button>
                  ) : (
                    <div>
                      <p className="font-semibold text-[#193863]">{item.type}</p>
                      <p className="text-xs text-[#69809d]">Reference: {item.referenceId}</p>
                    </div>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={markAsReadMutation.isPending}
                    onClick={() => markAsReadMutation.mutate(item._id)}
                  >
                    Mark as Read
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {canViewStudentDirectory && (
        <Card className="rounded-2xl p-5">          
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-extrabold text-[#102f5f]">Daftar Murid</h2>
              <p className="text-sm text-[#5d7392]">
                {isLecturer
                  ? 'Hanya menampilkan student pada kelas yang Anda ampu.'
                  : 'Menampilkan student terdaftar di kampus aktif.'}
              </p>
            </div>
            <Badge variant="secondary">{filteredStudents.length} Student</Badge>
          </div>

          <div className="mt-3 max-w-xl">
            <Input
              value={studentKeyword}
              onChange={(event) => setStudentKeyword(event.target.value)}
              placeholder="Cari nama atau email student..."
            />
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-[#e2e9f3]">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-[#f5f8fd] text-left text-[#6a809e]">
                  <th className="px-3 py-2">Nama</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Role</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-center text-[#6f849f]">
                      Tidak ada data student sesuai filter.
                    </td>
                  </tr>
                )}
                {filteredStudents.map((student) => (
                  <tr key={student._id} className="border-t border-[#e4ebf5] text-[#16355f]">
                    <td className="px-3 py-2 font-semibold">{student.fullName}</td>
                    <td className="px-3 py-2">{student.email}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline">{userRoleMap[student._id]?.join(', ') ?? 'student'}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {isStudent && (
        <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
          <Card className="rounded-2xl p-5">
            <h2 className="mb-3 text-lg font-extrabold text-[#102f5f]">Student Academic Summary</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-sm font-semibold text-[#16345f]">Transcript (Latest)</p>
                <div className="mt-2 space-y-2">
                  {studentProfile.transcriptRows.slice(0, 5).map((row) => (
                    <div key={row.enrollmentId} className="rounded-lg border border-[#e2e9f3] p-2 text-sm">
                      <p className="font-semibold text-[#16345f]">{row.subject}</p>
                      <p className="text-xs text-[#6a809e]">{row.semester}</p>
                      <p className="text-xs text-[#6a809e]">Grade {row.grade} | {row.credits} SKS</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-[#16345f]">Attendance History</p>
                <div className="mt-2 space-y-2">
                  {studentProfile.attendanceHistory.slice(0, 5).map((record) => (
                    <div key={record._id} className="rounded-lg border border-[#e2e9f3] p-2 text-sm">
                      <p className="text-[#16345f]">{new Date(record.date).toLocaleDateString()}</p>
                      <Badge variant={record.status === 'present' ? 'secondary' : record.status === 'absent' ? 'destructive' : 'outline'}>
                        {record.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card className="rounded-2xl p-5">
            <h2 className="mb-3 text-lg font-extrabold text-[#102f5f]">Tuition & Scholarship Status</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-[#16345f]">Payments</p>
                <div className="mt-2 space-y-2">
                  {studentProfile.tuitionPayments.slice(0, 5).map((payment) => (
                    <div key={payment._id} className="rounded-lg border border-[#e2e9f3] p-2 text-sm">
                      <p className="font-semibold text-[#16345f]">{payment.invoiceNumber}</p>
                      <p className="text-xs text-[#6a809e]">${payment.amount.toLocaleString()}</p>
                      <Badge variant={payment.status === 'paid' ? 'secondary' : payment.status === 'overdue' ? 'destructive' : 'outline'}>
                        {payment.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-[#16345f]">Scholarships</p>
                <div className="mt-2 space-y-2">
                  {studentProfile.scholarships.length === 0 && (
                    <p className="text-sm text-[#6f849f]">No scholarship assigned.</p>
                  )}
                  {studentProfile.scholarships.map((scholarship) => (
                    <div key={scholarship._id} className="rounded-lg border border-[#e2e9f3] p-2 text-sm">
                      <p className="text-[#16345f]">Semester: {scholarship.semesterId}</p>
                      <p className="text-xs text-[#6a809e]">Coverage: {scholarship.percentage}%</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </section>
      )}

      {canViewReports && (
        <Card className="rounded-2xl p-5">
          <h2 className="mb-3 text-lg font-extrabold text-[#102f5f]">Campus Summary</h2>
          <div className="grid gap-2 md:grid-cols-4">
            <MetricCard label="Users" value={String(campusSummary.userCount)} helper="Current campus" />
            <MetricCard label="Subjects" value={String(campusSummary.subjectCount)} helper="Available" />
            <MetricCard label="Semesters" value={String(campusSummary.semesterCount)} helper="History retained" />
            <MetricCard label="Enrollments" value={String(campusSummary.enrollmentCount)} helper="Active + history" />
          </div>
        </Card>
      )}

      {canViewPaymentOverview && (
        <Card className="rounded-2xl p-5">
          <h2 className="mb-1 text-lg font-extrabold text-[#102f5f]">Payment Overview</h2>
          <p className="mb-3 text-sm text-[#5d7392]">
            {isStudent
              ? 'Riwayat pembayaran semester Anda.'
              : 'Daftar student yang sudah melakukan pembayaran (status paid).'}
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-[#6a809e]">
                  {!isStudent && <th className="px-2 py-2">Student</th>}
                  <th className="px-2 py-2">Invoice</th>
                  <th className="px-2 py-2">Semester</th>
                  <th className="px-2 py-2">Amount</th>
                  <th className="px-2 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {paymentRows.length === 0 && (
                  <tr>
                    <td colSpan={isStudent ? 4 : 5} className="px-2 py-4 text-center text-[#6f849f]">
                      {isStudent ? 'Belum ada data pembayaran semester.' : 'Belum ada student dengan status paid.'}
                    </td>
                  </tr>
                )}
                {paymentRows.slice(0, 20).map((payment) => (
                  <tr key={payment._id} className="border-t border-[#e4ebf5] text-[#16355f]">
                    {!isStudent && <td className="px-2 py-2">{studentNameMap.get(payment.studentId) ?? payment.studentId}</td>}
                    <td className="px-2 py-2">{payment.invoiceNumber}</td>
                    <td className="px-2 py-2">{semesterMap.get(payment.semesterId) ?? payment.semesterId}</td>
                    <td className="px-2 py-2">${payment.amount.toLocaleString()}</td>
                    <td className="px-2 py-2 uppercase">{payment.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <Card className="rounded-2xl p-4">
      <p className="text-sm text-[#5d7392]">{label}</p>
      <p className="mt-1 text-3xl font-black text-[#10233f]">{value}</p>
      <p className="text-xs text-[#8a9fba]">{helper}</p>
    </Card>
  )
}
