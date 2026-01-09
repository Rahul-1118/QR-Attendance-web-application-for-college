import { initializeApp, FirebaseApp, getApp, getApps } from 'firebase/app';
import { getDatabase, ref, onValue, set, update, remove, Database as FirebaseRTDB } from 'firebase/database';
import { useState, useEffect } from 'react';
import { User, UserRole, AttendanceSession, AttendanceRecord, Subject, Department } from './types';

const firebaseConfig = {
  apiKey: process.env.API_KEY,
  authDomain: "qr-attend-system.firebaseapp.com",
  databaseURL: "https://qr-attend-system-default-rtdb.firebaseio.com",
  projectId: "qr-attend-system",
  storageBucket: "qr-attend-system.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

let app: FirebaseApp | null = null;
let db: FirebaseRTDB | null = null;

const STORAGE_PATHS = {
  USERS: 'users',
  SESSIONS: 'sessions',
  RECORDS: 'records',
  SUBJECTS: 'subjects',
  DEPARTMENTS: 'departments'
};

const LOCAL_STORAGE_KEY = 'qra_offline_cache';

type Listener = () => void;

export class Database {
  private static listeners: Set<Listener> = new Set();
  private static cache: {
    users: User[];
    sessions: AttendanceSession[];
    records: AttendanceRecord[];
    subjects: Subject[];
    departments: Department[];
  } = {
    users: [],
    sessions: [],
    records: [],
    subjects: [],
    departments: []
  };

  private static initialized = false;
  private static isLocalMode = false;

  // Fix: Ensure the returned unsubscription function returns void to avoid React useEffect type errors
  static subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private static notify() {
    this.cache = { ...this.cache };
    this.listeners.forEach(l => l());
    // Persist to localStorage to allow other tabs to see the change
    this.persistToLocal();
  }

  private static persistToLocal() {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.cache));
  }

  private static loadFromLocal() {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.cache = { ...this.cache, ...parsed };
      } catch (e) {
        console.error("Failed to parse local cache", e);
      }
    }
  }

  static async init(): Promise<void> {
    if (this.initialized) return;

    // Load initial state
    this.loadFromLocal();

    // Listen for changes from OTHER tabs (Crucial for Local Mode testing)
    window.addEventListener('storage', (event) => {
      if (event.key === LOCAL_STORAGE_KEY) {
        this.loadFromLocal();
        this.notify();
      }
    });

    try {
      if (!getApps().length) {
        app = initializeApp(firebaseConfig);
      } else {
        app = getApp();
      }

      db = getDatabase(app);
      
      const paths = Object.values(STORAGE_PATHS);
      paths.forEach(path => {
        if (!db) return;
        const dbRef = ref(db, path);
        onValue(dbRef, (snapshot) => {
          const val = snapshot.val();
          const data = val ? (Object.values(val) as any[]) : [];
          
          if (path === STORAGE_PATHS.USERS) this.cache.users = data;
          if (path === STORAGE_PATHS.SESSIONS) this.cache.sessions = data;
          if (path === STORAGE_PATHS.RECORDS) this.cache.records = data;
          if (path === STORAGE_PATHS.SUBJECTS) this.cache.subjects = data;
          if (path === STORAGE_PATHS.DEPARTMENTS) this.cache.departments = data;
          
          this.notify();
        });
      });

      this.initialized = true;
      await this.seed();
    } catch (err) {
      this.isLocalMode = true;
      await this.seed();
      this.initialized = true;
    }
    
    // Final notification after init
    this.notify();
  }

  // Resilient normalization for batch matching
  static normalize(val: string | undefined): string {
    if (!val) return "";
    return val.toString().trim().toLowerCase().replace(/\s+year/g, "");
  }

  static getUsers() { return [...this.cache.users]; }
  static getSessions() { return [...this.cache.sessions]; }
  static getRecords() { return [...this.cache.records]; }
  static getSubjects() { return [...this.cache.subjects]; }
  static getDepartments() { return [...this.cache.departments]; }

  static async addSession(session: AttendanceSession): Promise<void> {
    this.cache.sessions = [...this.cache.sessions, session];
    this.notify();
    if (db) {
      try { await set(ref(db, `${STORAGE_PATHS.SESSIONS}/${session.id}`), session); } catch (e) {}
    }
  }

  static async addRecord(record: AttendanceRecord): Promise<void> {
    this.cache.records = [...this.cache.records, record];
    this.notify();
    if (db) {
      try { await set(ref(db, `${STORAGE_PATHS.RECORDS}/${record.id}`), record); } catch (e) {}
    }
  }

  static async deleteRecord(id: string): Promise<void> {
    this.cache.records = this.cache.records.filter(r => r.id !== id);
    this.notify();
    if (db) {
      try { await remove(ref(db, `${STORAGE_PATHS.RECORDS}/${id}`)); } catch (e) {}
    }
  }

  static async deleteUser(id: string): Promise<void> {
    this.cache.users = this.cache.users.filter(u => u.id !== id);
    this.notify();
    if (db) {
      try { await remove(ref(db, `${STORAGE_PATHS.USERS}/${id}`)); } catch (e) {}
    }
  }

  static async addUser(user: User): Promise<void> {
    const exists = this.cache.users.find(u => u.id === user.id);
    if (!exists) {
      this.cache.users = [...this.cache.users, user];
    } else {
      this.cache.users = this.cache.users.map(u => u.id === user.id ? user : u);
    }
    this.notify();
    if (db) {
      try { await set(ref(db, `${STORAGE_PATHS.USERS}/${user.id}`), user); } catch (e) {}
    }
  }

  static async addDepartment(dept: Department): Promise<void> {
    this.cache.departments = [...this.cache.departments, dept];
    this.notify();
    if (db) {
      try { await set(ref(db, `${STORAGE_PATHS.DEPARTMENTS}/${dept.id}`), dept); } catch (e) {}
    }
  }

  static async deleteDepartment(id: string): Promise<void> {
    this.cache.departments = this.cache.departments.filter(d => d.id !== id);
    this.notify();
    if (db) {
      try { await remove(ref(db, `${STORAGE_PATHS.DEPARTMENTS}/${id}`)); } catch (e) {}
    }
  }

  static async seed(): Promise<void> {
    if (this.cache.users.length > 0) return;
    const initialDepts: Department[] = [
      { id: 'd1', name: 'Computer Science', code: 'CS' },
      { id: 'd2', name: 'Electrical Engineering', code: 'EE' }
    ];
    const initialUsers: User[] = [
      { id: '1', name: 'Admin', email: 'admin@college.edu', role: UserRole.ADMIN, password: 'password' },
      { id: '2', name: 'Dr. Sarah Johnson', email: 'sarah@college.edu', role: UserRole.TEACHER, department: 'CS', password: 'password' },
      { id: '3', name: 'John Doe', email: 'john@college.edu', role: UserRole.STUDENT, department: 'CS', year: '3rd', section: 'A', rollNumber: 'CS301', password: 'password' }
    ];
    const initialSubjects: Subject[] = [
      { id: 's1', name: 'Data Structures', code: 'CS101', department: 'CS' },
      { id: 's3', name: 'Web Development', code: 'CS301', department: 'CS' }
    ];
    this.cache.departments = initialDepts;
    this.cache.users = initialUsers;
    this.cache.subjects = initialSubjects;
    this.notify();
  }
}

export function useDatabase() {
  const [data, setData] = useState({
    users: Database.getUsers(),
    sessions: Database.getSessions(),
    records: Database.getRecords(),
    subjects: Database.getSubjects(),
    departments: Database.getDepartments()
  });
  // Fix: The subscribe method now returns () => void, satisfying EffectCallback requirements
  useEffect(() => {
    return Database.subscribe(() => {
      setData({
        users: Database.getUsers(),
        sessions: Database.getSessions(),
        records: Database.getRecords(),
        subjects: Database.getSubjects(),
        departments: Database.getDepartments()
      });
    });
  }, []);
  return data;
}
