
import React, { useState, useEffect } from 'react';
import { User, UserRole } from './types';
import { Database } from './store';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import TeacherDashboard from './components/TeacherDashboard';
import StudentDashboard from './components/StudentDashboard';
import Navbar from './components/Navbar';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Database.seed();
    const savedUser = localStorage.getItem('qra_current_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
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
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
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
