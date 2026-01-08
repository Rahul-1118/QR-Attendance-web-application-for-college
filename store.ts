
import { User, UserRole, AttendanceSession, AttendanceRecord, Subject, Department } from './types';

const STORAGE_KEYS = {
  USERS: 'qra_users',
  SESSIONS: 'qra_sessions',
  RECORDS: 'qra_records',
  SUBJECTS: 'qra_subjects',
  DEPARTMENTS: 'qra_departments'
};

export class Database {
  private static get<T>(key: string): T[] {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  }

  private static set<T>(key: string, data: T[]): void {
    localStorage.setItem(key, JSON.stringify(data));
  }

  // User Methods
  static getUsers(): User[] {
    return this.get<User>(STORAGE_KEYS.USERS);
  }

  static findUserByRollNumber(rollNumber: string): User | undefined {
    return this.getUsers().find(u => u.rollNumber === rollNumber);
  }

  static addUser(user: User): void {
    const users = this.getUsers();
    this.set(STORAGE_KEYS.USERS, [...users, user]);
  }

  static updateUser(updatedUser: User): void {
    const users = this.getUsers().map(u => u.id === updatedUser.id ? updatedUser : u);
    this.set(STORAGE_KEYS.USERS, users);
  }

  static deleteUser(id: string): void {
    const users = this.getUsers().filter(u => u.id !== id);
    this.set(STORAGE_KEYS.USERS, users);
  }

  // Department Methods
  static getDepartments(): Department[] {
    return this.get<Department>(STORAGE_KEYS.DEPARTMENTS);
  }

  static addDepartment(dept: Department): void {
    const depts = this.getDepartments();
    this.set(STORAGE_KEYS.DEPARTMENTS, [...depts, dept]);
  }

  static deleteDepartment(id: string): void {
    const depts = this.getDepartments().filter(d => d.id !== id);
    this.set(STORAGE_KEYS.DEPARTMENTS, depts);
  }

  // Subject Methods
  static getSubjects(): Subject[] {
    return this.get<Subject>(STORAGE_KEYS.SUBJECTS);
  }

  static addSubject(subject: Subject): void {
    const subjects = this.getSubjects();
    this.set(STORAGE_KEYS.SUBJECTS, [...subjects, subject]);
  }

  // Attendance Sessions
  static getSessions(): AttendanceSession[] {
    return this.get<AttendanceSession>(STORAGE_KEYS.SESSIONS);
  }

  static addSession(session: AttendanceSession): void {
    const sessions = this.getSessions();
    this.set(STORAGE_KEYS.SESSIONS, [...sessions, session]);
  }

  // Attendance Records
  static getRecords(): AttendanceRecord[] {
    return this.get<AttendanceRecord>(STORAGE_KEYS.RECORDS);
  }

  static addRecord(record: AttendanceRecord): void {
    const records = this.getRecords();
    this.set(STORAGE_KEYS.RECORDS, [...records, record]);
  }

  static seed(): void {
    if (this.getDepartments().length === 0) {
      const initialDepts: Department[] = [
        { id: 'd1', name: 'Computer Science', code: 'CS' },
        { id: 'd2', name: 'Electrical Engineering', code: 'EE' },
        { id: 'd3', name: 'Mechanical Engineering', code: 'ME' }
      ];
      this.set(STORAGE_KEYS.DEPARTMENTS, initialDepts);
    }

    if (this.getUsers().length === 0) {
      const initialUsers: User[] = [
        { id: '1', name: 'System Admin', email: 'admin@college.edu', role: UserRole.ADMIN, password: 'password' },
        { id: '2', name: 'Dr. Sarah Johnson', email: 'sarah@college.edu', role: UserRole.TEACHER, department: 'CS', password: 'password' },
        { id: '3', name: 'John Doe', email: 'john@college.edu', role: UserRole.STUDENT, department: 'CS', year: '3rd', section: 'A', rollNumber: 'CS301', password: 'password' },
        { id: '4', name: 'Jane Smith', email: 'jane@college.edu', role: UserRole.STUDENT, department: 'CS', year: '3rd', section: 'A', rollNumber: 'CS302', password: 'password' },
        { id: '5', name: 'Prof. Alan Turring', email: 'hod@college.edu', role: UserRole.DEPT_HEAD, department: 'CS', password: 'password' }
      ];
      this.set(STORAGE_KEYS.USERS, initialUsers);

      const initialSubjects: Subject[] = [
        { id: 's1', name: 'Data Structures', code: 'CS101', department: 'CS' },
        { id: 's2', name: 'Operating Systems', code: 'CS201', department: 'CS' },
        { id: 's3', name: 'Web Development', code: 'CS301', department: 'CS' }
      ];
      this.set(STORAGE_KEYS.SUBJECTS, initialSubjects);

      const now = Date.now();
      const mockSessions: AttendanceSession[] = [
        {
          id: 'active-demo-session',
          teacherId: '2',
          subjectId: 's1',
          department: 'CS',
          year: '3rd',
          section: 'A',
          period: '1',
          startTime: now,
          expiryTime: now + (24 * 60 * 60 * 1000), // Active for 24 hours for demo purposes
          qrPayload: 'DEMO_QR_ACTIVE'
        },
        {
          id: 'mock-s2',
          teacherId: '2',
          subjectId: 's3',
          department: 'CS',
          year: '3rd',
          section: 'A',
          period: '2',
          startTime: now - (1 * 24 * 60 * 60 * 1000), 
          expiryTime: now - (1 * 24 * 60 * 60 * 1000) + (10 * 60 * 1000),
          qrPayload: 'MOCK_QR_2'
        }
      ];
      this.set(STORAGE_KEYS.SESSIONS, mockSessions);

      const mockRecords: AttendanceRecord[] = [
        { id: 'mr3', sessionId: 'mock-s2', studentId: '3', timestamp: now - (1 * 24 * 60 * 60 * 1000) + 1500 },
        { id: 'mr4', sessionId: 'mock-s2', studentId: '4', timestamp: now - (1 * 24 * 60 * 60 * 1000) + 2500 }
      ];
      this.set(STORAGE_KEYS.RECORDS, mockRecords);
    }
  }
}
