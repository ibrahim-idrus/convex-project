import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { notify, writeAuditLog } from './lib/audit'
import { getUserRoles, requirePermission } from './lib/rbac'

export const createSemester = mutation({
  args: {
    actorUserId: v.id('users'),
    name: v.string(),
    academicYear: v.string(),
    campusId: v.id('campuses'),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.actorUserId, 'manage:semesters')

    const semesterId = await ctx.db.insert('semesters', {
      name: args.name,
      academicYear: args.academicYear,
      isActive: false,
      isClosed: false,
      campusId: args.campusId,
      createdAt: Date.now(),
    })

    await writeAuditLog(ctx, {
      userId: args.actorUserId,
      action: 'CREATE_SEMESTER',
      targetType: 'semester',
      targetId: semesterId,
    })

    return semesterId
  },
})

export const activateSemester = mutation({
  args: {
    actorUserId: v.id('users'),
    semesterId: v.id('semesters'),
    campusId: v.id('campuses'),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.actorUserId, 'manage:semesters')

    const semesters = await ctx.db
      .query('semesters')
      .withIndex('by_campus', (query) => query.eq('campusId', args.campusId))
      .collect()

    await Promise.all(
      semesters.map((semester) =>
        ctx.db.patch(semester._id, {
          isActive: semester._id === args.semesterId,
        }),
      ),
    )

    await writeAuditLog(ctx, {
      userId: args.actorUserId,
      action: 'ACTIVATE_SEMESTER',
      targetType: 'semester',
      targetId: args.semesterId,
    })
  },
})

export const closeSemester = mutation({
  args: {
    actorUserId: v.id('users'),
    semesterId: v.id('semesters'),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.actorUserId, 'manage:semesters')

    await ctx.db.patch(args.semesterId, { isClosed: true, isActive: false })

    const enrollments = await ctx.db
      .query('enrollments')
      .withIndex('by_semester', (query) => query.eq('semesterId', args.semesterId))
      .collect()

    await Promise.all(
      enrollments.map(async (enrollment) => {
        const grade = await ctx.db
          .query('grades')
          .withIndex('by_enrollment', (query) => query.eq('enrollmentId', enrollment._id))
          .first()
        if (grade) {
          await ctx.db.patch(grade._id, { locked: true, updatedAt: Date.now() })
        }
      }),
    )

    await writeAuditLog(ctx, {
      userId: args.actorUserId,
      action: 'CLOSE_SEMESTER',
      targetType: 'semester',
      targetId: args.semesterId,
    })
  },
})

export const createSubject = mutation({
  args: {
    actorUserId: v.id('users'),
    name: v.string(),
    credits: v.number(),
    lecturerId: v.id('users'),
    campusId: v.id('campuses'),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.actorUserId, 'manage:subjects')

    const subjectId = await ctx.db.insert('subjects', {
      name: args.name,
      credits: args.credits,
      lecturerId: args.lecturerId,
      campusId: args.campusId,
      createdAt: Date.now(),
    })

    await writeAuditLog(ctx, {
      userId: args.actorUserId,
      action: 'CREATE_SUBJECT',
      targetType: 'subject',
      targetId: subjectId,
    })

    return subjectId
  },
})

export const assignLecturer = mutation({
  args: {
    actorUserId: v.id('users'),
    subjectId: v.id('subjects'),
    lecturerId: v.id('users'),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.actorUserId, 'manage:lecturers')

    await ctx.db.patch(args.subjectId, { lecturerId: args.lecturerId })

    await writeAuditLog(ctx, {
      userId: args.actorUserId,
      action: 'ASSIGN_LECTURER',
      targetType: 'subject',
      targetId: args.subjectId,
    })
  },
})

export const enrollStudent = mutation({
  args: {
    actorUserId: v.id('users'),
    studentId: v.id('users'),
    subjectId: v.id('subjects'),
    semesterId: v.id('semesters'),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.actorUserId, 'manage:subjects')

    const existing = await ctx.db
      .query('enrollments')
      .withIndex('by_student_semester', (query) =>
        query.eq('studentId', args.studentId).eq('semesterId', args.semesterId),
      )
      .collect()

    const duplicate = existing.find((entry) => entry.subjectId === args.subjectId)
    if (duplicate) {
      throw new Error('ENROLLMENT_EXISTS')
    }

    const enrollmentId = await ctx.db.insert('enrollments', {
      studentId: args.studentId,
      subjectId: args.subjectId,
      semesterId: args.semesterId,
      createdAt: Date.now(),
    })

    await writeAuditLog(ctx, {
      userId: args.actorUserId,
      action: 'ENROLL_STUDENT',
      targetType: 'enrollment',
      targetId: enrollmentId,
    })

    return enrollmentId
  },
})

export const inputGrade = mutation({
  args: {
    actorUserId: v.id('users'),
    enrollmentId: v.id('enrollments'),
    gradeValue: v.string(),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.actorUserId, 'input:grades')

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

    const semester = await ctx.db.get(enrollment.semesterId)
    if (!semester) throw new Error('SEMESTER_NOT_FOUND')
    if (semester.isClosed) throw new Error('SEMESTER_CLOSED')

    const existing = await ctx.db
      .query('grades')
      .withIndex('by_enrollment', (query) => query.eq('enrollmentId', args.enrollmentId))
      .first()

    if (existing?.locked) {
      throw new Error('GRADE_LOCKED')
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        gradeValue: args.gradeValue,
        updatedAt: Date.now(),
      })
    } else {
      await ctx.db.insert('grades', {
        enrollmentId: args.enrollmentId,
        gradeValue: args.gradeValue,
        locked: false,
        updatedAt: Date.now(),
      })
    }

    await notify(ctx, {
      userId: enrollment.studentId,
      type: 'grade_published',
      referenceId: args.enrollmentId,
    })

    await writeAuditLog(ctx, {
      userId: args.actorUserId,
      action: 'INPUT_GRADE',
      targetType: 'enrollment',
      targetId: args.enrollmentId,
    })
  },
})

export const lockGrades = mutation({
  args: {
    actorUserId: v.id('users'),
    semesterId: v.id('semesters'),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.actorUserId, 'manage:semesters')

    const enrollments = await ctx.db
      .query('enrollments')
      .withIndex('by_semester', (query) => query.eq('semesterId', args.semesterId))
      .collect()

    await Promise.all(
      enrollments.map(async (enrollment) => {
        const grade = await ctx.db
          .query('grades')
          .withIndex('by_enrollment', (query) => query.eq('enrollmentId', enrollment._id))
          .first()

        if (grade) {
          await ctx.db.patch(grade._id, {
            locked: true,
            updatedAt: Date.now(),
          })
        }
      }),
    )

    await writeAuditLog(ctx, {
      userId: args.actorUserId,
      action: 'LOCK_GRADES',
      targetType: 'semester',
      targetId: args.semesterId,
    })
  },
})

export const uploadMaterial = mutation({
  args: {
    actorUserId: v.id('users'),
    subjectId: v.id('subjects'),
    title: v.string(),
    fileUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const roles = await requirePermission(ctx, args.actorUserId, 'input:grades')
    const subject = await ctx.db.get(args.subjectId)
    if (!subject) throw new Error('SUBJECT_NOT_FOUND')

    const canUpload = roles.includes('super_admin') || subject.lecturerId === args.actorUserId
    if (!canUpload) {
      throw new Error('FORBIDDEN_LECTURER_SUBJECT_SCOPE')
    }

    const materialId = await ctx.db.insert('materials', {
      subjectId: args.subjectId,
      uploadedBy: args.actorUserId,
      title: args.title,
      fileUrl: args.fileUrl,
      createdAt: Date.now(),
    })

    await writeAuditLog(ctx, {
      userId: args.actorUserId,
      action: 'UPLOAD_MATERIAL',
      targetType: 'subject',
      targetId: args.subjectId,
    })

    return materialId
  },
})

export const listMaterials = query({
  args: {
    actorUserId: v.id('users'),
    subjectId: v.optional(v.id('subjects')),
  },
  handler: async (ctx, args) => {
    const actor = await ctx.db.get(args.actorUserId)
    if (!actor) throw new Error('USER_NOT_FOUND')

    const subjectId = args.subjectId

    if (subjectId !== undefined) {
      return ctx.db
        .query('materials')
        .withIndex('by_subject', (query) => query.eq('subjectId', subjectId))
        .collect()
    }

    const roles = await getUserRoles(ctx, args.actorUserId)
    const campusSubjectIds = (
      await ctx.db
        .query('subjects')
        .withIndex('by_campus', (query) => query.eq('campusId', actor.campusId))
        .collect()
    ).map((subject) => subject._id)

    if (roles.includes('super_admin') || roles.includes('campus_admin')) {
      const rows = await Promise.all(
        campusSubjectIds.map((subjectId) =>
          ctx.db
            .query('materials')
            .withIndex('by_subject', (query) => query.eq('subjectId', subjectId))
            .collect(),
        ),
      )
      return rows.flat()
    }

    if (roles.includes('lecturer')) {
      const mySubjectIds = (
        await ctx.db
          .query('subjects')
          .withIndex('by_lecturer', (query) => query.eq('lecturerId', args.actorUserId))
          .collect()
      ).map((subject) => subject._id)

      const rows = await Promise.all(
        mySubjectIds.map((subjectId) =>
          ctx.db
            .query('materials')
            .withIndex('by_subject', (query) => query.eq('subjectId', subjectId))
            .collect(),
        ),
      )
      return rows.flat()
    }

    const enrollmentSubjectIds = (
      await ctx.db
        .query('enrollments')
        .withIndex('by_student', (query) => query.eq('studentId', args.actorUserId))
        .collect()
    ).map((enrollment) => enrollment.subjectId)

    const rows = await Promise.all(
      enrollmentSubjectIds.map((subjectId) =>
        ctx.db
          .query('materials')
          .withIndex('by_subject', (query) => query.eq('subjectId', subjectId))
          .collect(),
      ),
    )
    return rows.flat()
  },
})

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

export const getTranscript = query({
  args: {
    actorUserId: v.id('users'),
    studentId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const roles = await requirePermission(ctx, args.actorUserId, 'view:grades')
    if (!roles.includes('super_admin') && !roles.includes('campus_admin') && args.actorUserId !== args.studentId) {
      throw new Error('FORBIDDEN_TRANSCRIPT_SCOPE')
    }

    const enrollments = await ctx.db
      .query('enrollments')
      .withIndex('by_student', (query) => query.eq('studentId', args.studentId))
      .collect()

    const rows = await Promise.all(
      enrollments.map(async (enrollment) => {
        const subject = await ctx.db.get(enrollment.subjectId)
        const semester = await ctx.db.get(enrollment.semesterId)
        const grade = await ctx.db
          .query('grades')
          .withIndex('by_enrollment', (query) => query.eq('enrollmentId', enrollment._id))
          .first()

        if (!subject || !semester || !grade) return null

        return {
          enrollmentId: enrollment._id,
          subject: subject.name,
          credits: subject.credits,
          semester: `${semester.name} ${semester.academicYear}`,
          grade: grade.gradeValue,
          locked: grade.locked,
        }
      }),
    )

    const transcriptRows = rows.filter((entry): entry is NonNullable<typeof entry> => entry !== null)

    const total = transcriptRows.reduce(
      (acc, row) => {
        acc.totalCredits += row.credits
        acc.totalPoints += gradePoint(row.grade) * row.credits
        return acc
      },
      { totalCredits: 0, totalPoints: 0 },
    )

    const gpa = total.totalCredits > 0 ? Number((total.totalPoints / total.totalCredits).toFixed(2)) : 0

    return {
      gpa,
      totalCredits: total.totalCredits,
      rows: transcriptRows,
    }
  },
})
