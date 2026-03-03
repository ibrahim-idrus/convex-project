import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

export async function writeAuditLog(
  ctx: MutationCtx,
  args: {
    userId: Id<'users'>
    action: string
    targetType: string
    targetId: string
  },
) {
  await ctx.db.insert('audit_logs', {
    userId: args.userId,
    action: args.action,
    targetType: args.targetType,
    targetId: args.targetId,
    timestamp: Date.now(),
  })
}

export async function notify(
  ctx: MutationCtx,
  args: {
    userId: Id<'users'>
    type: string
    referenceId: string
  },
) {
  await ctx.db.insert('notifications', {
    userId: args.userId,
    type: args.type,
    referenceId: args.referenceId,
    isRead: false,
    createdAt: Date.now(),
  })
}
