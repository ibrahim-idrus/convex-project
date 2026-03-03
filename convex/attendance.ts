import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { writeAuditLog } from './lib/audit'
import { requirePermission } from './lib/rbac'

function attendanceWeight(status: 'present' | 'absent' | 'late') {
  if (status === 'present') return 1
  if (status === 'late') return 0.5
  return 0
}

export const recordAttendance = mutation({
  args: {
    actorUserId: v.id('users'),
    enrollmentId: v.id('enrollments'),
    date: v.number(),
    status: v.union(v.literal('present'), v.literal('absent'), v.literal('late')),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.actorUserId, 'take:attendance')

    const enrollment = await ctx.db.get(args.enrollmentId)
    if (!enrollment) throw new Error('ENROLLMENT_NOT_FOUND')

    const subject = await ctx.db.get(enrollment.subjectId)
    if (!subject) throw new Error('SUBJECT_NOT_FOUND')

    if (subject.lecturerId !== args.actorUserId) {
      const roles = await requirePermission(ctx, args.actorUserId, 'full:system')
      if (!roles.includes('super_admin')) {
        throw new Error('FORBIDDEN_LECTURER_SUBJECT_SCOPE')
      }
    }

    const recordId = await ctx.db.insert('attendance', {
      enrollmentId: args.enrollmentId,
      date: args.date,
      status: args.status,
    })

    await writeAuditLog(ctx, {
      userId: args.actorUserId,
      action: 'RECORD_ATTENDANCE',
      targetType: 'enrollment',
      targetId: args.enrollmentId,
    })

    return recordId
  },
})

export const getAttendanceByStudent = query({
  args: {
    actorUserId: v.id('users'),
    studentId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const roles = await requirePermission(ctx, args.actorUserId, 'view:attendance')
    const canRead =
      roles.includes('super_admin') ||
      roles.includes('campus_admin') ||
      roles.includes('lecturer') ||
      args.actorUserId === args.studentId

    if (!canRead) throw new Error('FORBIDDEN_ATTENDANCE_SCOPE')

    const enrollments = await ctx.db
      .query('enrollments')
      .withIndex('by_student', (query) => query.eq('studentId', args.studentId))
      .collect()

    const rows = await Promise.all(
      enrollments.map(async (enrollment) => {
        const subject = await ctx.db.get(enrollment.subjectId)
        const semester = await ctx.db.get(enrollment.semesterId)
        const records = await ctx.db
          .query('attendance')
          .withIndex('by_enrollment', (query) => query.eq('enrollmentId', enrollment._id))
          .collect()

        const weighted = records.reduce((sum, record) => sum + attendanceWeight(record.status), 0)
        const percentage = records.length > 0 ? Number(((weighted / records.length) * 100).toFixed(2)) : 0

        return {
          enrollmentId: enrollment._id,
          subject: subject?.name ?? '-',
          semester: semester ? `${semester.name} ${semester.academicYear}` : '-',
          percentage,
          records,
        }
      }),
    )

    return rows
  },
})
