
import * as React from 'react';
import { useState, useEffect } from 'react';
import { User, UserRole } from './types';
import { Database } from './store';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import TeacherDashboard from './components/TeacherDashboard';
import StudentDashboard from './components/StudentDashboard';
import DeptHeadDashboard from './components/DeptHeadDashboard';
import Navbar from './components/Navbar';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        await Database.init();
        const savedUser = localStorage.getItem('qra_current_user');
        if (savedUser) {
          setUser(JSON.parse(savedUser));
        }
      } catch (error) {
        console.error("Initialization failed:", error);
      } finally {
        setLoading(false);
      }
    };
    
    initializeApp();
  }, []);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    localStorage.setItem('qra_current_user', JSON.stringify(loggedInUser));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('qra_current_user');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        <p className="text-slate-500 font-medium animate-pulse">Connecting to Cloud Database...</p>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar user={user} onLogout={handleLogout} />
      <main className="flex-1 container mx-auto px-4 py-8">
        {user.role === UserRole.ADMIN && <AdminDashboard />}
        {user.role === UserRole.DEPT_HEAD && <DeptHeadDashboard hod={user} />}
        {user.role === UserRole.TEACHER && <TeacherDashboard teacher={user} />}
        {user.role === UserRole.STUDENT && <StudentDashboard student={user} />}
      </main>
      <footer className="bg-white border-t py-4 text-center text-slate-500 text-sm">
        &copy; {new Date().getFullYear()} QR-Attend Management System. All rights reserved.
      </footer>
    </div>
  );
};

export default App;
