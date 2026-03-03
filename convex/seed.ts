import type { Id } from './_generated/dataModel'
import { mutation } from './_generated/server'

type RoleName = 'super_admin' | 'campus_admin' | 'lecturer' | 'student' | 'finance'

export const seedInitialData = mutation({
  args: {},
  handler: async (ctx) => {
    const roleNames: RoleName[] = ['super_admin', 'campus_admin', 'lecturer', 'student', 'finance']
    const roleMap = new Map<RoleName, Id<'roles'>>()

    for (const roleName of roleNames) {
      const existingRole = await ctx.db
        .query('roles')
        .withIndex('by_name', (query) => query.eq('name', roleName))
        .first()

      if (existingRole) {
        roleMap.set(roleName, existingRole._id)
      } else {
        const roleId = await ctx.db.insert('roles', { name: roleName })
        roleMap.set(roleName, roleId)
      }
    }

    const campusRows = await ctx.db.query('campuses').collect()

    let mainCampusId = campusRows.find((entry) => entry.name === 'Main Campus')?._id
    if (!mainCampusId) {
      mainCampusId = await ctx.db.insert('campuses', {
        name: 'Main Campus',
        address: 'Downtown Education District',
      })
    }

    let westCampusId = campusRows.find((entry) => entry.name === 'West Campus')?._id
    if (!westCampusId) {
      westCampusId = await ctx.db.insert('campuses', {
        name: 'West Campus',
        address: 'West Valley Road',
      })
    }

    const upsertUser = async (payload: {
      email: string
      passwordHash: string
      fullName: string
      campusId: Id<'campuses'>
    }) => {
      const existing = await ctx.db
        .query('users')
        .withIndex('by_email', (query) => query.eq('email', payload.email))
        .first()

      if (existing) return existing._id

      return ctx.db.insert('users', {
        email: payload.email,
        passwordHash: payload.passwordHash,
        fullName: payload.fullName,
        campusId: payload.campusId,
        createdAt: Date.now(),
      })
    }

    const superAdminId = await upsertUser({
      email: 'super@educentral.dev',
      passwordHash: 'admin123',
      fullName: 'System Super Admin',
      campusId: mainCampusId,
    })

    const campusAdminId = await upsertUser({
      email: 'campusadmin@educentral.dev',
      passwordHash: 'admin123',
      fullName: 'Campus Admin',
      campusId: mainCampusId,
    })

    const lecturerId = await upsertUser({
      email: 'lecturer@educentral.dev',
      passwordHash: 'admin123',
      fullName: 'Prof. Sarah Jenkins',
      campusId: mainCampusId,
    })

    const studentId = await upsertUser({
      email: 'student@educentral.dev',
      passwordHash: 'admin123',
      fullName: 'Alex Johnson',
      campusId: mainCampusId,
    })

    const financeId = await upsertUser({
      email: 'finance@educentral.dev',
      passwordHash: 'admin123',
      fullName: 'Finance Officer',
      campusId: mainCampusId,
    })

    const assignRole = async (userId: Id<'users'>, roleName: RoleName) => {
      const roleId = roleMap.get(roleName)
      if (!roleId) throw new Error(`ROLE_NOT_FOUND_${roleName}`)

      const existing = await ctx.db
        .query('user_roles')
        .withIndex('by_user_role', (query) => query.eq('userId', userId).eq('roleId', roleId))
        .first()

      if (!existing) {
        await ctx.db.insert('user_roles', {
          userId,
          roleId,
        })
      }
    }

    await assignRole(superAdminId, 'super_admin')
    await assignRole(superAdminId, 'finance')
    await assignRole(campusAdminId, 'campus_admin')
    await assignRole(lecturerId, 'lecturer')
    await assignRole(studentId, 'student')
    await assignRole(financeId, 'finance')

    const semesterRows = await ctx.db
      .query('semesters')
      .withIndex('by_campus', (query) => query.eq('campusId', mainCampusId))
      .collect()

    let fallSemesterId = semesterRows.find(
      (entry) => entry.name === 'Fall Semester' && entry.academicYear === '2026/2027',
    )?._id

    if (!fallSemesterId) {
      fallSemesterId = await ctx.db.insert('semesters', {
        name: 'Fall Semester',
        academicYear: '2026/2027',
        isActive: true,
        isClosed: false,
        campusId: mainCampusId,
        createdAt: Date.now(),
      })
    }

    const upsertSubject = async (name: string, credits: number) => {
      const subjectRows = await ctx.db
        .query('subjects')
        .withIndex('by_campus', (query) => query.eq('campusId', mainCampusId))
        .collect()

      const existing = subjectRows.find((entry) => entry.name === name)
      if (existing) return existing._id

      return ctx.db.insert('subjects', {
        name,
        credits,
        lecturerId,
        campusId: mainCampusId,
        createdAt: Date.now(),
      })
    }

    const subjectAdsId = await upsertSubject('Advanced Data Structures', 4)
    const subjectMacroId = await upsertSubject('Macroeconomics', 3)

    const upsertEnrollment = async (subjectId: Id<'subjects'>) => {
      const existing = await ctx.db
        .query('enrollments')
        .withIndex('by_student_semester', (query) =>
          query.eq('studentId', studentId).eq('semesterId', fallSemesterId),
        )
        .collect()

      const matched = existing.find((entry) => entry.subjectId === subjectId)
      if (matched) return matched._id

      return ctx.db.insert('enrollments', {
        studentId,
        subjectId,
        semesterId: fallSemesterId,
        createdAt: Date.now(),
      })
    }

    const enrollmentAdsId = await upsertEnrollment(subjectAdsId)
    const enrollmentMacroId = await upsertEnrollment(subjectMacroId)

    const upsertGrade = async (enrollmentId: Id<'enrollments'>, gradeValue: string) => {
      const existing = await ctx.db
        .query('grades')
        .withIndex('by_enrollment', (query) => query.eq('enrollmentId', enrollmentId))
        .first()

      if (!existing) {
        await ctx.db.insert('grades', {
          enrollmentId,
          gradeValue,
          locked: false,
          updatedAt: Date.now(),
        })
      }
    }

    await upsertGrade(enrollmentAdsId, 'A')
    await upsertGrade(enrollmentMacroId, 'B+')

    const ensureAttendance = async (
      enrollmentId: Id<'enrollments'>,
      daysAgo: number,
      status: 'present' | 'absent' | 'late',
    ) => {
      const date = Date.now() - daysAgo * 86400000
      const existing = await ctx.db
        .query('attendance')
        .withIndex('by_enrollment_date', (query) => query.eq('enrollmentId', enrollmentId).eq('date', date))
        .first()

      if (!existing) {
        await ctx.db.insert('attendance', {
          enrollmentId,
          date,
          status,
        })
      }
    }

    await ensureAttendance(enrollmentAdsId, 0, 'present')
    await ensureAttendance(enrollmentAdsId, 1, 'late')
    await ensureAttendance(enrollmentMacroId, 0, 'absent')

    const existingPayment = await ctx.db
      .query('payments')
      .withIndex('by_student_semester', (query) =>
        query.eq('studentId', studentId).eq('semesterId', fallSemesterId),
      )
      .first()

    if (!existingPayment) {
      await ctx.db.insert('payments', {
        studentId,
        semesterId: fallSemesterId,
        amount: 4500,
        status: 'pending',
        invoiceNumber: 'INV-2026-001',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    }

    const existingScholarship = await ctx.db
      .query('scholarships')
      .withIndex('by_student_semester', (query) =>
        query.eq('studentId', studentId).eq('semesterId', fallSemesterId),
      )
      .first()

    if (!existingScholarship) {
      await ctx.db.insert('scholarships', {
        studentId,
        percentage: 15,
        semesterId: fallSemesterId,
        updatedAt: Date.now(),
      })
    }

    const existingAnnouncement = await ctx.db
      .query('announcements')
      .withIndex('by_campus', (query) => query.eq('campusId', mainCampusId))
      .first()

    if (!existingAnnouncement) {
      await ctx.db.insert('announcements', {
        title: 'Welcome to Fall Semester',
        content: 'Please complete enrollment and payment verification this week.',
        campusId: mainCampusId,
        createdBy: campusAdminId,
        createdAt: Date.now(),
      })
    }

    return {
      ok: true,
      users: {
        superAdminId,
        campusAdminId,
        lecturerId,
        studentId,
        financeId,
      },
      campuses: {
        mainCampusId,
        westCampusId,
      },
      semesterId: fallSemesterId,
    }
  },
})
