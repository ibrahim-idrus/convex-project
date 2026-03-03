import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useState } from 'react'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/features/auth/auth-context'
import { useDashboardData } from '@/hooks/use-dashboard-data'
import {
  assignScholarship,
  createInvoice,
  filterPayments,
  getAttendanceByStudent,
  recordPayment,
} from '@/lib/mock-api'
import { hasPermission } from '@/types/rbac'

const invoiceSchema = z.object({
  studentId: z.string().min(1),
  semesterId: z.string().min(1),
  amount: z.number().positive(),
})

const paymentSchema = z.object({
  paymentId: z.string().min(1),
  status: z.enum(['pending', 'partial', 'paid', 'overdue']),
})

const scholarshipSchema = z.object({
  studentId: z.string().min(1),
  semesterId: z.string().min(1),
  percentage: z.number().min(0).max(100),
})

export function FinancePage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const dashboard = useDashboardData(user?.userId)

  const invoiceForm = useForm<z.infer<typeof invoiceSchema>>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: { studentId: '', semesterId: '', amount: 4500 },
  })

  const paymentForm = useForm<z.infer<typeof paymentSchema>>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { paymentId: '', status: 'paid' },
  })

  const scholarshipForm = useForm<z.infer<typeof scholarshipSchema>>({
    resolver: zodResolver(scholarshipSchema),
    defaultValues: { studentId: '', semesterId: '', percentage: 15 },
  })

  const [filterStudentId, setFilterStudentId] = useState<string>('')
  const [filterSemesterId, setFilterSemesterId] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<'pending' | 'partial' | 'paid' | 'overdue' | ''>('')

  const filteredPaymentsQuery = useQuery({
    queryKey: ['payments-filtered', user?.userId, filterStudentId, filterSemesterId, filterStatus],
    queryFn: () =>
      filterPayments({
        actorUserId: user?.userId ?? '',
        studentId: filterStudentId || undefined,
        semesterId: filterSemesterId || undefined,
        status: filterStatus || undefined,
      }),
    enabled: !!user && hasPermission(user.roles, 'view:reports'),
  })

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['dashboard', user?.userId] })
    await queryClient.invalidateQueries({ queryKey: ['payments-filtered'] })
  }

  const createInvoiceMutation = useMutation({
    mutationFn: (values: z.infer<typeof invoiceSchema>) =>
      createInvoice({
        actorUserId: user?.userId ?? '',
        studentId: values.studentId,
        semesterId: values.semesterId,
        amount: values.amount,
      }),
    onSuccess: async () => {
      invoiceForm.reset({ studentId: '', semesterId: '', amount: 4500 })
      await refresh()
    },
  })

  const recordPaymentMutation = useMutation({
    mutationFn: (values: z.infer<typeof paymentSchema>) =>
      recordPayment({
        actorUserId: user?.userId ?? '',
        paymentId: values.paymentId,
        status: values.status,
      }),
    onSuccess: async () => {
      paymentForm.reset({ paymentId: '', status: 'paid' })
      await refresh()
    },
  })

  const scholarshipMutation = useMutation({
    mutationFn: (values: z.infer<typeof scholarshipSchema>) =>
      assignScholarship({
        actorUserId: user?.userId ?? '',
        studentId: values.studentId,
        semesterId: values.semesterId,
        percentage: values.percentage,
      }),
    onSuccess: async () => {
      scholarshipForm.reset({ studentId: '', semesterId: '', percentage: 15 })
      await refresh()
    },
  })

  const previewStudentId =
    dashboard.data?.payments[0]?.studentId ??
    dashboard.data?.users.find((entry) => dashboard.data?.userRoleMap[entry._id]?.includes('student'))?._id

  const attendancePreview = useQuery({
    queryKey: ['finance-attendance-preview', user?.userId, previewStudentId],
    queryFn: async () =>
      getAttendanceByStudent({ actorUserId: user?.userId ?? '', studentId: previewStudentId ?? '' }),
    enabled: !!user && !!previewStudentId,
  })

  if (!user) return null
  if (dashboard.isLoading) return <p className="text-sm text-[#5f7594]">Loading finance data...</p>
  if (dashboard.error || !dashboard.data) {
    return <p className="text-sm text-red-600">Failed to load finance data.</p>
  }

  const { users, userRoleMap, semesters, payments, scholarships } = dashboard.data
  const students = users.filter((entry) => userRoleMap[entry._id]?.includes('student'))
  const canManagePayments = hasPermission(user.roles, 'manage:payments')
  const canGenerateInvoices = hasPermission(user.roles, 'generate:invoices')
  const canManageScholarships = hasPermission(user.roles, 'manage:scholarships')
  const filteredPayments = filteredPaymentsQuery.data ?? payments

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="rounded-2xl p-5">
          <h2 className="mb-3 text-base font-extrabold text-[#102f5f]">Create Invoice</h2>
          {canGenerateInvoices ? (
            <form className="space-y-2" onSubmit={invoiceForm.handleSubmit((values) => createInvoiceMutation.mutate(values))}>
              <select
                className="h-11 w-full rounded-xl border border-[#d5deeb] bg-[#eff4fb] px-3 text-sm text-[#12315e]"
                {...invoiceForm.register('studentId')}
              >
                <option value="">Select student</option>
                {students.map((student) => (
                  <option key={student._id} value={student._id}>
                    {student.fullName}
                  </option>
                ))}
              </select>
              <select
                className="h-11 w-full rounded-xl border border-[#d5deeb] bg-[#eff4fb] px-3 text-sm text-[#12315e]"
                {...invoiceForm.register('semesterId')}
              >
                <option value="">Select semester</option>
                {semesters.map((semester) => (
                  <option key={semester._id} value={semester._id}>
                    {semester.name} {semester.academicYear}
                  </option>
                ))}
              </select>
              <Input type="number" step="0.01" placeholder="Amount" {...invoiceForm.register('amount', { valueAsNumber: true })} />
              <Button className="w-full" disabled={createInvoiceMutation.isPending}>
                Generate Invoice
              </Button>
            </form>
          ) : (
            <p className="text-sm text-[#6f849f]">Read-only for this active role.</p>
          )}
        </Card>

        <Card className="rounded-2xl p-5">
          <h2 className="mb-3 text-base font-extrabold text-[#102f5f]">Record Payment</h2>
          {canManagePayments ? (
            <form className="space-y-2" onSubmit={paymentForm.handleSubmit((values) => recordPaymentMutation.mutate(values))}>
              <Input placeholder="Payment ID" {...paymentForm.register('paymentId')} />
              <select
                className="h-11 w-full rounded-xl border border-[#d5deeb] bg-[#eff4fb] px-3 text-sm text-[#12315e]"
                {...paymentForm.register('status')}
              >
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
              <Button className="w-full" disabled={recordPaymentMutation.isPending}>
                Update Payment
              </Button>
            </form>
          ) : (
            <p className="text-sm text-[#6f849f]">Read-only for this active role.</p>
          )}
        </Card>

        <Card className="rounded-2xl p-5">
          <h2 className="mb-3 text-base font-extrabold text-[#102f5f]">Assign Scholarship</h2>
          {canManageScholarships ? (
            <form className="space-y-2" onSubmit={scholarshipForm.handleSubmit((values) => scholarshipMutation.mutate(values))}>
              <select
                className="h-11 w-full rounded-xl border border-[#d5deeb] bg-[#eff4fb] px-3 text-sm text-[#12315e]"
                {...scholarshipForm.register('studentId')}
              >
                <option value="">Select student</option>
                {students.map((student) => (
                  <option key={student._id} value={student._id}>
                    {student.fullName}
                  </option>
                ))}
              </select>
              <select
                className="h-11 w-full rounded-xl border border-[#d5deeb] bg-[#eff4fb] px-3 text-sm text-[#12315e]"
                {...scholarshipForm.register('semesterId')}
              >
                <option value="">Select semester</option>
                {semesters.map((semester) => (
                  <option key={semester._id} value={semester._id}>
                    {semester.name} {semester.academicYear}
                  </option>
                ))}
              </select>
              <Input type="number" step="1" placeholder="Percentage" {...scholarshipForm.register('percentage', { valueAsNumber: true })} />
              <Button className="w-full" disabled={scholarshipMutation.isPending}>
                Assign Scholarship
              </Button>
            </form>
          ) : (
            <p className="text-sm text-[#6f849f]">Read-only for this active role.</p>
          )}
        </Card>
      </div>

      <Card className="rounded-2xl p-5">
        <h2 className="mb-3 text-lg font-extrabold text-[#102f5f]">Payment Filtering</h2>
        <div className="grid gap-2 md:grid-cols-4">
          <select
            className="h-11 rounded-xl border border-[#d5deeb] bg-[#eff4fb] px-3 text-sm text-[#12315e]"
            value={filterStudentId}
            onChange={(event) => setFilterStudentId(event.target.value)}
          >
            <option value="">All students</option>
            {students.map((student) => (
              <option key={student._id} value={student._id}>
                {student.fullName}
              </option>
            ))}
          </select>
          <select
            className="h-11 rounded-xl border border-[#d5deeb] bg-[#eff4fb] px-3 text-sm text-[#12315e]"
            value={filterSemesterId}
            onChange={(event) => setFilterSemesterId(event.target.value)}
          >
            <option value="">All semesters</option>
            {semesters.map((semester) => (
              <option key={semester._id} value={semester._id}>
                {semester.name} {semester.academicYear}
              </option>
            ))}
          </select>
          <select
            className="h-11 rounded-xl border border-[#d5deeb] bg-[#eff4fb] px-3 text-sm text-[#12315e]"
            value={filterStatus}
            onChange={(event) => setFilterStatus(event.target.value as 'pending' | 'partial' | 'paid' | 'overdue' | '')}
          >
            <option value="">All status</option>
            <option value="pending">Pending</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
          <Button
            variant="outline"
            onClick={() => {
              setFilterStudentId('')
              setFilterSemesterId('')
              setFilterStatus('')
            }}
          >
            Reset Filter
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card className="rounded-2xl p-5">
          <h2 className="mb-3 text-lg font-extrabold text-[#102f5f]">Payment History Per Semester</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-[#6a809e]">
                  <th className="px-2 py-2">Payment ID</th>
                  <th className="px-2 py-2">Invoice</th>
                  <th className="px-2 py-2">Student</th>
                  <th className="px-2 py-2">Semester</th>
                  <th className="px-2 py-2">Amount</th>
                  <th className="px-2 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((payment) => (
                  <tr key={payment._id} className="border-t border-[#e4ebf5] text-[#16355f]">
                    <td className="px-2 py-2">{payment._id}</td>
                    <td className="px-2 py-2">{payment.invoiceNumber}</td>
                    <td className="px-2 py-2">{users.find((entry) => entry._id === payment.studentId)?.fullName ?? '-'}</td>
                    <td className="px-2 py-2">{semesters.find((entry) => entry._id === payment.semesterId)?.name ?? payment.semesterId}</td>
                    <td className="px-2 py-2">${payment.amount.toLocaleString()}</td>
                    <td className="px-2 py-2">
                      <Badge variant={payment.status === 'paid' ? 'secondary' : payment.status === 'overdue' ? 'destructive' : 'outline'}>
                        {payment.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-2xl p-5">
            <h2 className="mb-3 text-lg font-extrabold text-[#102f5f]">Attendance Snapshot (Student)</h2>
            {attendancePreview.isLoading && <p className="text-sm text-[#5f7594]">Loading...</p>}
            {attendancePreview.data && (
              <>
                <p className="text-3xl font-black text-[#12315e]">{attendancePreview.data.percentage}%</p>
                <p className="text-sm text-[#6c819f]">Current weighted attendance</p>
                <div className="mt-3 space-y-2 text-sm">
                  {attendancePreview.data.records.slice(0, 8).map((record) => (
                    <div key={record._id} className="flex items-center justify-between rounded-lg border border-[#e2e9f3] p-2">
                      <span>{new Date(record.date).toLocaleDateString()}</span>
                      <Badge variant={record.status === 'present' ? 'secondary' : record.status === 'absent' ? 'destructive' : 'outline'}>
                        {record.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>

          <Card className="rounded-2xl p-5">
            <h2 className="mb-3 text-lg font-extrabold text-[#102f5f]">Scholarship Status</h2>
            <div className="space-y-2">
              {scholarships.length === 0 && <p className="text-sm text-[#6f849f]">No scholarships assigned.</p>}
              {scholarships.map((scholarship) => (
                <div key={scholarship._id} className="rounded-lg border border-[#e2e9f3] p-2 text-sm">
                  <p className="font-semibold text-[#16345f]">
                    {users.find((entry) => entry._id === scholarship.studentId)?.fullName ?? scholarship.studentId}
                  </p>
                  <p className="text-[#5a7190]">
                    {semesters.find((entry) => entry._id === scholarship.semesterId)?.name ?? scholarship.semesterId} - {scholarship.percentage}%
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
