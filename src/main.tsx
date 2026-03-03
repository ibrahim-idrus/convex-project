import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConvexProvider } from 'convex/react'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { AuthProvider } from '@/features/auth/auth-context'
import { getConvexClient } from '@/lib/convex-client'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      refetchOnWindowFocus: true,
    },
  },
})

const convexUrl = import.meta.env.VITE_CONVEX_URL

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {convexUrl ? (
      <ConvexProvider client={getConvexClient()}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider>
              <App />
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </ConvexProvider>
    ) : (
      <main className="grid min-h-screen place-items-center p-6">
        <div className="max-w-xl rounded-2xl border border-[#d6dfec] bg-white p-6 text-[#12315e]">
          <h1 className="text-xl font-bold">Convex URL belum diset</h1>
          <p className="mt-2 text-sm">
            Jalankan <code>npx convex dev</code> lalu pastikan <code>VITE_CONVEX_URL</code> terisi di file{' '}
            <code>.env.local</code>.
          </p>
        </div>
      </main>
    )}
  </StrictMode>,
)
