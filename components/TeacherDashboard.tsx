
import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Database, useDatabase } from '../store';
import { User, UserRole, Subject, AttendanceSession, AttendanceRecord, Department } from '../types';
import { QrCode, ClipboardList, Timer, CheckCircle2, XCircle, Users, X, UserPlus, RefreshCw, Loader2, Sparkles } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface TeacherDashboardProps {
  teacher: User;
}

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ teacher }) => {
  const { subjects, departments, users, records, sessions } = useDatabase();
  const [view, setView] = useState<'generate' | 'history' | 'manual'>('generate');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedDept, setSelectedDept] = useState(teacher.department || '');
  const [selectedYear, setSelectedYear] = useState('3rd'); 
  const [selectedSection, setSelectedSection] = useState('A');
  const [selectedPeriod, setSelectedPeriod] = useState('1');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentActiveSession, setCurrentActiveSession] = useState<AttendanceSession | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);

  const [manualRollNo, setManualRollNo] = useState('');
  const [manualFoundStudent, setManualFoundStudent] = useState<User | null>(null);

  useEffect(() => {
    if (!currentActiveSession) {
      const live = sessions.find(s => s.teacherId === teacher.id && s.expiryTime > Date.now());
      if (live) {
        setCurrentActiveSession(live);
        setSelectedSubject(live.subjectId);
        setSelectedDept(live.department);
        setSelectedYear(live.year);
        setSelectedSection(live.section);
      }
    }
  }, [sessions, teacher.id, currentActiveSession]);

  useEffect(() => {
    if (!selectedDept && teacher.department) {
      setSelectedDept(teacher.department);
    } else if (!selectedDept && departments.length > 0) {
      setSelectedDept(departments[0].code);
    }
  }, [departments, teacher.department, selectedDept]);

  useEffect(() => {
    let interval: any;
    if (currentActiveSession) {
      const updateTimer = () => {
        const remaining = Math.max(0, Math.floor((currentActiveSession.expiryTime - Date.now()) / 1000));
        setTimeLeft(remaining);
        if (remaining <= 0) handleFinalizeSession(true);
      };
      updateTimer();
      interval = setInterval(updateTimer, 1000);
    }
    return () => clearInterval(interval);
  }, [currentActiveSession]);

  const handleGenerateQR = async () => {
    if (!selectedSubject) return alert('Please select a subject first.');
    if (!selectedDept) return alert('Please select a department.');
    
    setIsGenerating(true);
    try {
      const sessionId = Math.random().toString(36).substr(2, 9);
      const newSession: AttendanceSession = {
        id: sessionId,
        teacherId: teacher.id,
        subjectId: selectedSubject,
        department: selectedDept.trim(),
        year: selectedYear.trim(),
        section: selectedSection.trim(),
        period: selectedPeriod,
        startTime: Date.now(),
        expiryTime: Date.now() + 10 * 60 * 1000,
        qrPayload: `QR_ATTEND_${sessionId}`
      };
      
      await Database.addSession(newSession);
      setCurrentActiveSession(newSession);
    } catch (error) {
      console.error("QR Generation failed:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFinalizeSession = (isAuto: boolean = false) => {
    setCurrentActiveSession(null);
    setTimeLeft(0);
  };

  const students = useMemo(() => users.filter(u => u.role === UserRole.STUDENT), [users]);
  
  const currentSessionRecords = useMemo(() => {
    if (!currentActiveSession) return [];
    return records.filter(r => r.sessionId === currentActiveSession.id);
  }, [currentActiveSession, records]);

  // Using the resilient normalization from store.ts
  const activeStudents = useMemo(() => {
    const targetDept = Database.normalize(selectedDept);
    const targetYear = Database.normalize(selectedYear);
    const targetSection = Database.normalize(selectedSection);

    return students.filter(s => 
      Database.normalize(s.department) === targetDept && 
      Database.normalize(s.year) === targetYear && 
      Database.normalize(s.section) === targetSection
    );
  }, [students, selectedDept, selectedYear, selectedSection]);

  const handleSearchStudent = () => {
    const student = users.find(u => u.rollNumber?.toLowerCase() === manualRollNo.trim().toLowerCase());
    if (student) setManualFoundStudent(student);
    else alert('Student with this roll number not found.');
  };

  const handleSubmitManual = async () => {
    if (!manualFoundStudent || !selectedSubject) return;
    await Database.addRecord({
      id: `man-${Date.now()}`,
      sessionId: currentActiveSession?.id || `manual-${Date.now()}`,
      studentId: manualFoundStudent.id,
      timestamp: Date.now()
    });
    alert('Attendance marked!');
    setManualFoundStudent(null);
    setManualRollNo('');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Teacher Portal</h1>
          <p className="text-slate-500 text-sm">Welcome, {teacher.name}</p>
        </div>
        <div className="flex bg-white rounded-xl p-1 border shadow-sm self-stretch sm:self-auto">
          <button 
            onClick={() => setView('generate')} 
            className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${view === 'generate' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'text-slate-500 hover:text-slate-700'}`}
          >
            QR Generation
          </button>
          <button 
            onClick={() => setView('manual')} 
            className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${view === 'manual' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Manual Entry
          </button>
        </div>
      </div>

      {view === 'generate' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <ClipboardList className="text-indigo-600" size={20} />
              <h3 className="font-bold text-slate-800">Session Setup</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Subject</label>
                <select 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                  value={selectedSubject} 
                  onChange={e => setSelectedSubject(e.target.value)} 
                  disabled={!!currentActiveSession}
                >
                  <option value="">Choose Course...</option>
                  {subjects.filter(s => s.department === teacher.department).map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Dept</label>
                  <select 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" 
                    value={selectedDept} 
                    onChange={e => setSelectedDept(e.target.value)} 
                    disabled={!!currentActiveSession}
                  >
                    {departments.map(d => <option key={d.id} value={d.code}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Year</label>
                  <select 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" 
                    value={selectedYear} 
                    onChange={e => setSelectedYear(e.target.value)} 
                    disabled={!!currentActiveSession}
                  >
                    <option>1st</option><option>2nd</option><option>3rd</option><option>4th</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Section</label>
                  <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" value={selectedSection} onChange={e => setSelectedSection(e.target.value)} disabled={!!currentActiveSession}>
                    <option>A</option><option>B</option><option>C</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Period</label>
                  <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)} disabled={!!currentActiveSession}>
                    {[1,2,3,4,5,6,7,8].map(p => <option key={p} value={p}>Period {p}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {!currentActiveSession ? (
              <button 
                onClick={handleGenerateQR} 
                disabled={isGenerating || !selectedSubject}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-100 active:scale-[0.98]"
              >
                {isGenerating ? <Loader2 size={20} className="animate-spin" /> : <QrCode size={20} />}
                {isGenerating ? 'Generating QR...' : 'Start QR Session'}
              </button>
            ) : (
              <div className="p-5 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase font-black text-indigo-400 tracking-tighter">Time Remaining</p>
                  <p className="text-3xl font-mono font-bold text-indigo-600">
                    {Math.floor(timeLeft/60)}:{String(timeLeft%60).padStart(2,'0')}
                  </p>
                </div>
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-inner">
                  <Timer className="text-indigo-400 animate-pulse" size={24} />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white p-10 rounded-3xl border shadow-sm flex flex-col items-center relative overflow-hidden min-h-[400px]">
              {currentActiveSession ? (
                <div className="animate-in zoom-in duration-500 flex flex-col items-center w-full">
                  <div className="p-6 bg-white border-4 border-indigo-50 rounded-3xl shadow-2xl relative">
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full border-4 border-white animate-ping"></div>
                    <QRCodeSVG 
                      value={currentActiveSession.qrPayload} 
                      size={250} 
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                  <div className="mt-8 flex flex-col items-center gap-3">
                    <p className="text-sm font-bold text-indigo-600 flex items-center gap-2 bg-indigo-50 px-4 py-1.5 rounded-full uppercase tracking-widest">
                      <Sparkles size={14} /> Active Session Live
                    </p>
                    <button 
                      onClick={() => handleFinalizeSession()} 
                      className="px-8 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-red-100 flex items-center gap-2"
                    >
                      <XCircle size={18} /> Finalize Session
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                  <div className="w-32 h-32 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                    <QrCode size={64} className="opacity-20" />
                  </div>
                  <p className="font-semibold text-slate-400 text-center">QR Code will appear here</p>
                  <p className="text-xs text-slate-300 mt-2">Configure and start a session to generate</p>
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-2xl border shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-slate-800 flex items-center gap-2"><Users size={18} className="text-indigo-600" /> Real-time Scans</h3>
                <span className="text-xs font-bold bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full border border-indigo-100">
                  {currentSessionRecords.length} Present / {activeStudents.length} Total
                </span>
              </div>
              
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {activeStudents.length === 0 ? (
                  <div className="text-center py-10 px-4 border border-dashed rounded-xl space-y-2">
                    <p className="text-slate-400 text-sm">No students found for this batch.</p>
                    <p className="text-[10px] text-slate-300 uppercase font-bold">{selectedDept} • {selectedYear} Year • Sec {selectedSection}</p>
                  </div>
                ) : (
                  activeStudents.map(s => {
                    const present = currentSessionRecords.some(r => r.studentId === s.id);
                    return (
                      <div 
                        key={s.id} 
                        className={`p-3 rounded-xl border transition-all duration-300 flex justify-between items-center ${present ? 'bg-green-50 border-green-200 scale-[1.02]' : 'bg-slate-50 border-slate-100'}`}
                      >
                        <div>
                          <p className="text-sm font-bold text-slate-800">{s.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono tracking-tighter uppercase">{s.rollNumber}</p>
                        </div>
                        {present ? (
                          <div className="flex items-center gap-1.5 text-green-600 font-bold text-[10px] uppercase">
                            <CheckCircle2 size={16} /> Verified
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full border border-slate-200"></div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {view === 'manual' && (
        <div className="bg-white p-8 rounded-3xl border shadow-sm max-w-xl mx-auto">
          <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
             <UserPlus className="text-indigo-600" /> Manual Attendance
          </h3>
          <div className="space-y-4">
            <div className="flex gap-2">
              <input 
                type="text" 
                className="flex-1 p-3 bg-slate-50 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" 
                placeholder="Enter Roll Number (e.g. CS301)"
                value={manualRollNo}
                onChange={e => setManualRollNo(e.target.value)}
              />
              <button 
                onClick={handleSearchStudent}
                className="px-6 bg-slate-800 text-white rounded-xl font-bold hover:bg-black transition-all"
              >
                Search
              </button>
            </div>

            {manualFoundStudent && (
              <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl animate-in zoom-in duration-200">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-bold text-slate-800">{manualFoundStudent.name}</p>
                    <p className="text-xs text-slate-500">{manualFoundStudent.department} • Year {manualFoundStudent.year}</p>
                  </div>
                  <button 
                    onClick={handleSubmitManual}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-lg shadow-indigo-100"
                  >
                    Mark Present
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;
