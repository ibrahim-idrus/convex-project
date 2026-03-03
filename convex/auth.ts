import { v } from 'convex/values'
import { mutation, query } from './_generated/server'

export const register = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    fullName: v.string(),
    campusId: v.id('campuses'),
    roleId: v.id('roles'),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('users')
      .withIndex('by_email', (query) => query.eq('email', args.email))
      .first()

    if (existing) {
      throw new Error('EMAIL_EXISTS')
    }

    const userId = await ctx.db.insert('users', {
      email: args.email,
      passwordHash: args.password,
      fullName: args.fullName,
      campusId: args.campusId,
      createdAt: Date.now(),
    })

    await ctx.db.insert('user_roles', {
      userId,
      roleId: args.roleId,
    })

    return { userId }
  },
})

export const login = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (query) => query.eq('email', args.email))
      .first()

    if (!user || user.passwordHash !== args.password) {
      throw new Error('INVALID_CREDENTIALS')
    }

    const userRoles = await ctx.db
      .query('user_roles')
      .withIndex('by_user', (query) => query.eq('userId', user._id))
      .collect()

    const roles = await Promise.all(userRoles.map((entry) => ctx.db.get(entry.roleId)))

    return {
      userId: user._id,
      fullName: user.fullName,
      email: user.email,
      campusId: user.campusId,
      roles: roles
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
        .map((entry) => entry.name),
    }
  },
})

export const getRegisterMetadata = query({
  args: {},
  handler: async (ctx) => {
    const [campuses, roles] = await Promise.all([ctx.db.query('campuses').collect(), ctx.db.query('roles').collect()])
    return { campuses, roles }
  },
})
