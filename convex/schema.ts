import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  users: defineTable({
    email: v.string(),
    passwordHash: v.string(),
    fullName: v.string(),
    campusId: v.id('campuses'),
    createdAt: v.number(),
  })
    .index('by_email', ['email'])
    .index('by_campus', ['campusId']),

  roles: defineTable({
    name: v.union(
      v.literal('super_admin'),
      v.literal('campus_admin'),
      v.literal('lecturer'),
      v.literal('student'),
      v.literal('finance'),
    ),
  }).index('by_name', ['name']),

  user_roles: defineTable({
    userId: v.id('users'),
    roleId: v.id('roles'),
  })
    .index('by_user', ['userId'])
    .index('by_role', ['roleId'])
    .index('by_user_role', ['userId', 'roleId']),

  campuses: defineTable({
    name: v.string(),
    address: v.string(),
  }),

  semesters: defineTable({
    name: v.string(),
    academicYear: v.string(),
    isActive: v.boolean(),
    isClosed: v.boolean(),
    campusId: v.id('campuses'),
    createdAt: v.number(),
  })
    .index('by_campus', ['campusId'])
    .index('by_campus_active', ['campusId', 'isActive']),

  subjects: defineTable({
    name: v.string(),
    credits: v.number(),
    lecturerId: v.id('users'),
    campusId: v.id('campuses'),
    createdAt: v.number(),
  })
    .index('by_campus', ['campusId'])
    .index('by_lecturer', ['lecturerId']),

  enrollments: defineTable({
    studentId: v.id('users'),
    subjectId: v.id('subjects'),
    semesterId: v.id('semesters'),
    createdAt: v.number(),
  })
    .index('by_student', ['studentId'])
    .index('by_subject', ['subjectId'])
    .index('by_semester', ['semesterId'])
    .index('by_student_semester', ['studentId', 'semesterId']),

  grades: defineTable({
    enrollmentId: v.id('enrollments'),
    gradeValue: v.string(),
    locked: v.boolean(),
    updatedAt: v.number(),
  }).index('by_enrollment', ['enrollmentId']),

  attendance: defineTable({
    enrollmentId: v.id('enrollments'),
    date: v.number(),
    status: v.union(v.literal('present'), v.literal('absent'), v.literal('late')),
  })
    .index('by_enrollment', ['enrollmentId'])
    .index('by_enrollment_date', ['enrollmentId', 'date']),

  payments: defineTable({
    studentId: v.id('users'),
    semesterId: v.id('semesters'),
    amount: v.number(),
    status: v.union(
      v.literal('pending'),
      v.literal('partial'),
      v.literal('paid'),
      v.literal('overdue'),
    ),
    invoiceNumber: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_student', ['studentId'])
    .index('by_semester', ['semesterId'])
    .index('by_invoice', ['invoiceNumber'])
    .index('by_student_semester', ['studentId', 'semesterId']),

  scholarships: defineTable({
    studentId: v.id('users'),
    percentage: v.number(),
    semesterId: v.id('semesters'),
    updatedAt: v.number(),
  })
    .index('by_student', ['studentId'])
    .index('by_semester', ['semesterId'])
    .index('by_student_semester', ['studentId', 'semesterId']),

  announcements: defineTable({
    title: v.string(),
    content: v.string(),
    campusId: v.id('campuses'),
    createdBy: v.id('users'),
    createdAt: v.number(),
  })
    .index('by_campus', ['campusId'])
    .index('by_campus_createdAt', ['campusId', 'createdAt']),

  chat_messages: defineTable({
    senderId: v.id('users'),
    receiverId: v.id('users'),
    message: v.string(),
    createdAt: v.number(),
  })
    .index('by_sender_receiver', ['senderId', 'receiverId'])
    .index('by_receiver_sender', ['receiverId', 'senderId'])
    .index('by_createdAt', ['createdAt']),

  materials: defineTable({
    subjectId: v.id('subjects'),
    uploadedBy: v.id('users'),
    title: v.string(),
    fileUrl: v.string(),
    createdAt: v.number(),
  })
    .index('by_subject', ['subjectId'])
    .index('by_uploader', ['uploadedBy']),

  documents: defineTable({
    campusId: v.id('campuses'),
    uploadedBy: v.id('users'),
    title: v.string(),
    fileUrl: v.string(),
    createdAt: v.number(),
  })
    .index('by_campus', ['campusId'])
    .index('by_uploader', ['uploadedBy']),

  notifications: defineTable({
    userId: v.id('users'),
    type: v.string(),
    referenceId: v.string(),
    isRead: v.boolean(),
    createdAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_user_isRead', ['userId', 'isRead'])
    .index('by_user_createdAt', ['userId', 'createdAt']),

  audit_logs: defineTable({
    userId: v.id('users'),
    action: v.string(),
    targetType: v.string(),
    targetId: v.string(),
    timestamp: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_timestamp', ['timestamp']),
})
