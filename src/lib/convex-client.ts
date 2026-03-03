import { ConvexReactClient } from 'convex/react'

let client: ConvexReactClient | null = null

function getConvexUrl() {
  const url = import.meta.env.VITE_CONVEX_URL
  if (!url) {
    throw new Error(
      'VITE_CONVEX_URL belum diset. Jalankan `npx convex dev` atau isi .env.local dengan URL deployment Convex.',
    )
  }
  return url
}

export function getConvexClient() {
  if (!client) {
    client = new ConvexReactClient(getConvexUrl())
  }
  return client
}

