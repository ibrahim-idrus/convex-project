import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/features/auth/auth-context'
import { useDashboardData } from '@/hooks/use-dashboard-data'
import {
  activateSemester,
  closeSemester,
  createSemester,
  createSubject,
  enrollStudent,
  getTranscript,
  inputGrade,
  lockGrades,
  recordAttendance,
  uploadMaterial,
} from '@/lib/mock-api'
import { hasPermission } from '@/types/rbac'

const semesterSchema = z.object({
  name: z.string().min(2),
  academicYear: z.string().min(4),
})

const subjectSchema = z.object({
  name: z.string().min(3),
  credits: z.number().min(1).max(8),
  lecturerId: z.string().min(1),
})

const enrollmentSchema = z.object({
  studentId: z.string().min(1),
  subjectId: z.string().min(1),
  semesterId: z.string().min(1),
})

const gradeSchema = z.object({
  enrollmentId: z.string().min(1),
  gradeValue: z.string().min(1),
})

const attendanceSchema = z.object({
  enrollmentId: z.string().min(1),
  status: z.enum(['present', 'absent', 'late']),
})

const materialSchema = z.object({
  subjectId: z.string().min(1),
  title: z.string().min(3),
  fileUrl: z.string().url('Masukkan URL file valid'),
})

export function AcademicPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const dashboard = useDashboardData(user?.userId)

  const semesterForm = useForm<z.infer<typeof semesterSchema>>({
    resolver: zodResolver(semesterSchema),
    defaultValues: { name: 'Spring Semester', academicYear: '2027/2028' },
  })

  const subjectForm = useForm<z.infer<typeof subjectSchema>>({
    resolver: zodResolver(subjectSchema),
    defaultValues: { name: '', credits: 3, lecturerId: '' },
  })

  const enrollmentForm = useForm<z.infer<typeof enrollmentSchema>>({
    resolver: zodResolver(enrollmentSchema),
    defaultValues: { studentId: '', subjectId: '', semesterId: '' },
  })

  const gradeForm = useForm<z.infer<typeof gradeSchema>>({
    resolver: zodResolver(gradeSchema),
    defaultValues: { enrollmentId: '', gradeValue: 'A' },
  })

  const attendanceForm = useForm<z.infer<typeof attendanceSchema>>({
    resolver: zodResolver(attendanceSchema),
    defaultValues: { enrollmentId: '', status: 'present' },
  })

  const materialForm = useForm<z.infer<typeof materialSchema>>({
    resolver: zodResolver(materialSchema),
    defaultValues: { subjectId: '', title: '', fileUrl: '' },
  })

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['dashboard', user?.userId] })
  }

  const createSemesterMutation = useMutation({
    mutationFn: (values: z.infer<typeof semesterSchema>) =>
      createSemester({
        actorUserId: user?.userId ?? '',
        name: values.name,
        academicYear: values.academicYear,
        campusId: user?.campusId ?? '',
      }),
    onSuccess: async () => {
      semesterForm.reset({ name: 'Spring Semester', academicYear: '2027/2028' })
      await refresh()
    },
  })

  const activateSemesterMutation = useMutation({
    mutationFn: (semesterId: string) =>
      activateSemester({
        actorUserId: user?.userId ?? '',
        semesterId,
        campusId: user?.campusId ?? '',
      }),
    onSuccess: refresh,
  })

  const closeSemesterMutation = useMutation({
    mutationFn: (semesterId: string) =>
      closeSemester({
        actorUserId: user?.userId ?? '',
        semesterId,
      }),
    onSuccess: refresh,
  })

  const createSubjectMutation = useMutation({
    mutationFn: (values: z.infer<typeof subjectSchema>) =>
      createSubject({
        actorUserId: user?.userId ?? '',
        name: values.name,
        credits: values.credits,
        lecturerId: values.lecturerId,
        campusId: user?.campusId ?? '',
      }),
    onSuccess: async () => {
      subjectForm.reset({ name: '', credits: 3, lecturerId: '' })
      await refresh()
    },
  })

  const enrollMutation = useMutation({
    mutationFn: (values: z.infer<typeof enrollmentSchema>) =>
      enrollStudent({
        actorUserId: user?.userId ?? '',
        studentId: values.studentId,
        subjectId: values.subjectId,
        semesterId: values.semesterId,
      }),
    onSuccess: async () => {
      enrollmentForm.reset({ studentId: '', subjectId: '', semesterId: '' })
      await refresh()
    },
  })

  const gradeMutation = useMutation({
    mutationFn: (values: z.infer<typeof gradeSchema>) =>
      inputGrade({
        actorUserId: user?.userId ?? '',
        enrollmentId: values.enrollmentId,
        gradeValue: values.gradeValue,
      }),
    onSuccess: async () => {
      gradeForm.reset({ enrollmentId: '', gradeValue: 'A' })
      await refresh()
    },
  })

  const lockMutation = useMutation({
    mutationFn: (semesterId: string) =>
      lockGrades({
        actorUserId: user?.userId ?? '',
        semesterId,
      }),
    onSuccess: refresh,
  })

  const attendanceMutation = useMutation({
    mutationFn: (values: z.infer<typeof attendanceSchema>) =>
      recordAttendance({
        actorUserId: user?.userId ?? '',
        enrollmentId: values.enrollmentId,
        status: values.status,
        date: Date.now(),
      }),
    onSuccess: async () => {
      attendanceForm.reset({ enrollmentId: '', status: 'present' })
      await refresh()
    },
  })

  const materialMutation = useMutation({
    mutationFn: (values: z.infer<typeof materialSchema>) =>
      uploadMaterial({
        actorUserId: user?.userId ?? '',
        subjectId: values.subjectId,
        title: values.title,
        fileUrl: values.fileUrl,
      }),
    onSuccess: async () => {
      materialForm.reset({ subjectId: '', title: '', fileUrl: '' })
      await refresh()
    },
  })

  const [transcriptStudentId, setTranscriptStudentId] = useState('')

  const transcriptQuery = useQuery({
    queryKey: ['transcript', user?.userId, transcriptStudentId],
    queryFn: () => getTranscript({ actorUserId: user?.userId ?? '', studentId: transcriptStudentId }),
    enabled: !!user && !!transcriptStudentId && hasPermission(user.roles, 'view:grades'),
  })

  if (!user) return null
  if (dashboard.isLoading) return <p className="text-sm text-[#5f7594]">Loading academic data...</p>
  if (dashboard.error || !dashboard.data) {
    return <p className="text-sm text-red-600">Failed to load academic data.</p>
  }

  const { semesters, subjects, users, userRoleMap, grades, enrollments, materials } = dashboard.data
  const students = users.filter((entry) => userRoleMap[entry._id]?.includes('student'))
  const lecturers = users.filter((entry) => userRoleMap[entry._id]?.includes('lecturer'))

  const canManageSemesters = hasPermission(user.roles, 'manage:semesters')
  const canManageSubjects = hasPermission(user.roles, 'manage:subjects')
  const canInputGrades = hasPermission(user.roles, 'input:grades')
  const canTakeAttendance = hasPermission(user.roles, 'take:attendance')
  const canViewGrades = hasPermission(user.roles, 'view:grades')

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-2xl p-5">
          <h2 className="mb-3 text-lg font-extrabold text-[#102f5f]">Semester Management</h2>
          {canManageSemesters ? (
            <form
              className="grid gap-3 md:grid-cols-3"
              onSubmit={semesterForm.handleSubmit((values) => createSemesterMutation.mutate(values))}
            >
              <Input placeholder="Semester name" {...semesterForm.register('name')} />
              <Input placeholder="Academic year" {...semesterForm.register('academicYear')} />
              <Button disabled={createSemesterMutation.isPending}>Create Semester</Button>
            </form>
          ) : (
            <p className="mb-3 text-sm text-[#6f849f]">Read-only access for this role.</p>
          )}

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-[#6a809e]">
                  <th className="px-2 py-2">Name</th>
                  <th className="px-2 py-2">Year</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {semesters.map((semester) => (
                  <tr key={semester._id} className="border-t border-[#e4ebf5]">
                    <td className="px-2 py-2 text-[#12315e]">{semester.name}</td>
                    <td className="px-2 py-2 text-[#12315e]">{semester.academicYear}</td>
                    <td className="px-2 py-2">
                      <Badge variant={semester.isClosed ? 'destructive' : semester.isActive ? 'secondary' : 'outline'}>
                        {semester.isClosed ? 'Closed' : semester.isActive ? 'Active' : 'Draft'}
                      </Badge>
                    </td>
                    <td className="px-2 py-2">
                      {canManageSemesters ? (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={activateSemesterMutation.isPending || semester.isClosed}
                            onClick={() => activateSemesterMutation.mutate(semester._id)}
                          >
                            Activate
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={closeSemesterMutation.isPending || semester.isClosed}
                            onClick={() => closeSemesterMutation.mutate(semester._id)}
                          >
                            Close
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={lockMutation.isPending || semester.isClosed}
                            onClick={() => lockMutation.mutate(semester._id)}
                          >
                            Lock Grades
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-[#8aa0ba]">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="rounded-2xl p-5">
          <h2 className="mb-3 text-lg font-extrabold text-[#102f5f]">Subject Management</h2>
          {canManageSubjects ? (
            <form
              className="grid gap-3 md:grid-cols-4"
              onSubmit={subjectForm.handleSubmit((values) => createSubjectMutation.mutate(values))}
            >
              <Input placeholder="Subject name" {...subjectForm.register('name')} />
              <Input
                type="number"
                placeholder="Credits"
                {...subjectForm.register('credits', { valueAsNumber: true })}
              />
              <select
                className="h-11 rounded-xl border border-[#d5deeb] bg-[#eff4fb] px-3 text-sm text-[#12315e]"
                {...subjectForm.register('lecturerId')}
              >
                <option value="">Select lecturer</option>
                {lecturers.map((lecturer) => (
                  <option key={lecturer._id} value={lecturer._id}>
                    {lecturer.fullName}
                  </option>
                ))}
              </select>
              <Button disabled={createSubjectMutation.isPending}>Create Subject</Button>
            </form>
          ) : (
            <p className="mb-3 text-sm text-[#6f849f]">Read-only access for this role.</p>
          )}

          <div className="mt-4 grid gap-2">
            {subjects.map((subject) => (
              <div key={subject._id} className="rounded-xl border border-[#e2e9f3] bg-[#f7faff] p-3 text-sm text-[#13335f]">
                <p className="font-semibold">{subject.name}</p>
                <p>Credits: {subject.credits} SKS</p>
                <p>Lecturer: {users.find((entry) => entry._id === subject.lecturerId)?.fullName ?? '-'}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="rounded-2xl p-5">
          <h3 className="mb-3 text-base font-extrabold text-[#102f5f]">Enrollment</h3>
          {canManageSubjects ? (
            <form className="space-y-2" onSubmit={enrollmentForm.handleSubmit((values) => enrollMutation.mutate(values))}>
              <select
                className="h-11 w-full rounded-xl border border-[#d5deeb] bg-[#eff4fb] px-3 text-sm text-[#12315e]"
                {...enrollmentForm.register('studentId')}
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
                {...enrollmentForm.register('subjectId')}
              >
                <option value="">Select subject</option>
                {subjects.map((subject) => (
                  <option key={subject._id} value={subject._id}>
                    {subject.name}
                  </option>
                ))}
              </select>
              <select
                className="h-11 w-full rounded-xl border border-[#d5deeb] bg-[#eff4fb] px-3 text-sm text-[#12315e]"
                {...enrollmentForm.register('semesterId')}
              >
                <option value="">Select semester</option>
                {semesters.map((semester) => (
                  <option key={semester._id} value={semester._id}>
                    {semester.name} {semester.academicYear}
                  </option>
                ))}
              </select>
              <Button className="w-full" disabled={enrollMutation.isPending}>
                Enroll Student
              </Button>
            </form>
          ) : (
            <p className="text-sm text-[#6f849f]">Not available for your active role.</p>
          )}
        </Card>

        <Card className="rounded-2xl p-5">
          <h3 className="mb-3 text-base font-extrabold text-[#102f5f]">Grade Input</h3>
          {canInputGrades ? (
            <form className="space-y-2" onSubmit={gradeForm.handleSubmit((values) => gradeMutation.mutate(values))}>
              <select
                className="h-11 w-full rounded-xl border border-[#d5deeb] bg-[#eff4fb] px-3 text-sm text-[#12315e]"
                {...gradeForm.register('enrollmentId')}
              >
                <option value="">Select enrollment</option>
                {enrollments.map((enrollment) => (
                  <option key={enrollment._id} value={enrollment._id}>
                    {enrollment._id}
                  </option>
                ))}
              </select>
              <select
                className="h-11 w-full rounded-xl border border-[#d5deeb] bg-[#eff4fb] px-3 text-sm text-[#12315e]"
                {...gradeForm.register('gradeValue')}
              >
                {['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'D', 'E'].map((grade) => (
                  <option key={grade} value={grade}>
                    {grade}
                  </option>
                ))}
              </select>
              <Button className="w-full" disabled={gradeMutation.isPending}>
                Save Grade
              </Button>
            </form>
          ) : (
            <p className="text-sm text-[#6f849f]">Not available for your active role.</p>
          )}
        </Card>

        <Card className="rounded-2xl p-5">
          <h3 className="mb-3 text-base font-extrabold text-[#102f5f]">Attendance Record</h3>
          {canTakeAttendance ? (
            <form className="space-y-2" onSubmit={attendanceForm.handleSubmit((values) => attendanceMutation.mutate(values))}>
              <select
                className="h-11 w-full rounded-xl border border-[#d5deeb] bg-[#eff4fb] px-3 text-sm text-[#12315e]"
                {...attendanceForm.register('enrollmentId')}
              >
                <option value="">Select enrollment</option>
                {enrollments.map((enrollment) => (
                  <option key={enrollment._id} value={enrollment._id}>
                    {enrollment._id}
                  </option>
                ))}
              </select>
              <select
                className="h-11 w-full rounded-xl border border-[#d5deeb] bg-[#eff4fb] px-3 text-sm text-[#12315e]"
                {...attendanceForm.register('status')}
              >
                <option value="present">Present</option>
                <option value="late">Late</option>
                <option value="absent">Absent</option>
              </select>
              <Button className="w-full" disabled={attendanceMutation.isPending}>
                Record Attendance
              </Button>
            </form>
          ) : (
            <p className="text-sm text-[#6f849f]">Not available for your active role.</p>
          )}
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card className="rounded-2xl p-5">
          <h3 className="mb-3 text-base font-extrabold text-[#102f5f]">Enrollment & Grade Entries</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-[#6a809e]">
                  <th className="px-2 py-2">Enrollment ID</th>
                  <th className="px-2 py-2">Student</th>
                  <th className="px-2 py-2">Subject</th>
                  <th className="px-2 py-2">Semester</th>
                  <th className="px-2 py-2">Grade</th>
                </tr>
              </thead>
              <tbody>
                {enrollments.map((enrollment) => {
                  const grade = grades.find((entry) => entry.enrollmentId === enrollment._id)
                  const student = users.find((entry) => entry._id === enrollment.studentId)
                  const subject = subjects.find((entry) => entry._id === enrollment.subjectId)
                  const semester = semesters.find((entry) => entry._id === enrollment.semesterId)
                  return (
                    <tr key={enrollment._id} className="border-t border-[#e4ebf5] text-[#16355f]">
                      <td className="px-2 py-2 font-medium">{enrollment._id}</td>
                      <td className="px-2 py-2">{student?.fullName ?? enrollment.studentId}</td>
                      <td className="px-2 py-2">{subject?.name ?? enrollment.subjectId}</td>
                      <td className="px-2 py-2">{semester ? `${semester.name} ${semester.academicYear}` : enrollment.semesterId}</td>
                      <td className="px-2 py-2">
                        {grade ? (
                          <Badge variant={grade.locked ? 'destructive' : 'secondary'}>
                            {grade.gradeValue} {grade.locked ? '(Locked)' : ''}
                          </Badge>
                        ) : (
                          <Badge variant="outline">Not Graded</Badge>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="rounded-2xl p-5">
          <h3 className="mb-3 text-base font-extrabold text-[#102f5f]">Upload Material Reference</h3>
          {canInputGrades ? (
            <form className="space-y-2" onSubmit={materialForm.handleSubmit((values) => materialMutation.mutate(values))}>
              <select
                className="h-11 w-full rounded-xl border border-[#d5deeb] bg-[#eff4fb] px-3 text-sm text-[#12315e]"
                {...materialForm.register('subjectId')}
              >
                <option value="">Select subject</option>
                {subjects.map((subject) => (
                  <option key={subject._id} value={subject._id}>
                    {subject.name}
                  </option>
                ))}
              </select>
              <Input placeholder="Material title" {...materialForm.register('title')} />
              <Input placeholder="File URL" {...materialForm.register('fileUrl')} />
              <Button className="w-full" disabled={materialMutation.isPending}>
                Upload Material
              </Button>
            </form>
          ) : (
            <p className="text-sm text-[#6f849f]">Only lecturer/super admin can upload materials.</p>
          )}

          <div className="mt-3 space-y-2">
            {materials.slice(0, 6).map((material) => (
              <div key={material._id} className="rounded-lg border border-[#e2e9f3] p-2 text-sm">
                <p className="font-semibold text-[#16345f]">{material.title}</p>
                <p className="text-xs text-[#5a7190]">{subjects.find((entry) => entry._id === material.subjectId)?.name ?? material.subjectId}</p>
                <a className="text-xs text-[#123d80] underline" href={material.fileUrl} target="_blank" rel="noreferrer">
                  {material.fileUrl}
                </a>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="rounded-2xl p-5">
        <h3 className="mb-3 text-base font-extrabold text-[#102f5f]">Transcript (Read Only)</h3>
        {canViewGrades ? (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <select
                className="h-11 rounded-xl border border-[#d5deeb] bg-[#eff4fb] px-3 text-sm text-[#12315e]"
                value={transcriptStudentId}
                onChange={(event) => setTranscriptStudentId(event.target.value)}
              >
                <option value="">Select student</option>
                {students.map((student) => (
                  <option key={student._id} value={student._id}>
                    {student.fullName}
                  </option>
                ))}
              </select>
              {transcriptQuery.data && (
                <Badge variant="secondary">
                  GPA {transcriptQuery.data.gpa.toFixed(2)} | Credits {transcriptQuery.data.totalCredits}
                </Badge>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-[#6a809e]">
                    <th className="px-2 py-2">Semester</th>
                    <th className="px-2 py-2">Subject</th>
                    <th className="px-2 py-2">Credits</th>
                    <th className="px-2 py-2">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {transcriptQuery.data?.rows.map((row) => (
                    <tr key={row.enrollmentId} className="border-t border-[#e4ebf5] text-[#16355f]">
                      <td className="px-2 py-2">{row.semester}</td>
                      <td className="px-2 py-2">{row.subject}</td>
                      <td className="px-2 py-2">{row.credits}</td>
                      <td className="px-2 py-2">
                        <Badge variant={row.locked ? 'destructive' : 'secondary'}>{row.grade}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-sm text-[#6f849f]">Role ini tidak punya akses transkrip.</p>
        )}
      </Card>
    </div>
  )
}
