import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Navigate } from 'react-router-dom'
import { z } from 'zod'
import { useAuth } from '@/features/auth/auth-context'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { getRegisterMetadata } from '@/lib/mock-api'

const loginSchema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
})

const registerSchema = z.object({
  fullName: z.string().min(3, 'Nama minimal 3 karakter'),
  email: z.string().email('Email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  campusId: z.string().min(1, 'Campus wajib dipilih'),
  role: z.enum(['student', 'lecturer', 'finance', 'campus_admin']),
})

type LoginValues = z.infer<typeof loginSchema>
type RegisterValues = z.infer<typeof registerSchema>

export function LoginPage() {
  const { isAuthenticated, login, register } = useAuth()
  const metadataQuery = useQuery({
    queryKey: ['register-metadata'],
    queryFn: getRegisterMetadata,
  })

  const loginForm = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'student@educentral.dev',
      password: 'admin123',
    },
  })

  const registerForm = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      campusId: '',
      role: 'student',
    },
  })

  const loginMutation = useMutation({
    mutationFn: (values: LoginValues) => login(values),
  })

  const registerMutation = useMutation({
    mutationFn: (values: RegisterValues) => register(values),
  })

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,#dfe9fb,#f7f9fc_60%)] p-4 lg:p-8">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-2">
        <Card className="rounded-3xl border-[#d4dfef] p-6 lg:p-8">
          <h1 className="text-3xl font-black text-[#0f2f5f]">Multi-Campus College Management</h1>
          <p className="mt-2 text-sm text-[#5f7594]">
            Login untuk mengakses dashboard berdasarkan role. Sistem mendukung multi-role dan RBAC.
          </p>

          <form
            className="mt-6 space-y-3"
            onSubmit={loginForm.handleSubmit((values) => loginMutation.mutate(values))}
          >
            <div>
              <label className="mb-1 block text-sm font-medium text-[#1d3f6e]">Email</label>
              <Input {...loginForm.register('email')} />
              {loginForm.formState.errors.email && (
                <p className="mt-1 text-xs text-red-600">{loginForm.formState.errors.email.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[#1d3f6e]">Password</label>
              <Input type="password" {...loginForm.register('password')} />
              {loginForm.formState.errors.password && (
                <p className="mt-1 text-xs text-red-600">{loginForm.formState.errors.password.message}</p>
              )}
            </div>
            {loginMutation.error && (
              <p className="text-sm text-red-600">{(loginMutation.error as Error).message}</p>
            )}
            <Button className="w-full" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? 'Memproses...' : 'Login'}
            </Button>
          </form>

          <div className="mt-5 rounded-xl bg-[#f2f6fc] p-3 text-xs text-[#4f6788]">
            <p className="font-semibold">Demo credentials:</p>
            <p>super@educentral.dev / admi      n123</p>
            <p>campusadmin@educentral.dev / admin123</p>
            <p>lecturer@educentral.dev / admin123</p>
            <p>student@educentral.dev / admin123</p>
            <p>finance@educentral.dev / admin123</p>
          </div>
        </Card>

        <Card className="rounded-3xl border-[#d4dfef] p-6 lg:p-8">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-[#0f2f5f]">Register User</h2>
            <Badge variant="outline">Admin assisted</Badge>
          </div>

          <form
            className="mt-5 space-y-3"
            onSubmit={registerForm.handleSubmit((values) => registerMutation.mutate(values))}
          >
            <div>
              <label className="mb-1 block text-sm font-medium text-[#1d3f6e]">Full Name</label>
              <Input {...registerForm.register('fullName')} />
              {registerForm.formState.errors.fullName && (
                <p className="mt-1 text-xs text-red-600">{registerForm.formState.errors.fullName.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[#1d3f6e]">Email</label>
              <Input {...registerForm.register('email')} />
              {registerForm.formState.errors.email && (
                <p className="mt-1 text-xs text-red-600">{registerForm.formState.errors.email.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[#1d3f6e]">Password</label>
              <Input type="password" {...registerForm.register('password')} />
              {registerForm.formState.errors.password && (
                <p className="mt-1 text-xs text-red-600">{registerForm.formState.errors.password.message}</p>
              )}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-[#1d3f6e]">Campus</label>
                <select
                  className="h-11 w-full rounded-xl border border-[#d5deeb] bg-[#eff4fb] px-3 text-sm text-[#12315e]"
                  {...registerForm.register('campusId')}
                >
                  <option value="">Select campus</option>
                  {metadataQuery.data?.campuses.map((campus) => (
                    <option key={campus._id} value={campus._id}>
                      {campus.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[#1d3f6e]">Role</label>
                <select
                  className="h-11 w-full rounded-xl border border-[#d5deeb] bg-[#eff4fb] px-3 text-sm text-[#12315e]"
                  {...registerForm.register('role')}
                >
                  <option value="student">Student</option>
                  <option value="lecturer">Lecturer</option>
                  <option value="finance">Finance</option>
                  <option value="campus_admin">Campus Admin</option>
                </select>
              </div>
            </div>
            {metadataQuery.isLoading && <p className="text-xs text-[#6b819f]">Loading campus data...</p>}
            {registerForm.formState.errors.campusId && (
              <p className="text-xs text-red-600">{registerForm.formState.errors.campusId.message}</p>
            )}
            {registerMutation.error && (
              <p className="text-sm text-red-600">{(registerMutation.error as Error).message}</p>
            )}
            <Button className="w-full" disabled={registerMutation.isPending}>
              {registerMutation.isPending ? 'Memproses...' : 'Register & Login'}
            </Button>
          </form>
        </Card>
      </div>
    </main>
  )
}
