import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2, ImagePlus, Mail, MapPin, Phone, Search, Trash2, UserRound } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/features/auth/auth-context'
import { useDashboardData } from '@/hooks/use-dashboard-data'
import { getRegisterMetadata } from '@/lib/mock-api'
import type { RoleName } from '@/types/domain'

const PHOTO_STORAGE_KEY_PREFIX = 'mcms-profile-photo-v1'
const PROFILE_PHOTO_UPDATED_EVENT = 'profile-photo-updated'
const MAX_PHOTO_SIZE = 4 * 1024 * 1024

function photoStorageKey(userId: string) {
  return `${PHOTO_STORAGE_KEY_PREFIX}:${userId}`
}

function initialsFromName(fullName: string) {
  return fullName
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function roleLabel(role: RoleName) {
  return role
    .split('_')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ')
}

function departmentByRole(role: RoleName) {
  if (role === 'student') return 'Student Affairs'
  if (role === 'lecturer') return 'Academic Affairs'
  if (role === 'finance') return 'Finance Department'
  if (role === 'campus_admin') return 'Campus Administration'
  return 'Central Administration'
}

export function ProfilePage() {
  const { user } = useAuth()
  const dashboardQuery = useDashboardData(user?.userId)
  const registerMetadataQuery = useQuery({
    queryKey: ['register-metadata'],
    queryFn: getRegisterMetadata,
  })

  const [studentKeyword, setStudentKeyword] = useState('')
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user) {
      setPhotoDataUrl(null)
      return
    }
    setPhotoDataUrl(localStorage.getItem(photoStorageKey(user.userId)))
  }, [user?.userId])

  if (!user) return null
  const currentUser = user

  if (dashboardQuery.isLoading) {
    return <p className="text-sm text-[#5f7594]">Loading profile...</p>
  }

  if (dashboardQuery.error || !dashboardQuery.data) {
    return <p className="text-sm text-red-600">Unable to load profile data.</p>
  }

  const campusMap = new Map(
    (registerMetadataQuery.data?.campuses ?? []).map((campus) => [campus._id, campus.name] as const),
  )
  const students = dashboardQuery.data.users.filter(
    (entry) => dashboardQuery.data.userRoleMap[entry._id]?.includes('student'),
  )

  const loweredKeyword = studentKeyword.trim().toLowerCase()
  const filteredStudents = loweredKeyword
    ? students.filter(
        (student) =>
          student.fullName.toLowerCase().includes(loweredKeyword) ||
          student.email.toLowerCase().includes(loweredKeyword),
      )
    : students

  const detailRows = [
    {
      icon: Building2,
      label: 'Campus',
      value: campusMap.get(currentUser.campusId) ?? currentUser.campusId,
    },
    {
      icon: UserRound,
      label: 'Department',
      value: departmentByRole(currentUser.roles[0]),
    },
    {
      icon: Mail,
      label: 'Email Address',
      value: currentUser.email,
    },
    {
      icon: Phone,
      label: 'Phone Number',
      value: '+62 812-0000-0000',
    },
    {
      icon: MapPin,
      label: 'Residential Address',
      value: 'Alamat belum diisi',
    },
  ]

  function openPhotoPicker() {
    setPhotoError(null)
    photoInputRef.current?.click()
  }

  function deletePhoto() {
    localStorage.removeItem(photoStorageKey(currentUser.userId))
    window.dispatchEvent(new Event(PROFILE_PHOTO_UPDATED_EVENT))
    setPhotoDataUrl(null)
    setPhotoError(null)
  }

  function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setPhotoError('File harus berupa gambar (jpg, png, webp, dll).')
      return
    }

    if (file.size > MAX_PHOTO_SIZE) {
      setPhotoError('Ukuran foto maksimal 4MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const nextValue = typeof reader.result === 'string' ? reader.result : null
      if (!nextValue) {
        setPhotoError('Foto gagal diproses.')
        return
      }
      localStorage.setItem(photoStorageKey(currentUser.userId), nextValue)
      window.dispatchEvent(new Event(PROFILE_PHOTO_UPDATED_EVENT))
      setPhotoDataUrl(nextValue)
      setPhotoError(null)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="rounded-[28px] border-[#d7e2ef] p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#6f86a4]">Student Profile</p>

          <div className="relative mx-auto mt-5 w-fit">
            <Avatar className="size-52 border-4 border-white shadow-[0_20px_45px_-28px_rgba(10,39,82,0.8)]">
              {photoDataUrl && <AvatarImage src={photoDataUrl} alt={`Foto profil ${currentUser.fullName}`} />}
              <AvatarFallback className="bg-[#dce7f5] text-4xl font-black text-[#133761]">
                {initialsFromName(currentUser.fullName)}
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={openPhotoPicker}
              className="absolute bottom-1 right-1 grid size-11 place-items-center rounded-full border-4 border-white bg-[#f97316] text-white shadow-md"
              aria-label="Ganti foto profil"
            >
              <ImagePlus className="size-5" />
            </button>
          </div>

          <h1 className="mt-5 text-center text-3xl font-black text-[#102543]">{currentUser.fullName}</h1>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <Badge variant="secondary">{roleLabel(currentUser.roles[0])}</Badge>
            <Badge variant="outline">{currentUser.userId}</Badge>
          </div>

          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoChange}
          />

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Button variant="secondary" onClick={openPhotoPicker}>
              {photoDataUrl ? 'Update Foto' : 'Insert Foto'}
            </Button>
            <Button variant="outline" onClick={deletePhoto} disabled={!photoDataUrl}>
              <Trash2 className="size-4" />
              Delete Foto
            </Button>
          </div>

          <p className="mt-3 text-xs text-[#6780a0]">
            Foto diambil dari penyimpanan perangkat Anda dan disimpan per akun di browser ini.
          </p>
          {photoError && <p className="mt-2 text-sm text-red-600">{photoError}</p>}
        </Card>

        <Card className="rounded-[28px] border-[#d7e2ef] p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-2xl font-black text-[#102543]">Academic & Contact</h2>
              <p className="text-sm text-[#637d9d]">Layout desktop untuk data utama profil murid.</p>
            </div>
            <Badge variant="outline">Desktop Web</Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {detailRows.map((item) => (
              <div key={item.label} className="rounded-2xl border border-[#e1e9f3] bg-[#f7fafe] p-4">
                <div className="mb-3 grid size-11 place-items-center rounded-xl bg-[#e6edf7] text-[#1d497e]">
                  <item.icon className="size-5" />
                </div>
                <p className="text-sm text-[#5f7695]">{item.label}</p>
                <p className="mt-1 text-lg font-semibold text-[#122f55]">{item.value}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <Card className="rounded-[28px] border-[#d7e2ef] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black text-[#102543]">Data Murid Terdaftar</h2>
            <p className="text-sm text-[#637d9d]">
              Menampilkan data murid yang sudah dibuat saat register sebelumnya.
            </p>
          </div>
          <Badge variant="secondary">{filteredStudents.length} Murid</Badge>
        </div>

        <div className="mt-4 max-w-xl">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6f86a4]" />
            <Input
              value={studentKeyword}
              onChange={(event) => setStudentKeyword(event.target.value)}
              placeholder="Cari nama atau email murid..."
              className="pl-9"
            />
          </div>
        </div>

        <div className="mt-5 overflow-x-auto rounded-2xl border border-[#e2eaf4]">
          <table className="min-w-full text-sm">
            <thead className="bg-[#f4f8fd] text-left text-[#607896]">
              <tr>
                <th className="px-3 py-3">No</th>
                <th className="px-3 py-3">Nama Murid</th>
                <th className="px-3 py-3">Email</th>
                <th className="px-3 py-3">Campus</th>
                <th className="px-3 py-3">Role</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-5 text-center text-[#7088a6]">
                    Tidak ada data murid yang cocok.
                  </td>
                </tr>
              )}
              {filteredStudents.map((student, index) => (
                <tr key={student._id} className="border-t border-[#e7edf6] text-[#17385f]">
                  <td className="px-3 py-3">{index + 1}</td>
                  <td className="px-3 py-3 font-semibold">{student.fullName}</td>
                  <td className="px-3 py-3">{student.email}</td>
                  <td className="px-3 py-3">{campusMap.get(student.campusId) ?? student.campusId}</td>
                  <td className="px-3 py-3">
                    <Badge variant="outline">
                      {dashboardQuery.data.userRoleMap[student._id]?.join(', ') ?? 'student'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
