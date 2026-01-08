
import React, { useState, useEffect, useMemo } from 'react';
import { Database } from '../store';
import { User, UserRole, Subject, AttendanceSession, AttendanceRecord, Department } from '../types';
import { QrCode, ClipboardList, Timer, CheckCircle2, XCircle, Share2, Users, X, Search, UserPlus, RefreshCw, Trash2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface TeacherDashboardProps {
  teacher: User;
}

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ teacher }) => {
  const [view, setView] = useState<'generate' | 'history' | 'manual'>('generate');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedYear, setSelectedYear] = useState('1st');
  const [selectedSection, setSelectedSection] = useState('A');
  const [selectedPeriod, setSelectedPeriod] = useState('1');
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [allRecords, setAllRecords] = useState<AttendanceRecord[]>(Database.getRecords());

  // Manual Attendance State
  const [manualRollNo, setManualRollNo] = useState('');
  const [manualFoundStudent, setManualFoundStudent] = useState<User | null>(null);

  const subjects = Database.getSubjects();
  const departments = Database.getDepartments();
  const students = Database.getUsers().filter(u => u.role === UserRole.STUDENT);

  // Set default dept if not set
  useEffect(() => {
    if (!selectedDept && departments.length > 0) {
      setSelectedDept(departments[0].code);
    }
  }, [departments]);

  // Polling for new records
  useEffect(() => {
    const pollInterval = setInterval(() => {
      setAllRecords(Database.getRecords());
    }, 2000);
    return () => clearInterval(pollInterval);
  }, []);

  // Timer logic for QR expiry
  useEffect(() => {
    let interval: any;
    if (activeSession) {
      const updateTimer = () => {
        const remaining = Math.max(0, Math.floor((activeSession.expiryTime - Date.now()) / 1000));
        setTimeLeft(remaining);
        if (remaining <= 0) {
          handleFinalizeSession(true);
        }
      };
      updateTimer();
      interval = setInterval(updateTimer, 1000);
    }
    return () => clearInterval(interval);
  }, [activeSession]);

  const handleGenerateQR = () => {
    if (!selectedSubject) return alert('Please select a subject');

    const expiryTime = Date.now() + 10 * 60 * 1000;
    const newSession: AttendanceSession = {
      id: Math.random().toString(36).substr(2, 9),
      teacherId: teacher.id,
      subjectId: selectedSubject,
      department: selectedDept,
      year: selectedYear,
      section: selectedSection,
      period: selectedPeriod,
      startTime: Date.now(),
      expiryTime,
      qrPayload: `QR_ATTEND_${Math.random().toString(36).substr(2, 9)}`
    };

    Database.addSession(newSession);
    setActiveSession(newSession);
  };

  const handleFinalizeSession = (isAuto: boolean = false) => {
    if (!isAuto && !window.confirm('Submit and close the current session?')) return;
    setActiveSession(null);
    setTimeLeft(0);
    setAllRecords(Database.getRecords());
    if (isAuto) alert('Time up! Session automatically submitted.');
    else alert('Attendance session closed successfully.');
  };

  const handleCancelSession = () => {
    if (window.confirm('Cancel session? Recorded scans will be kept.')) {
      setActiveSession(null);
      setTimeLeft(0);
    }
  };

  // FOR DEMO: Clear records for active session
  const clearSessionRecords = () => {
    if (!activeSession) return;
    if (!window.confirm("Delete all attendance records for this LIVE session? (Demo Purposes)")) return;
    const records = Database.getRecords();
    const newRecords = records.filter(r => r.sessionId !== activeSession.id);
    localStorage.setItem('qra_records', JSON.stringify(newRecords));
    setAllRecords(newRecords);
  };

  const handleSearchStudent = () => {
    if (!manualRollNo.trim()) return alert('Enter roll number.');
    const student = Database.findUserByRollNumber(manualRollNo.trim());
    if (student) setManualFoundStudent(student);
    else { alert('No student found.'); setManualFoundStudent(null); }
  };

  const handleSubmitManual = () => {
    if (!manualFoundStudent) return;
    if (!selectedSubject) return alert('Select subject.');

    const newRecord: AttendanceRecord = {
      id: `manual-${Math.random().toString(36).substr(2, 9)}`,
      sessionId: `MANUAL_${Date.now()}`, 
      studentId: manualFoundStudent.id,
      timestamp: Date.now()
    };

    Database.addRecord(newRecord);
    setAllRecords(Database.getRecords());
    alert(`Attendance marked for ${manualFoundStudent.name}`);
    setManualRollNo('');
    setManualFoundStudent(null);
  };

  const currentSessionRecords = useMemo(() => {
    if (!activeSession) return [];
    return allRecords.filter(r => r.sessionId === activeSession.id);
  }, [activeSession, allRecords]);

  const activeStudents = useMemo(() => {
    return students.filter(s => 
      s.department === selectedDept && 
      s.year === selectedYear && 
      s.section === selectedSection
    );
  }, [students, selectedDept, selectedYear, selectedSection]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Attendance Portal</h1>
          <p className="text-slate-500">Welcome, {teacher.name}</p>
        </div>
        <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-sm overflow-x-auto w-full sm:w-auto">
          <button onClick={() => setView('generate')} className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-sm font-medium whitespace-nowrap ${view === 'generate' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700'}`}>QR Generation</button>
          <button onClick={() => setView('manual')} className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-sm font-medium whitespace-nowrap ${view === 'manual' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700'}`}>Manual Entry</button>
          <button onClick={() => setView('history')} className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-sm font-medium whitespace-nowrap ${view === 'history' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700'}`}>Reports</button>
        </div>
      </div>

      {view === 'generate' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-fit">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2"><ClipboardList size={20} className="text-indigo-600" /> Class Parameters</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
                <select className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none" value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} disabled={!!activeSession}>
                  <option value="">Select Subject</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
                  <select className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg" value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)} disabled={!!activeSession}>
                    {departments.map(d => <option key={d.id} value={d.code}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Year</label>
                  <select className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} disabled={!!activeSession}>
                    <option>1st</option><option>2nd</option><option>3rd</option><option>4th</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Section</label>
                  <select className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg" value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)} disabled={!!activeSession}>
                    <option>A</option><option>B</option><option>C</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Period</label>
                  <select className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg" value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)} disabled={!!activeSession}>
                    {Array.from({length: 8}, (_, i) => <option key={i+1}>{i+1}</option>)}
                  </select>
                </div>
              </div>
              {!activeSession ? (
                <button onClick={handleGenerateQR} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all hover:bg-indigo-700 active:scale-95"><QrCode size={20} /> Start QR Session</button>
              ) : (
                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                  <div className="flex items-center justify-between text-indigo-700 font-bold mb-2">
                    <span className="flex items-center gap-1.5 uppercase text-[10px] tracking-wider"><Timer size={14} /> Time Remaining</span>
                    <span className="text-lg font-mono">{formatTime(timeLeft)}</span>
                  </div>
                  <div className="w-full bg-indigo-200 h-1 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-600 transition-all duration-1000" style={{width: `${(timeLeft / 600) * 100}%`}}></div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white p-8 rounded-2xl border border-slate-100 flex flex-col items-center text-center shadow-sm">
              {activeSession ? (
                <>
                  <div className="p-4 bg-white border-4 border-indigo-50 rounded-3xl shadow-xl">
                    <QRCodeSVG value={activeSession.qrPayload} size={300} level="H" includeMargin={true} />
                  </div>
                  <p className="mt-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest">Scanning is active for students</p>
                  <div className="flex gap-3 mt-8">
                    <button onClick={() => handleFinalizeSession(false)} className="px-6 py-3 bg-green-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-green-700 shadow-lg shadow-green-100 active:scale-95"><CheckCircle2 size={18} /> Finalize</button>
                    <button onClick={clearSessionRecords} className="px-4 py-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors active:scale-95" title="Clear Demo Records"><Trash2 size={18} /></button>
                    <button onClick={handleCancelSession} className="px-4 py-3 bg-slate-100 text-slate-500 rounded-xl hover:text-red-500 hover:bg-red-50 transition-colors active:scale-95"><X size={18} /></button>
                  </div>
                </>
              ) : (
                <div className="py-20 flex flex-col items-center opacity-40">
                  <QrCode size={64} className="text-slate-300 mb-4" />
                  <p className="text-slate-400 font-medium max-w-[200px]">Select parameters and start the class to display QR code</p>
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center justify-between">
                <span className="flex items-center gap-2"><Users size={18} className="text-indigo-600" /> Scans Detected</span>
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">{currentSessionRecords.length} / {activeStudents.length}</span>
              </h3>
              <div className="max-h-48 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                {activeStudents.length > 0 ? (
                  activeStudents.map(student => {
                    const isPresent = currentSessionRecords.some(r => r.studentId === student.id);
                    return (
                      <div key={student.id} className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${isPresent ? 'bg-green-50 border-green-100' : 'bg-slate-50 border-slate-100'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${isPresent ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-400'}`}>{student.name.charAt(0)}</div>
                          <div><p className={`text-sm font-bold ${isPresent ? 'text-slate-800' : 'text-slate-400'}`}>{student.name}</p></div>
                        </div>
                        {isPresent ? <CheckCircle2 size={16} className="text-green-500" /> : <XCircle size={16} className="text-slate-200" />}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-center py-4 text-xs text-slate-400 italic">No students in this batch.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {view === 'manual' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2"><UserPlus className="text-indigo-600" /> Manual Entry</h2>
            <div className="flex gap-2 mb-6">
              <input type="text" placeholder="Roll Number (e.g. CS301)" className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" value={manualRollNo} onChange={(e) => setManualRollNo(e.target.value.toUpperCase())} />
              <button onClick={handleSearchStudent} className="bg-indigo-600 text-white px-8 rounded-xl font-bold hover:bg-indigo-700 transition-all">Search</button>
            </div>
            {manualFoundStudent && (
              <div className="p-6 bg-indigo-50/50 rounded-2xl border border-indigo-100 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-2xl font-bold text-indigo-600 border border-indigo-100 shadow-sm">{manualFoundStudent.name.charAt(0)}</div>
                  <div><h4 className="font-bold text-slate-800 text-xl">{manualFoundStudent.name}</h4><p className="text-slate-500 text-sm font-medium">Roll: {manualFoundStudent.rollNumber} | {manualFoundStudent.year} Year</p></div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5 ml-1">Subject</label>
                    <select className="w-full p-3 bg-white border border-slate-200 rounded-xl" value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)}>
                      <option value="">Choose Subject</option>
                      {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5 ml-1">Period</label>
                    <select className="w-full p-3 bg-white border border-slate-200 rounded-xl" value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)}>
                      {Array.from({length: 8}, (_, i) => <option key={i+1} value={i+1}>Period {i+1}</option>)}
                    </select>
                  </div>
                </div>
                <button onClick={handleSubmitManual} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-[0.98]">Submit Manual Attendance</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;
