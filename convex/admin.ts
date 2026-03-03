import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { notify, writeAuditLog } from './lib/audit'
import { requirePermission } from './lib/rbac'

export const assignRole = mutation({
  args: {
    actorUserId: v.id('users'),
    userId: v.id('users'),
    roleId: v.id('roles'),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.actorUserId, 'full:system')

    const existing = await ctx.db
      .query('user_roles')
      .withIndex('by_user_role', (query) => query.eq('userId', args.userId).eq('roleId', args.roleId))
      .first()

    if (!existing) {
      await ctx.db.insert('user_roles', {
        userId: args.userId,
        roleId: args.roleId,
      })
    }

    await writeAuditLog(ctx, {
      userId: args.actorUserId,
      action: 'ASSIGN_ROLE',
      targetType: 'user',
      targetId: args.userId,
    })
  },
})

export const createAnnouncement = mutation({
  args: {
    actorUserId: v.id('users'),
    title: v.string(),
    content: v.string(),
    campusId: v.id('campuses'),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.actorUserId, 'manage:announcements')

    const announcementId = await ctx.db.insert('announcements', {
      title: args.title,
      content: args.content,
      campusId: args.campusId,
      createdBy: args.actorUserId,
      createdAt: Date.now(),
    })

    const campusUsers = await ctx.db
      .query('users')
      .withIndex('by_campus', (query) => query.eq('campusId', args.campusId))
      .collect()

    await Promise.all(
      campusUsers
        .filter((campusUser) => campusUser._id !== args.actorUserId)
        .map((campusUser) =>
          notify(ctx, {
            userId: campusUser._id,
            type: 'announcement_created',
            referenceId: announcementId,
          }),
        ),
    )

    await writeAuditLog(ctx, {
      userId: args.actorUserId,
      action: 'CREATE_ANNOUNCEMENT',
      targetType: 'announcement',
      targetId: announcementId,
    })

    return announcementId
  },
})

export const uploadDocument = mutation({
  args: {
    actorUserId: v.id('users'),
    campusId: v.id('campuses'),
    title: v.string(),
    fileUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.actorUserId, 'manage:announcements')

    const documentId = await ctx.db.insert('documents', {
      campusId: args.campusId,
      uploadedBy: args.actorUserId,
      title: args.title,
      fileUrl: args.fileUrl,
      createdAt: Date.now(),
    })

    await writeAuditLog(ctx, {
      userId: args.actorUserId,
      action: 'UPLOAD_DOCUMENT',
      targetType: 'campus',
      targetId: args.campusId,
    })

    return documentId
  },
})

export const listDocumentsByCampus = query({
  args: {
    actorUserId: v.id('users'),
    campusId: v.id('campuses'),
  },
  handler: async (ctx, args) => {
    const actor = await ctx.db.get(args.actorUserId)
    if (!actor) throw new Error('USER_NOT_FOUND')

    if (actor.campusId !== args.campusId) {
      const roles = await requirePermission(ctx, args.actorUserId, 'full:system')
      if (!roles.includes('super_admin')) {
        throw new Error('FORBIDDEN_DOCUMENT_SCOPE')
      }
    }

    return ctx.db
      .query('documents')
      .withIndex('by_campus', (query) => query.eq('campusId', args.campusId))
      .order('desc')
      .collect()
  },
})

export const getAnnouncementsByCampus = query({
  args: {
    campusId: v.id('campuses'),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query('announcements')
      .withIndex('by_campus_createdAt', (query) => query.eq('campusId', args.campusId))
      .order('desc')
      .collect()
  },
})

export const getAuditLogs = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query('audit_logs').withIndex('by_timestamp').order('desc').take(100)
  },
})
