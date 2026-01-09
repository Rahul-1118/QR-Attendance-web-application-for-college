
import React, { useState, useMemo } from 'react';
import { Database, useDatabase } from '../store';
import { User, UserRole, Subject, Department } from '../types';
import { Users, BookOpen, BarChart3, Plus, Trash2, Edit2, Search, FileDown, X, ShieldCheck, UserCog, GraduationCap, Building2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';

const AdminDashboard: React.FC = () => {
  const { users, subjects, departments, records } = useDatabase();
  const [activeTab, setActiveTab] = useState<'users' | 'subjects' | 'reports' | 'departments'>('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [formData, setFormData] = useState<Partial<User>>({
    role: UserRole.STUDENT,
    name: '',
    email: '',
    password: 'password',
    department: 'CS',
    year: '1st',
    section: 'A',
    rollNumber: ''
  });

  const [deptForm, setDeptForm] = useState({ name: '', code: '' });

  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.role.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [users, searchQuery]);

  const stats = useMemo(() => {
    const studentCount = users.filter(u => u.role === UserRole.STUDENT).length;
    const teacherCount = users.filter(u => u.role === UserRole.TEACHER).length;
    const adminCount = users.filter(u => u.role === UserRole.ADMIN).length;
    
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('en-US', { weekday: 'short' });
      const count = records.filter(r => {
        const rd = new Date(r.timestamp);
        return rd.toDateString() === d.toDateString();
      }).length;
      return { name: dateStr, count };
    }).reverse();

    return { studentCount, teacherCount, adminCount, last7Days };
  }, [users, records]);

  const handleOpenModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData(user);
    } else {
      setEditingUser(null);
      setFormData({
        role: UserRole.STUDENT,
        name: '',
        email: '',
        password: 'password',
        department: departments[0]?.code || 'CS',
        year: '1st',
        section: 'A',
        rollNumber: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      // Use addUser instead of updateUser as Database.addUser handles both insert and update logic.
      await Database.addUser({ ...editingUser, ...formData } as User);
    } else {
      await Database.addUser({
        ...formData,
        id: Math.random().toString(36).substr(2, 9)
      } as User);
    }
    setIsModalOpen(false);
  };

  const handleDeleteUser = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      await Database.deleteUser(id);
    }
  };

  const handleAddDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptForm.name || !deptForm.code) return;
    await Database.addDepartment({
      id: Math.random().toString(36).substr(2, 9),
      name: deptForm.name,
      code: deptForm.code.toUpperCase()
    });
    setDeptForm({ name: '', code: '' });
  };

  const handleDeleteDept = async (id: string) => {
    if (window.confirm('Delete this department?')) {
      await Database.deleteDepartment(id);
    }
  }

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(users);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "All_Users");
    XLSX.writeFile(workbook, "College_System_Users.xlsx");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Administrator Panel</h1>
          <p className="text-slate-500">Global oversight of Institutional Structure</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportToExcel} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
            <FileDown size={18} /> Export Data
          </button>
          <button onClick={() => handleOpenModal()} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
            <Plus size={18} /> Add User
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center"><GraduationCap size={20} /></div>
          <div><p className="text-slate-500 text-xs font-medium">Students</p><p className="text-xl font-bold text-slate-800">{stats.studentCount}</p></div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center"><UserCog size={20} /></div>
          <div><p className="text-slate-500 text-xs font-medium">Teachers</p><p className="text-xl font-bold text-slate-800">{stats.teacherCount}</p></div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center"><Building2 size={20} /></div>
          <div><p className="text-slate-500 text-xs font-medium">Departments</p><p className="text-xl font-bold text-slate-800">{departments.length}</p></div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center"><ShieldCheck size={20} /></div>
          <div><p className="text-slate-500 text-xs font-medium">Admins</p><p className="text-xl font-bold text-slate-800">{stats.adminCount}</p></div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="flex border-b overflow-x-auto">
          {['users', 'departments', 'subjects', 'reports'].map((tab) => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-6 py-4 text-sm font-medium transition-colors capitalize ${activeTab === tab ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {tab === 'subjects' ? 'Course Catalog' : tab === 'reports' ? 'Analytics' : tab}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="text" placeholder="Filter users..." className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600 border-b">
                    <tr><th className="px-4 py-3 font-semibold">User Details</th><th className="px-4 py-3 font-semibold">Role</th><th className="px-4 py-3 font-semibold">Institutional Info</th><th className="px-4 py-3 font-semibold text-right">Actions</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3"><p className="font-semibold text-slate-800">{u.name}</p><p className="text-xs text-slate-500">{u.email}</p></td>
                        <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${u.role === UserRole.ADMIN ? 'bg-orange-100 text-orange-700' : u.role === UserRole.TEACHER ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{u.role}</span></td>
                        <td className="px-4 py-3 text-slate-600 text-xs">{u.role === UserRole.ADMIN ? 'System Admin' : u.role === UserRole.TEACHER ? `Dept: ${u.department}` : `Dept: ${u.department}, Roll: ${u.rollNumber}`}</td>
                        <td className="px-4 py-3 text-right"><div className="flex items-center justify-end gap-2"><button onClick={() => handleOpenModal(u)} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"><Edit2 size={16} /></button><button onClick={() => handleDeleteUser(u.id)} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"><Trash2 size={16} /></button></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'departments' && (
            <div className="space-y-6">
              <form onSubmit={handleAddDept} className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Dept Name</label>
                  <input type="text" required className="w-full p-2 bg-white border border-slate-200 rounded-lg" value={deptForm.name} onChange={(e) => setDeptForm({...deptForm, name: e.target.value})} />
                </div>
                <div className="w-full md:w-32">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Code</label>
                  <input type="text" required className="w-full p-2 bg-white border border-slate-200 rounded-lg" value={deptForm.code} onChange={(e) => setDeptForm({...deptForm, code: e.target.value})} />
                </div>
                <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold">Add Department</button>
              </form>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {departments.map(d => (
                  <div key={d.id} className="p-4 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
                    <div><h4 className="font-bold text-slate-800">{d.name}</h4><p className="text-xs text-indigo-600 font-bold uppercase">{d.code}</p></div>
                    <button onClick={() => handleDeleteDept(d.id)} className="p-2 text-slate-400 hover:text-red-600 transition-colors"><Trash2 size={18} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'subjects' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {subjects.map(s => (
                <div key={s.id} className="p-4 border border-slate-200 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded uppercase">{s.code}</span>
                    <span className="text-xs text-slate-400">{s.department} Dept</span>
                  </div>
                  <h3 className="font-bold text-slate-800">{s.name}</h3>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.last7Days}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                  <Tooltip cursor={{fill: '#f8fafc'}} />
                  <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b bg-slate-50 flex justify-between">
              <h3 className="font-bold text-slate-800">{editingUser ? 'Edit User' : 'Create User'}</h3>
              <button onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              <select className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg" value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value as UserRole})}>
                <option value={UserRole.ADMIN}>Admin</option><option value={UserRole.TEACHER}>Teacher</option><option value={UserRole.STUDENT}>Student</option>
              </select>
              <input type="text" required className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="Name" />
              <input type="email" required className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="Email" />
              {formData.role !== UserRole.ADMIN && (
                <select className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg" value={formData.department} onChange={(e) => setFormData({...formData, department: e.target.value})}>
                  {departments.map(d => <option key={d.id} value={d.code}>{d.name}</option>)}
                </select>
              )}
              <div className="flex gap-3"><button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 border rounded-lg">Cancel</button><button type="submit" className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg">Save</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
