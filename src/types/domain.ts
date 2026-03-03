export type RoleName = 'super_admin' | 'campus_admin' | 'lecturer' | 'student' | 'finance'

export type AttendanceStatus = 'present' | 'absent' | 'late'
export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'overdue'

export interface User {
  _id: string
  email: string
  passwordHash: string
  fullName: string
  campusId: string
  createdAt: number
}

export interface Campus {
  _id: string
  name: string
  address: string
}

export interface Semester {
  _id: string
  name: string
  academicYear: string
  isActive: boolean
  campusId: string
  isClosed: boolean
}

export interface Subject {
  _id: string
  name: string
  credits: number
  lecturerId: string
  campusId: string
}

export interface Enrollment {
  _id: string
  studentId: string
  subjectId: string
  semesterId: string
}

export interface Grade {
  _id: string
  enrollmentId: string
  gradeValue: string
  locked: boolean
}

export interface Attendance {
  _id: string
  enrollmentId: string
  date: number
  status: AttendanceStatus
}

export interface Payment {
  _id: string
  studentId: string
  semesterId: string
  amount: number
  status: PaymentStatus
  invoiceNumber: string
}

export interface Scholarship {
  _id: string
  studentId: string
  percentage: number
  semesterId: string
}

export interface Announcement {
  _id: string
  title: string
  content: string
  campusId: string
  createdBy: string
  createdAt: number
}

export interface ChatMessage {
  _id: string
  senderId: string
  receiverId: string
  message: string
  createdAt: number
}

export interface Material {
  _id: string
  subjectId: string
  uploadedBy: string
  title: string
  fileUrl: string
  createdAt: number
}

export interface DocumentUpload {
  _id: string
  campusId: string
  uploadedBy: string
  title: string
  fileUrl: string
  createdAt: number
}

export interface Notification {
  _id: string
  userId: string
  type: string
  referenceId: string
  isRead: boolean
  createdAt: number
}

export interface AuditLog {
  _id: string
  userId: string
  action: string
  targetType: string
  targetId: string
  timestamp: number
}

export interface Role {
  _id: string
  name: RoleName
}

export interface UserRole {
  _id: string
  userId: string
  roleId: string
}

export interface SessionUser {
  userId: string
  fullName: string
  email: string
  campusId: string
  roles: RoleName[]
}
