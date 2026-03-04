import { makeFunctionReference } from 'convex/server'
import { calculateAttendancePercentage } from '@/lib/calculations'
import { getConvexClient } from '@/lib/convex-client'
import type { PaymentStatus, RoleName, SessionUser } from '@/types/domain'

export interface AppError {
  code: string
  message: string
}

class ApiError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

function normalizeError(error: unknown): never {
  if (error instanceof ApiError) throw error

  const message = error instanceof Error ? error.message : 'Unknown error'
  if (message.includes('EMAIL_EXISTS')) {
    throw new ApiError('EMAIL_EXISTS', 'Email sudah terdaftar')
  }
  if (message.includes('INVALID_CREDENTIALS')) {
    throw new ApiError('INVALID_CREDENTIALS', 'Email atau password tidak valid')
  }
  if (message.includes('USER_NOT_FOUND')) {
    throw new ApiError('USER_NOT_FOUND', 'User tidak ditemukan')
  }

  throw new ApiError('CONVEX_ERROR', message)
}

async function runQuery<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  try {
    const ref = makeFunctionReference<'query'>(name)
    return (await getConvexClient().query(ref as never, (args ?? {}) as never)) as T
  } catch (error) {
    normalizeError(error)
  }
}

async function runMutation<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  try {
    const ref = makeFunctionReference<'mutation'>(name)
    return (await getConvexClient().mutation(ref as never, (args ?? {}) as never)) as T
  } catch (error) {
    normalizeError(error)
  }
}

export async function getRegisterMetadata() {
  return runQuery<{
    campuses: Array<{ _id: string; name: string; address: string }>
    roles: Array<{ _id: string; name: RoleName }>
  }>('auth:getRegisterMetadata', {})
}

export async function register(input: {
  email: string
  password: string
  fullName: string
  campusId: string
  role: RoleName
}): Promise<SessionUser> {
  const metadata = await getRegisterMetadata()
  const role = metadata.roles.find((entry) => entry.name === input.role)
  const campus = metadata.campuses.find((entry) => entry._id === input.campusId)

  if (!role) {
    throw new ApiError('ROLE_NOT_FOUND', 'Role tidak ditemukan')
  }
  if (!campus) {
    throw new ApiError('CAMPUS_NOT_FOUND', 'Campus tidak ditemukan')
  }

  await runMutation('auth:register', {
    email: input.email,
    password: input.password,
    fullName: input.fullName,
    campusId: input.campusId,
    roleId: role._id,
  })

  return login({ email: input.email, password: input.password })
}

export async function login(input: { email: string; password: string }): Promise<SessionUser> {
  return runMutation<SessionUser>('auth:login', {
    email: input.email,
    password: input.password,
  })
}

export async function createSemester(input: {
  actorUserId: string
  name: string
  academicYear: string
  campusId: string
}) {
  return runMutation('academic:createSemester', {
    actorUserId: input.actorUserId,
    name: input.name,
    academicYear: input.academicYear,
    campusId: input.campusId,
  })
}

export async function activateSemester(input: { actorUserId: string; semesterId: string; campusId: string }) {
  return runMutation('academic:activateSemester', {
    actorUserId: input.actorUserId,
    semesterId: input.semesterId,
    campusId: input.campusId,
  })
}

export async function closeSemester(input: { actorUserId: string; semesterId: string }) {
  return runMutation('academic:closeSemester', {
    actorUserId: input.actorUserId,
    semesterId: input.semesterId,
  })
}

export async function createSubject(input: {
  actorUserId: string
  name: string
  credits: number
  lecturerId: string
  campusId: string
}) {
  return runMutation('academic:createSubject', {
    actorUserId: input.actorUserId,
    name: input.name,
    credits: input.credits,
    lecturerId: input.lecturerId,
    campusId: input.campusId,
  })
}

export async function enrollStudent(input: {
  actorUserId: string
  studentId: string
  subjectId: string
  semesterId: string
}) {
  return runMutation('academic:enrollStudent', {
    actorUserId: input.actorUserId,
    studentId: input.studentId,
    subjectId: input.subjectId,
    semesterId: input.semesterId,
  })
}

export async function inputGrade(input: {
  actorUserId: string
  enrollmentId: string
  gradeValue: string
}) {
  return runMutation('academic:inputGrade', {
    actorUserId: input.actorUserId,
    enrollmentId: input.enrollmentId,
    gradeValue: input.gradeValue,
  })
}

export async function lockGrades(input: { actorUserId: string; semesterId: string }) {
  return runMutation('academic:lockGrades', {
    actorUserId: input.actorUserId,
    semesterId: input.semesterId,
  })
}

export async function getTranscript(input: { actorUserId: string; studentId: string }) {
  return runQuery<{
    gpa: number
    totalCredits: number
    rows: Array<{
      enrollmentId: string
      subject: string
      credits: number
      semester: string
      grade: string
      locked: boolean
    }>
  }>('academic:getTranscript', {
    actorUserId: input.actorUserId,
    studentId: input.studentId,
  })
}

export async function uploadMaterial(input: {
  actorUserId: string
  subjectId: string
  title: string
  fileUrl: string
}) {
  return runMutation('academic:uploadMaterial', {
    actorUserId: input.actorUserId,
    subjectId: input.subjectId,
    title: input.title,
    fileUrl: input.fileUrl,
  })
}

export async function recordAttendance(input: {
  actorUserId: string
  enrollmentId: string
  date: number
  status: 'present' | 'absent' | 'late'
}) {
  return runMutation('attendance:recordAttendance', {
    actorUserId: input.actorUserId,
    enrollmentId: input.enrollmentId,
    date: input.date,
    status: input.status,
  })
}

export async function getAttendanceByStudent(input: { actorUserId: string; studentId: string }) {
  const rows = await runQuery<
    Array<{
      enrollmentId: string
      subject: string
      semester: string
      percentage: number
      records: Array<{ _id: string; enrollmentId: string; date: number; status: 'present' | 'absent' | 'late' }>
    }>
  >('attendance:getAttendanceByStudent', {
    actorUserId: input.actorUserId,
    studentId: input.studentId,
  })

  const records = rows.flatMap((entry) => entry.records)
  return {
    rows,
    records,
    percentage: calculateAttendancePercentage(records),
  }
}

export async function createInvoice(input: {
  actorUserId: string
  studentId: string
  semesterId: string
  amount: number
}) {
  return runMutation('finance:createInvoice', {
    actorUserId: input.actorUserId,
    studentId: input.studentId,
    semesterId: input.semesterId,
    amount: input.amount,
  })
}

export async function recordPayment(input: {
  actorUserId: string
  paymentId: string
  status: PaymentStatus
}) {
  return runMutation('finance:recordPayment', {
    actorUserId: input.actorUserId,
    paymentId: input.paymentId,
    status: input.status,
  })
}

export async function assignScholarship(input: {
  actorUserId: string
  studentId: string
  percentage: number
  semesterId: string
}) {
  return runMutation('finance:assignScholarship', {
    actorUserId: input.actorUserId,
    studentId: input.studentId,
    percentage: input.percentage,
    semesterId: input.semesterId,
  })
}

export async function assignRole(input: {
  actorUserId: string
  userId: string
  roleName: RoleName
}) {
  const metadata = await getRegisterMetadata()
  const role = metadata.roles.find((entry) => entry.name === input.roleName)
  if (!role) {
    throw new ApiError('ROLE_NOT_FOUND', 'Role tidak ditemukan')
  }

  return runMutation('admin:assignRole', {
    actorUserId: input.actorUserId,
    userId: input.userId,
    roleId: role._id,
  })
}

export async function createAnnouncement(input: {
  actorUserId: string
  title: string
  content: string
  campusId: string
}) {
  return runMutation('admin:createAnnouncement', {
    actorUserId: input.actorUserId,
    title: input.title,
    content: input.content,
    campusId: input.campusId,
  })
}

export async function uploadDocument(input: {
  actorUserId: string
  campusId: string
  title: string
  fileUrl: string
}) {
  return runMutation('admin:uploadDocument', {
    actorUserId: input.actorUserId,
    campusId: input.campusId,
    title: input.title,
    fileUrl: input.fileUrl,
  })
}

export async function generateDocumentUploadUrl(input: { actorUserId: string }) {
  return runMutation<string>('admin:generateDocumentUploadUrl', {
    actorUserId: input.actorUserId,
  })
}

export async function sendMessage(input: {
  actorUserId: string
  receiverId: string
  message: string
}) {
  return runMutation('chat:sendMessage', {
    actorUserId: input.actorUserId,
    receiverId: input.receiverId,
    message: input.message,
  })
}

export async function subscribeMessages(input: { actorUserId: string; peerUserId: string }) {
  return runQuery<
    Array<{ _id: string; senderId: string; receiverId: string; message: string; createdAt: number }>
  >('chat:subscribeMessages', {
    actorUserId: input.actorUserId,
    peerUserId: input.peerUserId,
  })
}

export async function getConversationPeerByMessage(input: { actorUserId: string; messageId: string }) {
  return runQuery<{ peerUserId: string }>('chat:getConversationPeerByMessage', {
    actorUserId: input.actorUserId,
    messageId: input.messageId,
  })
}

export async function markAsRead(input: { actorUserId: string; notificationId: string }) {
  return runMutation('notifications:markAsRead', {
    actorUserId: input.actorUserId,
    notificationId: input.notificationId,
  })
}

export async function getDashboardData(input: { actorUserId: string }) {
  return runQuery<{
    stats: {
      gpa: number
      attendance: number
      activeSemesters: number
      pendingPayments: number
    }
    announcements: Array<{ _id: string; title: string; content: string; campusId: string; createdBy: string; createdAt: number }>
    payments: Array<{
      _id: string
      studentId: string
      semesterId: string
      amount: number
      status: PaymentStatus
      invoiceNumber: string
      createdAt: number
      updatedAt: number
    }>
    grades: Array<{ _id: string; enrollmentId: string; gradeValue: string; locked: boolean }>
    attendance: Array<{ _id: string; enrollmentId: string; date: number; status: 'present' | 'absent' | 'late' }>
    enrollments: Array<{ _id: string; studentId: string; subjectId: string; semesterId: string }>
    scholarships: Array<{ _id: string; studentId: string; percentage: number; semesterId: string }>
    semesters: Array<{
      _id: string
      name: string
      academicYear: string
      isActive: boolean
      isClosed: boolean
      campusId: string
      createdAt: number
    }>
    subjects: Array<{ _id: string; name: string; credits: number; lecturerId: string; campusId: string }>
    users: Array<{ _id: string; email: string; fullName: string; campusId: string }>
    userRoleMap: Record<string, string[]>
    materials: Array<{ _id: string; subjectId: string; uploadedBy: string; title: string; fileUrl: string; createdAt: number }>
    documents: Array<{
      _id: string
      campusId: string
      uploadedBy: string
      title: string
      fileUrl: string
      createdAt: number
      sourceType?: 'uploaded_file' | 'external_link'
    }>
    notifications: Array<{ _id: string; userId: string; type: string; referenceId: string; isRead: boolean; createdAt: number }>
    auditLogs: Array<{ _id: string; userId: string; action: string; targetType: string; targetId: string; timestamp: number }>
    studentProfile: {
      transcriptRows: Array<{
        enrollmentId: string
        subject: string
        credits: number
        semester: string
        grade: string
        locked: boolean
      }>
      cumulativeGpa: number
      attendancePercentage: number
      attendanceHistory: Array<{ _id: string; enrollmentId: string; date: number; status: 'present' | 'absent' | 'late' }>
      tuitionPayments: Array<{
        _id: string
        studentId: string
        semesterId: string
        amount: number
        status: PaymentStatus
        invoiceNumber: string
        createdAt: number
        updatedAt: number
      }>
      scholarships: Array<{ _id: string; studentId: string; percentage: number; semesterId: string }>
    }
    unreadNotificationCount: number
    campusSummary: {
      userCount: number
      subjectCount: number
      semesterCount: number
      enrollmentCount: number
    }
  }>('dashboard:getDashboardData', {
    actorUserId: input.actorUserId,
  })
}

export async function searchStudents(input: { actorUserId: string; campusId: string; query: string }) {
  return runQuery<Array<{ _id: string; fullName: string; email: string; campusId: string }>>(
    'dashboard:searchStudents',
    {
      actorUserId: input.actorUserId,
      campusId: input.campusId,
      query: input.query,
    },
  )
}

export async function searchSubjects(input: { actorUserId: string; campusId: string; query: string }) {
  return runQuery<Array<{ _id: string; name: string; credits: number; lecturerId: string; campusId: string }>>(
    'dashboard:searchSubjects',
    {
      actorUserId: input.actorUserId,
      campusId: input.campusId,
      query: input.query,
    },
  )
}

export async function filterPayments(input: {
  actorUserId: string
  studentId?: string
  semesterId?: string
  status?: PaymentStatus
}) {
  return runQuery<Array<{ _id: string; studentId: string; semesterId: string; amount: number; status: PaymentStatus; invoiceNumber: string }>>(
    'dashboard:filterPayments',
    {
      actorUserId: input.actorUserId,
      studentId: input.studentId,
      semesterId: input.semesterId,
      status: input.status,
    },
  )
}
