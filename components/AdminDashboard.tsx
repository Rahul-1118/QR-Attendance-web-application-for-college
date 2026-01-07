
import React, { useState, useMemo } from 'react';
import { Database } from '../store';
import { User, UserRole, Subject, Department } from '../types';
import { Users, BookOpen, BarChart3, Plus, Trash2, Edit2, Search, FileDown, X, ShieldCheck, UserCog, GraduationCap, Building2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'subjects' | 'reports' | 'departments'>('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Form State
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

  // Dept Form State
  const [deptForm, setDeptForm] = useState({ name: '', code: '' });

  const users = Database.getUsers();
  const subjects = Database.getSubjects();
  const departments = Database.getDepartments();
  const records = Database.getRecords();

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
        department: departments[0]?.code || '',
        year: '1st',
        section: 'A',
        rollNumber: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      Database.updateUser({ ...editingUser, ...formData } as User);
    } else {
      Database.addUser({
        ...formData,
        id: Math.random().toString(36).substr(2, 9)
      } as User);
    }
    setIsModalOpen(false);
  };

  const handleDeleteUser = (id: string) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      Database.deleteUser(id);
      window.location.reload(); 
    }
  };

  const handleAddDept = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptForm.name || !deptForm.code) return;
    Database.addDepartment({
      id: Math.random().toString(36).substr(2, 9),
      name: deptForm.name,
      code: deptForm.code.toUpperCase()
    });
    setDeptForm({ name: '', code: '' });
    window.location.reload();
  };

  const handleDeleteDept = (id: string) => {
    if (window.confirm('Delete this department? All associated data will remain but dropdowns will update.')) {
      Database.deleteDepartment(id);
      window.location.reload();
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
          <button 
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
          >
            <FileDown size={18} />
            Export Data
          </button>
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus size={18} />
            Add User
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
            <GraduationCap size={20} />
          </div>
          <div>
            <p className="text-slate-500 text-xs font-medium">Students</p>
            <p className="text-xl font-bold text-slate-800">{stats.studentCount}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center">
            <UserCog size={20} />
          </div>
          <div>
            <p className="text-slate-500 text-xs font-medium">Teachers</p>
            <p className="text-xl font-bold text-slate-800">{stats.teacherCount}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center">
            <Building2 size={20} />
          </div>
          <div>
            <p className="text-slate-500 text-xs font-medium">Departments</p>
            <p className="text-xl font-bold text-slate-800">{departments.length}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center">
            <ShieldCheck size={20} />
          </div>
          <div>
            <p className="text-slate-500 text-xs font-medium">Admins</p>
            <p className="text-xl font-bold text-slate-800">{stats.adminCount}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="flex border-b overflow-x-auto">
          <button 
            onClick={() => setActiveTab('users')}
            className={`px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'users' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-slate-500 hover:text-slate-700'}`}
          >
            User Records
          </button>
          <button 
            onClick={() => setActiveTab('departments')}
            className={`px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'departments' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Departments
          </button>
          <button 
            onClick={() => setActiveTab('subjects')}
            className={`px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'subjects' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Course Catalog
          </button>
          <button 
            onClick={() => setActiveTab('reports')}
            className={`px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'reports' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Analytics
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Filter users by name, email, or role..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600 border-b">
                    <tr>
                      <th className="px-4 py-3 font-semibold">User Details</th>
                      <th className="px-4 py-3 font-semibold">Role</th>
                      <th className="px-4 py-3 font-semibold">Institutional Info</th>
                      <th className="px-4 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-800">{u.name}</p>
                          <p className="text-xs text-slate-500">{u.email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                            u.role === UserRole.ADMIN ? 'bg-orange-100 text-orange-700' :
                            u.role === UserRole.TEACHER ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">
                          {u.role === UserRole.ADMIN ? (
                            'System Administrator'
                          ) : u.role === UserRole.TEACHER ? (
                            `Dept: ${u.department || 'N/A'}`
                          ) : (
                            <div className="space-y-0.5">
                              <p>Dept: {u.department || 'N/A'}</p>
                              <p>Roll: {u.rollNumber || 'N/A'}</p>
                              <p>Year/Sec: {u.year} {u.section}</p>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => handleOpenModal(u)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              onClick={() => handleDeleteUser(u.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
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
                  <input 
                    type="text" required
                    placeholder="e.g. Biological Sciences"
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg"
                    value={deptForm.name}
                    onChange={(e) => setDeptForm({...deptForm, name: e.target.value})}
                  />
                </div>
                <div className="w-full md:w-32">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Code</label>
                  <input 
                    type="text" required
                    placeholder="BIO"
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg"
                    value={deptForm.code}
                    onChange={(e) => setDeptForm({...deptForm, code: e.target.value})}
                  />
                </div>
                <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors">
                  Add Department
                </button>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {departments.map(d => (
                  <div key={d.id} className="p-4 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-800">{d.name}</h4>
                      <p className="text-xs text-indigo-600 font-bold uppercase">{d.code}</p>
                    </div>
                    <button 
                      onClick={() => handleDeleteDept(d.id)}
                      className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'subjects' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {subjects.map(s => (
                <div key={s.id} className="p-4 border border-slate-200 rounded-xl hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded uppercase">{s.code}</span>
                    <span className="text-xs text-slate-400">{s.department} Dept</span>
                  </div>
                  <h3 className="font-bold text-slate-800">{s.name}</h3>
                  <div className="mt-4 pt-4 border-t flex justify-between">
                    <button className="text-xs text-indigo-600 font-semibold hover:underline">Edit</button>
                    <button className="text-xs text-red-600 font-semibold hover:underline">Remove</button>
                  </div>
                </div>
              ))}
              <button className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition-all">
                <Plus size={32} />
                <span className="mt-2 font-medium">Add New Subject</span>
              </button>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-8">
              <div className="h-[300px] w-full">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Institutional Presence (Last 7 Days)</h3>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.last7Days}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                    <Tooltip 
                      cursor={{fill: '#f8fafc'}}
                      contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0(0 0 / 0.1)'}}
                    />
                    <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User Management Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-slate-50">
              <h3 className="font-bold text-slate-800 text-lg">
                {editingUser ? 'Edit User Record' : 'Create New User Account'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">System Role</label>
                  <select 
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value as UserRole})}
                  >
                    <option value={UserRole.ADMIN}>Admin - Full System Control</option>
                    <option value={UserRole.TEACHER}>Teacher - Class Management</option>
                    <option value={UserRole.STUDENT}>Student - Attendance Only</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
                    <input 
                      type="text" required
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="e.g. Robert Smith"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email Address</label>
                    <input 
                      type="email" required
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      placeholder="smith@college.edu"
                    />
                  </div>
                </div>

                {formData.role !== UserRole.ADMIN && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Department</label>
                      <select 
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                        value={formData.department}
                        onChange={(e) => setFormData({...formData, department: e.target.value})}
                      >
                        {departments.map(d => (
                          <option key={d.id} value={d.code}>{d.name} ({d.code})</option>
                        ))}
                      </select>
                    </div>
                    {formData.role === UserRole.STUDENT && (
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Roll Number</label>
                        <input 
                          type="text" required
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                          value={formData.rollNumber}
                          onChange={(e) => setFormData({...formData, rollNumber: e.target.value})}
                          placeholder="CS2023-01"
                        />
                      </div>
                    )}
                  </div>
                )}

                {formData.role === UserRole.STUDENT && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Current Year</label>
                      <select 
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                        value={formData.year}
                        onChange={(e) => setFormData({...formData, year: e.target.value})}
                      >
                        <option>1st</option>
                        <option>2nd</option>
                        <option>3rd</option>
                        <option>4th</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Section</label>
                      <select 
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                        value={formData.section}
                        onChange={(e) => setFormData({...formData, section: e.target.value})}
                      >
                        <option>A</option>
                        <option>B</option>
                        <option>C</option>
                      </select>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Default Password</label>
                  <input 
                    type="password" required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-lg font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
                >
                  {editingUser ? 'Update User' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
