import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { notify, writeAuditLog } from './lib/audit'
import { requirePermission } from './lib/rbac'

export const sendMessage = mutation({
  args: {
    actorUserId: v.id('users'),
    receiverId: v.id('users'),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.actorUserId, 'chat:send')

    const messageId = await ctx.db.insert('chat_messages', {
      senderId: args.actorUserId,
      receiverId: args.receiverId,
      message: args.message,
      createdAt: Date.now(),
    })

    await notify(ctx, {
      userId: args.receiverId,
      type: 'chat_message',
      referenceId: messageId,
    })

    await writeAuditLog(ctx, {
      userId: args.actorUserId,
      action: 'SEND_MESSAGE',
      targetType: 'chat_message',
      targetId: messageId,
    })

    return messageId
  },
})

export const subscribeMessages = query({
  args: {
    actorUserId: v.id('users'),
    peerUserId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const sent = await ctx.db
      .query('chat_messages')
      .withIndex('by_sender_receiver', (query) =>
        query.eq('senderId', args.actorUserId).eq('receiverId', args.peerUserId),
      )
      .collect()

    const received = await ctx.db
      .query('chat_messages')
      .withIndex('by_sender_receiver', (query) =>
        query.eq('senderId', args.peerUserId).eq('receiverId', args.actorUserId),
      )
      .collect()

    return [...sent, ...received].sort((a, b) => a.createdAt - b.createdAt)
  },
})
