
import React, { useState, useMemo } from 'react';
import { Database } from '../store';
import { User, UserRole, Subject, Department } from '../types';
import { Users, Search, FileDown, UserCog, GraduationCap, Building2, Calendar, ClipboardList } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';

interface DeptHeadDashboardProps {
  hod: User;
}

const DeptHeadDashboard: React.FC<DeptHeadDashboardProps> = ({ hod }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'subjects' | 'reports' | 'download'>('users');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Download Filters
  const [filterYear, setFilterYear] = useState('3rd');
  const [filterSection, setFilterSection] = useState('A');
  const [filterStartDate, setFilterStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [filterEndDate, setFilterEndDate] = useState(new Date().toISOString().split('T')[0]);

  const users = Database.getUsers();
  const subjects = Database.getSubjects();
  const records = Database.getRecords();
  const sessions = Database.getSessions();
  const departments = Database.getDepartments();

  const hodDeptCode = hod.department || '';
  const hodDeptName = departments.find(d => d.code === hodDeptCode)?.name || hodDeptCode;

  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      u.department === hodDeptCode &&
      (u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
       u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
       u.role.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [users, searchQuery, hodDeptCode]);

  const deptSubjects = useMemo(() => {
    return subjects.filter(s => s.department === hodDeptCode);
  }, [subjects, hodDeptCode]);

  const stats = useMemo(() => {
    const deptUsers = users.filter(u => u.department === hodDeptCode);
    const studentCount = deptUsers.filter(u => u.role === UserRole.STUDENT).length;
    const teacherCount = deptUsers.filter(u => u.role === UserRole.TEACHER).length;
    
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('en-US', { weekday: 'short' });
      const count = records.filter(r => {
        const session = sessions.find(s => s.id === r.sessionId);
        if (!session || session.department !== hodDeptCode) return false;
        const rd = new Date(r.timestamp);
        return rd.toDateString() === d.toDateString();
      }).length;
      return { name: dateStr, count };
    }).reverse();

    return { studentCount, teacherCount, last7Days };
  }, [users, records, sessions, hodDeptCode]);

  const getColLetter = (n: number): string => {
    let letter = "";
    while (n >= 0) {
      letter = String.fromCharCode((n % 26) + 65) + letter;
      n = Math.floor(n / 26) - 1;
    }
    return letter;
  };

  const exportFilteredAttendance = () => {
    const start = new Date(filterStartDate);
    start.setHours(0, 0, 0, 0);
    const startTimestamp = start.getTime();

    const end = new Date(filterEndDate);
    end.setHours(23, 59, 59, 999);
    const endTimestamp = end.getTime();
    
    if (startTimestamp > endTimestamp) {
      alert("Error: Start date must be before or equal to the end date.");
      return;
    }

    const batchSessions = sessions.filter(s => 
      s.department === hodDeptCode &&
      s.year === filterYear &&
      s.section === filterSection &&
      s.startTime >= startTimestamp &&
      s.startTime <= endTimestamp
    );

    if (batchSessions.length === 0) {
      alert(`No attendance records found for ${filterYear} Year, Section ${filterSection} between ${filterStartDate} and ${filterEndDate}.`);
      return;
    }

    const batchStudents = users.filter(u => 
      u.role === UserRole.STUDENT &&
      u.department === hodDeptCode &&
      u.year === filterYear &&
      u.section === filterSection
    );

    const activeSubjectIds = Array.from(new Set(batchSessions.map(s => s.subjectId)));
    const activeSubjects = subjects.filter(sub => activeSubjectIds.includes(sub.id));

    const aoa: any[][] = [];
    
    aoa.push([`INSTITUTION ATTENDANCE REPORT - ${hodDeptName.toUpperCase()}`]);
    aoa.push([`DURATION:`, `${filterStartDate} to ${filterEndDate}`]);
    aoa.push([`BATCH:`, `${filterYear} Year - Section ${filterSection}`]);
    aoa.push([`TOTAL SUBJECTS:`, activeSubjects.length]);
    aoa.push([`TOTAL WORKING PERIODS:`, batchSessions.length]);
    aoa.push([]);

    const headerRow = ['Roll Number', 'Student Name'];
    activeSubjects.forEach(sub => {
      headerRow.push(`${sub.name} (Conducted)`, `${sub.name} (Attended)`);
    });
    headerRow.push('Total Working', 'Total Attended', 'Overall Attendance %');
    aoa.push(headerRow);

    const dataStartRow = 8; 

    batchStudents.forEach((student, sIdx) => {
      const excelRowNumber = dataStartRow + sIdx + 1;
      const row: any[] = [student.rollNumber || 'N/A', student.name];
      const attendedColLetters: string[] = [];

      activeSubjects.forEach((sub, subIdx) => {
        const subSessions = batchSessions.filter(s => s.subjectId === sub.id);
        const conductedCount = subSessions.length;
        const attendedCount = records.filter(r => 
          r.studentId === student.id && 
          subSessions.some(s => s.id === r.sessionId)
        ).length;

        row.push(conductedCount, attendedCount);
        
        const attendedColIdx = 2 + (subIdx * 2) + 1;
        attendedColLetters.push(getColLetter(attendedColIdx) + excelRowNumber);
      });

      row.push(batchSessions.length);

      const sumFormula = attendedColLetters.length > 0 ? `SUM(${attendedColLetters.join(',')})` : '0';
      row.push({ f: sumFormula });

      const totalWorkingCol = getColLetter(2 + (activeSubjects.length * 2)) + excelRowNumber;
      const totalAttendedCol = getColLetter(2 + (activeSubjects.length * 2) + 1) + excelRowNumber;
      row.push({ f: `IF(${totalWorkingCol}>0, ${totalAttendedCol}/${totalWorkingCol}, 0)` });

      aoa.push(row);
    });

    try {
      const worksheet = XLSX.utils.aoa_to_sheet(aoa);
      const range = XLSX.utils.decode_range(worksheet['!ref'] || "A1:A1");
      const percentageColIdx = 2 + (activeSubjects.length * 2) + 2;
      for (let r = dataStartRow; r <= range.e.r; r++) {
        const cellAddress = XLSX.utils.encode_cell({ r, c: percentageColIdx });
        if (worksheet[cellAddress]) {
          worksheet[cellAddress].z = '0.0%'; 
        }
      }

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance_Report");
      const fileName = `Attendance_${hodDeptCode}_${filterYear}_${filterSection}_Calculated.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } catch (err) {
      console.error("Excel Export Error:", err);
      alert("Error exporting Excel file.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">HOD Dashboard - {hodDeptName}</h1>
          <p className="text-slate-500">Departmental oversight and attendance analytics</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('download')}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <FileDown size={18} />
            Generate Dept Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
            <GraduationCap size={20} />
          </div>
          <div>
            <p className="text-slate-500 text-xs font-medium">Students ({hodDeptCode})</p>
            <p className="text-xl font-bold text-slate-800">{stats.studentCount}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center">
            <UserCog size={20} />
          </div>
          <div>
            <p className="text-slate-500 text-xs font-medium">Teachers ({hodDeptCode})</p>
            <p className="text-xl font-bold text-slate-800">{stats.teacherCount}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center">
            <Building2 size={20} />
          </div>
          <div>
            <p className="text-slate-500 text-xs font-medium">Total Subjects</p>
            <p className="text-xl font-bold text-slate-800">{deptSubjects.length}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="flex border-b overflow-x-auto">
          <button 
            onClick={() => setActiveTab('users')}
            className={`px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'users' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Faculty & Students
          </button>
          <button 
            onClick={() => setActiveTab('subjects')}
            className={`px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'subjects' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Dept Catalog
          </button>
          <button 
            onClick={() => setActiveTab('download')}
            className={`px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'download' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Excel Reports
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
                  placeholder="Filter by name, email, or role..."
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
                      <th className="px-4 py-3 font-semibold text-right">Batch Details</th>
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
                            u.role === UserRole.TEACHER ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600 text-xs">
                          {u.role === UserRole.TEACHER ? (
                            `Faculty of ${u.department}`
                          ) : (
                            <div className="space-y-0.5">
                              <p>Roll: {u.rollNumber || 'N/A'}</p>
                              <p>{u.year} Year / Sec {u.section}</p>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'subjects' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {deptSubjects.map(s => (
                <div key={s.id} className="p-4 border border-slate-200 rounded-xl hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded uppercase">{s.code}</span>
                  </div>
                  <h3 className="font-bold text-slate-800">{s.name}</h3>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'download' && (
            <div className="max-w-2xl mx-auto py-4">
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-8 space-y-6 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center">
                    <ClipboardList size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">Advanced Spreadsheet Generation</h3>
                </div>
                
                <p className="text-sm text-slate-500">
                  Generate a formula-driven Excel sheet for <strong>{hodDeptName}</strong>. This report includes subject-wise conducted vs attended counts and overall percentage calculations.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Year</label>
                    <select 
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      value={filterYear}
                      onChange={(e) => setFilterYear(e.target.value)}
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
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      value={filterSection}
                      onChange={(e) => setFilterSection(e.target.value)}
                    >
                      <option>A</option>
                      <option>B</option>
                      <option>C</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">From Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="date"
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                        value={filterStartDate}
                        onChange={(e) => setFilterStartDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">To Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="date"
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                        value={filterEndDate}
                        onChange={(e) => setFilterEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 space-y-2">
                  <p className="text-xs text-indigo-700 font-bold flex items-center gap-2 uppercase tracking-wider">
                    <FileDown size={14} /> Spreadsheet Layout:
                  </p>
                  <ul className="text-xs text-indigo-600 space-y-1 list-disc ml-5">
                    <li>Subject-wise: Shows <b>Conducted</b> and <b>Attended</b> side-by-side.</li>
                    <li>Individual subject percentage columns are removed for simplicity.</li>
                    <li><b>SUM()</b> formula used for Total Attended column.</li>
                    <li><b>IF()</b> formula used for Overall Percentage column.</li>
                  </ul>
                </div>

                <button 
                  onClick={exportFilteredAttendance}
                  className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 active:scale-[0.98]"
                >
                  <FileDown size={20} />
                  Export Calculated Excel (.xlsx)
                </button>
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-8">
              <div className="h-[300px] w-full">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Department Presence (Last 7 Days)</h3>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.last7Days}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                    <Tooltip 
                      cursor={{fill: '#f8fafc'}}
                      contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                    />
                    <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeptHeadDashboard;
