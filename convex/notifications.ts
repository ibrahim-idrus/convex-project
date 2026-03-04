import { v } from 'convex/values'
import { mutation, query } from './_generated/server'

export const createNotification = mutation({
  args: {
    userId: v.id('users'),
    type: v.string(),
    referenceId: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert('notifications', {
      userId: args.userId,
      type: args.type,
      referenceId: args.referenceId,
      isRead: false,
      createdAt: Date.now(),
    })
  },
})

export const markAsRead = mutation({
  args: {
    actorUserId: v.id('users'),
    notificationId: v.id('notifications'),
  },
  handler: async (ctx, args) => {
    const notification = await ctx.db.get(args.notificationId)
    if (!notification) throw new Error('NOTIFICATION_NOT_FOUND')
    if (notification.userId !== args.actorUserId) {
      throw new Error('FORBIDDEN_NOTIFICATION_SCOPE')
    }

    await ctx.db.delete(args.notificationId)
  },
})

export const listByUser = query({
  args: {
    actorUserId: v.id('users'),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query('notifications')
      .withIndex('by_user_createdAt', (query) => query.eq('userId', args.actorUserId))
      .order('desc')
      .collect()
  },
})
