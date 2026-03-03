/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as academic from "../academic.js";
import type * as admin from "../admin.js";
import type * as attendance from "../attendance.js";
import type * as auth from "../auth.js";
import type * as chat from "../chat.js";
import type * as dashboard from "../dashboard.js";
import type * as finance from "../finance.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_rbac from "../lib/rbac.js";
import type * as notifications from "../notifications.js";
import type * as seed from "../seed.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  academic: typeof academic;
  admin: typeof admin;
  attendance: typeof attendance;
  auth: typeof auth;
  chat: typeof chat;
  dashboard: typeof dashboard;
  finance: typeof finance;
  "lib/audit": typeof lib_audit;
  "lib/rbac": typeof lib_rbac;
  notifications: typeof notifications;
  seed: typeof seed;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
