
export enum UserRole {
  ADMIN = 'ADMIN',
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  password?: string;
  department?: string;
  year?: string;
  section?: string;
  rollNumber?: string;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  department: string;
}

export interface AttendanceSession {
  id: string;
  teacherId: string;
  subjectId: string;
  department: string;
  year: string;
  section: string;
  period: string;
  startTime: number;
  expiryTime: number;
  qrPayload: string;
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  studentId: string;
  timestamp: number;
}

export interface DashboardStats {
  totalStudents: number;
  totalTeachers: number;
  activeSessions: number;
  todayAttendanceRate: number;
}
