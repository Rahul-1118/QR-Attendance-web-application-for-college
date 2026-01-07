
import { User, UserRole, AttendanceSession, AttendanceRecord, Subject } from './types';

const STORAGE_KEYS = {
  USERS: 'qra_users',
  SESSIONS: 'qra_sessions',
  RECORDS: 'qra_records',
  SUBJECTS: 'qra_subjects'
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
    if (this.getUsers().length === 0) {
      const initialUsers: User[] = [
        { id: '1', name: 'System Admin', email: 'admin@college.edu', role: UserRole.ADMIN, password: 'password' },
        { id: '2', name: 'Dr. Sarah Johnson', email: 'sarah@college.edu', role: UserRole.TEACHER, department: 'CS', password: 'password' },
        { id: '3', name: 'John Doe', email: 'john@college.edu', role: UserRole.STUDENT, department: 'CS', year: '3rd', section: 'A', rollNumber: 'CS301', password: 'password' },
        { id: '4', name: 'Jane Smith', email: 'jane@college.edu', role: UserRole.STUDENT, department: 'CS', year: '3rd', section: 'A', rollNumber: 'CS302', password: 'password' }
      ];
      this.set(STORAGE_KEYS.USERS, initialUsers);

      const initialSubjects: Subject[] = [
        { id: 's1', name: 'Data Structures', code: 'CS101', department: 'CS' },
        { id: 's2', name: 'Operating Systems', code: 'CS201', department: 'CS' },
        { id: 's3', name: 'Web Development', code: 'CS301', department: 'CS' }
      ];
      this.set(STORAGE_KEYS.SUBJECTS, initialSubjects);
    }
  }
}
