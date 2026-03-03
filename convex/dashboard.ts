import { v } from 'convex/values'
import { query } from './_generated/server'
import { getUserRoles, requirePermission } from './lib/rbac'

function attendanceWeight(status: 'present' | 'absent' | 'late') {
  if (status === 'present') return 1
  if (status === 'late') return 0.5
  return 0
}

function attendancePercentage(records: Array<{ status: 'present' | 'absent' | 'late' }>) {
  if (records.length === 0) return 0
  const weighted = records.reduce((sum, record) => sum + attendanceWeight(record.status), 0)
  return Number(((weighted / records.length) * 100).toFixed(2))
}

function gradePoint(gradeValue: string): number {
  const map: Record<string, number> = {
    A: 4,
    'A-': 3.7,
    'B+': 3.3,
    B: 3,
    'B-': 2.7,
    'C+': 2.3,
    C: 2,
    D: 1,
    E: 0,
  }
  return map[gradeValue] ?? 0
}

function calculateGpa(items: Array<{ gradeValue: string; credits: number }>) {
  if (items.length === 0) return 0
  const totals = items.reduce(
    (acc, item) => {
      acc.totalCredits += item.credits
      acc.totalPoints += gradePoint(item.gradeValue) * item.credits
      return acc
    },
    { totalCredits: 0, totalPoints: 0 },
  )

  if (totals.totalCredits === 0) return 0
  return Number((totals.totalPoints / totals.totalCredits).toFixed(2))
}

export const getDashboardData = query({
  args: {
    actorUserId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const actor = await ctx.db.get(args.actorUserId)
    if (!actor) throw new Error('USER_NOT_FOUND')

    const roles = await getUserRoles(ctx, args.actorUserId)
    const canViewReports = roles.includes('super_admin') || roles.includes('campus_admin') || roles.includes('finance')
    const canManageSubjects = roles.includes('super_admin') || roles.includes('campus_admin')
    const canManagePayments = roles.includes('super_admin') || roles.includes('finance')
    const canManageScholarships = roles.includes('super_admin') || roles.includes('finance')

    const [
      users,
      allRoles,
      subjects,
      semesters,
      announcements,
      notifications,
      documents,
      allEnrollments,
      allPayments,
      allScholarships,
    ] =
      await Promise.all([
        ctx.db
          .query('users')
          .withIndex('by_campus', (query) => query.eq('campusId', actor.campusId))
          .collect(),
        ctx.db.query('roles').collect(),
        ctx.db
          .query('subjects')
          .withIndex('by_campus', (query) => query.eq('campusId', actor.campusId))
          .collect(),
        ctx.db
          .query('semesters')
          .withIndex('by_campus', (query) => query.eq('campusId', actor.campusId))
          .collect(),
        ctx.db
          .query('announcements')
          .withIndex('by_campus_createdAt', (query) => query.eq('campusId', actor.campusId))
          .order('desc')
          .take(8),
        ctx.db
          .query('notifications')
          .withIndex('by_user_createdAt', (query) => query.eq('userId', args.actorUserId))
          .order('desc')
          .collect(),
        ctx.db
          .query('documents')
          .withIndex('by_campus', (query) => query.eq('campusId', actor.campusId))
          .collect(),
        ctx.db.query('enrollments').collect(),
        ctx.db.query('payments').collect(),
        ctx.db.query('scholarships').collect(),
      ])

    const roleById = new Map(allRoles.map((role) => [role._id, role.name]))
    const roleRowsByUser = await Promise.all(
      users.map((entry) =>
        ctx.db
          .query('user_roles')
          .withIndex('by_user', (query) => query.eq('userId', entry._id))
          .collect(),
      ),
    )
    const userRoleMap: Record<string, string[]> = {}
    for (const [index, user] of users.entries()) {
      const rows = roleRowsByUser[index] ?? []
      userRoleMap[user._id] = rows
        .map((row) => roleById.get(row.roleId))
        .filter((role): role is NonNullable<typeof role> => role !== undefined)
    }

    const campusUserIds = users.map((entry) => entry._id)
    const campusSubjectIds = subjects.map((entry) => entry._id)
    const campusSemesterIds = semesters.map((entry) => entry._id)

    const campusEnrollments = allEnrollments.filter(
      (entry) => campusUserIds.includes(entry.studentId) && campusSemesterIds.includes(entry.semesterId),
    )

    const visibleEnrollments = canViewReports || canManageSubjects
      ? campusEnrollments
      : roles.includes('lecturer')
        ? campusEnrollments.filter((entry) => {
            const subject = subjects.find((subjectRow) => subjectRow._id === entry.subjectId)
            return subject?.lecturerId === args.actorUserId
          })
        : campusEnrollments.filter((entry) => entry.studentId === args.actorUserId)

    const visibleEnrollmentIds = visibleEnrollments.map((entry) => entry._id)

    const gradeRows = await Promise.all(
      visibleEnrollmentIds.map((enrollmentId) =>
        ctx.db
          .query('grades')
          .withIndex('by_enrollment', (query) => query.eq('enrollmentId', enrollmentId))
          .first(),
      ),
    )
    const grades = gradeRows.filter((entry): entry is NonNullable<typeof entry> => entry !== null)

    const attendanceByEnrollment = await Promise.all(
      visibleEnrollmentIds.map((enrollmentId) =>
        ctx.db
          .query('attendance')
          .withIndex('by_enrollment', (query) => query.eq('enrollmentId', enrollmentId))
          .collect(),
      ),
    )
    const attendance = attendanceByEnrollment.flat()

    const campusPayments = allPayments.filter((entry) => campusUserIds.includes(entry.studentId))
    const payments = canViewReports || canManagePayments
      ? campusPayments
      : campusPayments.filter((entry) => entry.studentId === args.actorUserId)

    const campusScholarships = allScholarships.filter((entry) => campusUserIds.includes(entry.studentId))
    const scholarships = canViewReports || canManageScholarships
      ? campusScholarships
      : campusScholarships.filter((entry) => entry.studentId === args.actorUserId)

    const materialsBySubject = await Promise.all(
      campusSubjectIds.map((subjectId) =>
        ctx.db
          .query('materials')
          .withIndex('by_subject', (query) => query.eq('subjectId', subjectId))
          .collect(),
      ),
    )
    const materials = materialsBySubject.flat()

    const auditLogs = (await ctx.db.query('audit_logs').withIndex('by_timestamp').order('desc').take(200)).filter(
      (entry) => campusUserIds.includes(entry.userId) || entry.userId === args.actorUserId,
    )

    const myEnrollments = campusEnrollments.filter((entry) => entry.studentId === args.actorUserId)
    const myEnrollmentIds = myEnrollments.map((entry) => entry._id)

    const myTranscriptRows = myEnrollments
      .map((enrollment) => {
        const subject = subjects.find((entry) => entry._id === enrollment.subjectId)
        const semester = semesters.find((entry) => entry._id === enrollment.semesterId)
        const grade = grades.find((entry) => entry.enrollmentId === enrollment._id)

        if (!subject || !semester || !grade) return null

        return {
          enrollmentId: enrollment._id,
          subject: subject.name,
          credits: subject.credits,
          semester: `${semester.name} ${semester.academicYear}`,
          grade: grade.gradeValue,
          locked: grade.locked,
        }
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)

    const myGpa = calculateGpa(
      myTranscriptRows.map((row) => ({
        gradeValue: row.grade,
        credits: row.credits,
      })),
    )

    const myAttendance = attendance.filter((entry) => myEnrollmentIds.includes(entry.enrollmentId))
    const myPayments = campusPayments.filter((entry) => entry.studentId === args.actorUserId)
    const myScholarships = campusScholarships.filter((entry) => entry.studentId === args.actorUserId)

    return {
      roles,
      stats: {
        gpa: myGpa,
        attendance: attendancePercentage(myAttendance),
        activeSemesters: semesters.filter((entry) => entry.isActive).length,
        pendingPayments: myPayments.filter((entry) => entry.status !== 'paid').length,
      },
      announcements,
      payments,
      grades,
      attendance,
      enrollments: visibleEnrollments,
      scholarships,
      semesters,
      subjects,
      users,
      userRoleMap,
      materials,
      documents,
      notifications,
      auditLogs: auditLogs.slice(0, 20),
      studentProfile: {
        transcriptRows: myTranscriptRows,
        cumulativeGpa: myGpa,
        attendancePercentage: attendancePercentage(myAttendance),
        attendanceHistory: myAttendance.sort((a, b) => b.date - a.date),
        tuitionPayments: myPayments,
        scholarships: myScholarships,
      },
      unreadNotificationCount: notifications.filter((entry) => !entry.isRead).length,
      campusSummary: {
        userCount: users.length,
        subjectCount: subjects.length,
        semesterCount: semesters.length,
        enrollmentCount: campusEnrollments.length,
      },
    }
  },
})

export const roleDashboard = query({
  args: {
    actorUserId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const roles = await getUserRoles(ctx, args.actorUserId)
    const user = await ctx.db.get(args.actorUserId)
    if (!user) throw new Error('USER_NOT_FOUND')

    const campusId = user.campusId

    const [students, subjects, semesters, announcements] = await Promise.all([
      ctx.db
        .query('users')
        .withIndex('by_campus', (query) => query.eq('campusId', campusId))
        .collect(),
      ctx.db
        .query('subjects')
        .withIndex('by_campus', (query) => query.eq('campusId', campusId))
        .collect(),
      ctx.db
        .query('semesters')
        .withIndex('by_campus', (query) => query.eq('campusId', campusId))
        .collect(),
      ctx.db
        .query('announcements')
        .withIndex('by_campus_createdAt', (query) => query.eq('campusId', campusId))
        .order('desc')
        .take(5),
    ])

    return {
      roles,
      counts: {
        users: students.length,
        subjects: subjects.length,
        semesters: semesters.length,
      },
      announcements,
    }
  },
})

export const searchStudents = query({
  args: {
    actorUserId: v.id('users'),
    campusId: v.id('campuses'),
    query: v.string(),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.actorUserId, 'view:reports')

    const lowered = args.query.toLowerCase()
    const rows = await ctx.db
      .query('users')
      .withIndex('by_campus', (query) => query.eq('campusId', args.campusId))
      .collect()

    return rows.filter(
      (row) => row.fullName.toLowerCase().includes(lowered) || row.email.toLowerCase().includes(lowered),
    )
  },
})

export const searchSubjects = query({
  args: {
    actorUserId: v.id('users'),
    campusId: v.id('campuses'),
    query: v.string(),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.actorUserId, 'view:reports')

    const lowered = args.query.toLowerCase()
    const rows = await ctx.db
      .query('subjects')
      .withIndex('by_campus', (query) => query.eq('campusId', args.campusId))
      .collect()

    return rows.filter((row) => row.name.toLowerCase().includes(lowered))
  },
})

export const filterPayments = query({
  args: {
    actorUserId: v.id('users'),
    studentId: v.optional(v.id('users')),
    semesterId: v.optional(v.id('semesters')),
    status: v.optional(v.union(v.literal('pending'), v.literal('partial'), v.literal('paid'), v.literal('overdue'))),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.actorUserId, 'view:reports')

    let rows = await ctx.db.query('payments').collect()

    if (args.studentId) {
      rows = rows.filter((row) => row.studentId === args.studentId)
    }

    if (args.semesterId) {
      rows = rows.filter((row) => row.semesterId === args.semesterId)
    }

    if (args.status) {
      rows = rows.filter((row) => row.status === args.status)
    }

    return rows
  },
})

export const filterSemesters = query({
  args: {
    actorUserId: v.id('users'),
    campusId: v.id('campuses'),
    isActive: v.optional(v.boolean()),
    isClosed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.actorUserId, 'view:reports')

    const rows = await ctx.db
      .query('semesters')
      .withIndex('by_campus', (query) => query.eq('campusId', args.campusId))
      .collect()

    return rows
      .filter((row) => (args.isActive === undefined ? true : row.isActive === args.isActive))
      .filter((row) => (args.isClosed === undefined ? true : row.isClosed === args.isClosed))
  },
})
