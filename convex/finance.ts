import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { notify, writeAuditLog } from './lib/audit'
import { requirePermission } from './lib/rbac'

export const createInvoice = mutation({
  args: {
    actorUserId: v.id('users'),
    studentId: v.id('users'),
    semesterId: v.id('semesters'),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.actorUserId, 'generate:invoices')

    const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(Math.random() * 100000)
      .toString()
      .padStart(5, '0')}`

    const paymentId = await ctx.db.insert('payments', {
      studentId: args.studentId,
      semesterId: args.semesterId,
      amount: args.amount,
      status: 'pending',
      invoiceNumber,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    await notify(ctx, {
      userId: args.studentId,
      type: 'invoice_created',
      referenceId: paymentId,
    })

    await writeAuditLog(ctx, {
      userId: args.actorUserId,
      action: 'CREATE_INVOICE',
      targetType: 'payment',
      targetId: paymentId,
    })

    return paymentId
  },
})

export const recordPayment = mutation({
  args: {
    actorUserId: v.id('users'),
    paymentId: v.id('payments'),
    status: v.union(
      v.literal('pending'),
      v.literal('partial'),
      v.literal('paid'),
      v.literal('overdue'),
    ),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.actorUserId, 'manage:payments')

    const payment = await ctx.db.get(args.paymentId)
    if (!payment) throw new Error('PAYMENT_NOT_FOUND')

    await ctx.db.patch(args.paymentId, {
      status: args.status,
      updatedAt: Date.now(),
    })

    await notify(ctx, {
      userId: payment.studentId,
      type: 'payment_confirmed',
      referenceId: args.paymentId,
    })

    await writeAuditLog(ctx, {
      userId: args.actorUserId,
      action: 'RECORD_PAYMENT',
      targetType: 'payment',
      targetId: args.paymentId,
    })
  },
})

export const assignScholarship = mutation({
  args: {
    actorUserId: v.id('users'),
    studentId: v.id('users'),
    percentage: v.number(),
    semesterId: v.id('semesters'),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.actorUserId, 'manage:scholarships')

    const existing = await ctx.db
      .query('scholarships')
      .withIndex('by_student_semester', (query) =>
        query.eq('studentId', args.studentId).eq('semesterId', args.semesterId),
      )
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        percentage: args.percentage,
        updatedAt: Date.now(),
      })
    } else {
      await ctx.db.insert('scholarships', {
        studentId: args.studentId,
        percentage: args.percentage,
        semesterId: args.semesterId,
        updatedAt: Date.now(),
      })
    }

    await writeAuditLog(ctx, {
      userId: args.actorUserId,
      action: 'ASSIGN_SCHOLARSHIP',
      targetType: 'student',
      targetId: args.studentId,
    })
  },
})

export const getPaymentsByStudent = query({
  args: {
    actorUserId: v.id('users'),
    studentId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const roles = await requirePermission(ctx, args.actorUserId, 'view:payments')

    const canRead =
      roles.includes('super_admin') ||
      roles.includes('campus_admin') ||
      roles.includes('finance') ||
      args.actorUserId === args.studentId

    if (!canRead) {
      throw new Error('FORBIDDEN_PAYMENT_SCOPE')
    }

    return ctx.db
      .query('payments')
      .withIndex('by_student', (query) => query.eq('studentId', args.studentId))
      .collect()
  },
})
