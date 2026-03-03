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
  assignRole,
  createAnnouncement,
  searchStudents,
  searchSubjects,
  uploadDocument,
} from '@/lib/mock-api'
import { hasPermission } from '@/types/rbac'

const roleSchema = z.object({
  userId: z.string().min(1),
  roleName: z.enum(['super_admin', 'campus_admin', 'lecturer', 'student', 'finance']),
})

const announcementSchema = z.object({
  title: z.string().min(3),
  content: z.string().min(10),
})

const documentSchema = z.object({
  title: z.string().min(3),
  fileUrl: z.string().url('Masukkan URL dokumen yang valid'),
})

export function AdminPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const dashboard = useDashboardData(user?.userId)

  const [studentKeyword, setStudentKeyword] = useState('')
  const [subjectKeyword, setSubjectKeyword] = useState('')

  const roleForm = useForm<z.infer<typeof roleSchema>>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      userId: '',
      roleName: 'campus_admin',
    },
  })

  const announcementForm = useForm<z.infer<typeof announcementSchema>>({
    resolver: zodResolver(announcementSchema),
    defaultValues: {
      title: '',
      content: '',
    },
  })

  const documentForm = useForm<z.infer<typeof documentSchema>>({
    resolver: zodResolver(documentSchema),
    defaultValues: {
      title: '',
      fileUrl: '',
    },
  })

  const studentSearchQuery = useQuery({
    queryKey: ['search-students', user?.userId, user?.campusId, studentKeyword],
    queryFn: () =>
      searchStudents({
        actorUserId: user?.userId ?? '',
        campusId: user?.campusId ?? '',
        query: studentKeyword,
      }),
    enabled: !!user && hasPermission(user.roles, 'view:reports'),
  })

  const subjectSearchQuery = useQuery({
    queryKey: ['search-subjects', user?.userId, user?.campusId, subjectKeyword],
    queryFn: () =>
      searchSubjects({
        actorUserId: user?.userId ?? '',
        campusId: user?.campusId ?? '',
        query: subjectKeyword,
      }),
    enabled: !!user && hasPermission(user.roles, 'view:reports'),
  })

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['dashboard', user?.userId] })
    await queryClient.invalidateQueries({ queryKey: ['search-students'] })
    await queryClient.invalidateQueries({ queryKey: ['search-subjects'] })
  }

  const roleMutation = useMutation({
    mutationFn: (values: z.infer<typeof roleSchema>) =>
      assignRole({
        actorUserId: user?.userId ?? '',
        userId: values.userId,
        roleName: values.roleName,
      }),
    onSuccess: async () => {
      roleForm.reset({ userId: '', roleName: 'campus_admin' })
      await refresh()
    },
  })

  const announcementMutation = useMutation({
    mutationFn: (values: z.infer<typeof announcementSchema>) =>
      createAnnouncement({
        actorUserId: user?.userId ?? '',
        title: values.title,
        content: values.content,
        campusId: user?.campusId ?? '',
      }),
    onSuccess: async () => {
      announcementForm.reset({ title: '', content: '' })
      await refresh()
    },
  })

  const documentMutation = useMutation({
    mutationFn: (values: z.infer<typeof documentSchema>) =>
      uploadDocument({
        actorUserId: user?.userId ?? '',
        campusId: user?.campusId ?? '',
        title: values.title,
        fileUrl: values.fileUrl,
      }),
    onSuccess: async () => {
      documentForm.reset({ title: '', fileUrl: '' })
      await refresh()
    },
  })

  if (!user) return null
  if (dashboard.isLoading) return <p className="text-sm text-[#5f7594]">Loading administration...</p>
  if (dashboard.error || !dashboard.data) return <p className="text-sm text-red-600">Unable to load admin data.</p>

  const { users, auditLogs, announcements, documents } = dashboard.data
  const canAssignRole = hasPermission(user.roles, 'full:system')

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-2xl p-5">
          <h2 className="mb-3 text-lg font-extrabold text-[#102f5f]">Assign Role (Multi-Role Support)</h2>
          {canAssignRole ? (
            <form className="grid gap-3 md:grid-cols-[1fr_220px_auto]" onSubmit={roleForm.handleSubmit((values) => roleMutation.mutate(values))}>
              <select
                className="h-11 rounded-xl border border-[#d5deeb] bg-[#eff4fb] px-3 text-sm text-[#12315e]"
                {...roleForm.register('userId')}
              >
                <option value="">Select user</option>
                {users.map((entry) => (
                  <option key={entry._id} value={entry._id}>
                    {entry.fullName} ({entry.email})
                  </option>
                ))}
              </select>
              <select
                className="h-11 rounded-xl border border-[#d5deeb] bg-[#eff4fb] px-3 text-sm text-[#12315e]"
                {...roleForm.register('roleName')}
              >
                <option value="super_admin">Super Admin</option>
                <option value="campus_admin">Campus Admin</option>
                <option value="lecturer">Lecturer</option>
                <option value="student">Student</option>
                <option value="finance">Finance</option>
              </select>
              <Button disabled={roleMutation.isPending}>Assign</Button>
            </form>
          ) : (
            <p className="text-sm text-[#6f849f]">Only Super Admin can assign roles.</p>
          )}
        </Card>

        <Card className="rounded-2xl p-5">
          <h2 className="mb-3 text-lg font-extrabold text-[#102f5f]">Campus Announcement</h2>
          <form className="space-y-2" onSubmit={announcementForm.handleSubmit((values) => announcementMutation.mutate(values))}>
            <Input placeholder="Title" {...announcementForm.register('title')} />
            <textarea
              className="min-h-28 w-full rounded-xl border border-[#d5deeb] bg-[#eff4fb] px-3 py-2 text-sm text-[#12315e] outline-none"
              placeholder="Announcement content"
              {...announcementForm.register('content')}
            />
            <Button className="w-full" disabled={announcementMutation.isPending}>
              Publish Announcement
            </Button>
          </form>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Card className="rounded-2xl p-5">
          <h3 className="mb-3 text-base font-extrabold text-[#102f5f]">Search & Filter</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Input
                placeholder="Search student name/email"
                value={studentKeyword}
                onChange={(event) => setStudentKeyword(event.target.value)}
              />
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-[#e2e9f3] p-2">
                {studentSearchQuery.data?.map((student) => (
                  <div key={student._id} className="rounded-lg border border-[#edf2f9] p-2 text-sm">
                    <p className="font-semibold text-[#16345f]">{student.fullName}</p>
                    <p className="text-xs text-[#5a7190]">{student.email}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Input
                placeholder="Search subject"
                value={subjectKeyword}
                onChange={(event) => setSubjectKeyword(event.target.value)}
              />
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-[#e2e9f3] p-2">
                {subjectSearchQuery.data?.map((subject) => (
                  <div key={subject._id} className="rounded-lg border border-[#edf2f9] p-2 text-sm">
                    <p className="font-semibold text-[#16345f]">{subject.name}</p>
                    <p className="text-xs text-[#5a7190]">Credits: {subject.credits}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl p-5">
          <h3 className="mb-3 text-base font-extrabold text-[#102f5f]">Campus Document Upload</h3>
          <form className="space-y-2" onSubmit={documentForm.handleSubmit((values) => documentMutation.mutate(values))}>
            <Input placeholder="Document title" {...documentForm.register('title')} />
            <Input placeholder="Document URL" {...documentForm.register('fileUrl')} />
            <Button className="w-full" disabled={documentMutation.isPending}>
              Upload Document
            </Button>
          </form>
          <div className="mt-3 space-y-2">
            {documents.map((doc) => (
              <div key={doc._id} className="rounded-lg border border-[#e2e9f3] p-2 text-sm">
                <p className="font-semibold text-[#16345f]">{doc.title}</p>
                <a className="text-xs text-[#123d80] underline" href={doc.fileUrl} target="_blank" rel="noreferrer">
                  {doc.fileUrl}
                </a>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <Card className="rounded-2xl p-5">
          <h3 className="mb-3 text-base font-extrabold text-[#102f5f]">Latest Announcements</h3>
          <div className="space-y-2">
            {announcements.slice(0, 10).map((item) => (
              <div key={item._id} className="rounded-lg border border-[#e2e9f3] p-3">
                <p className="font-semibold text-[#16345f]">{item.title}</p>
                <p className="text-sm text-[#5a7190]">{item.content}</p>
                <p className="mt-1 text-xs text-[#8aa0ba]">{new Date(item.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="rounded-2xl p-5">
          <h3 className="mb-3 text-base font-extrabold text-[#102f5f]">Audit Logs</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-[#6a809e]">
                  <th className="px-2 py-2">Action</th>
                  <th className="px-2 py-2">Actor</th>
                  <th className="px-2 py-2">Target</th>
                  <th className="px-2 py-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log._id} className="border-t border-[#e4ebf5] text-[#16355f]">
                    <td className="px-2 py-2">
                      <Badge variant="outline">{log.action}</Badge>
                    </td>
                    <td className="px-2 py-2">{users.find((entry) => entry._id === log.userId)?.fullName ?? log.userId}</td>
                    <td className="px-2 py-2">
                      {log.targetType}:{' '}
                      <span className="text-xs text-[#6a809e]">{log.targetId}</span>
                    </td>
                    <td className="px-2 py-2 text-xs">{new Date(log.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}
