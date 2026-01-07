
import React, { useState, useEffect, useMemo } from 'react';
import { Database } from '../store';
import { User, UserRole, Subject, AttendanceSession, AttendanceRecord } from '../types';
import { QrCode, ClipboardList, Timer, CheckCircle2, XCircle, Share2, Users, X, Search, UserPlus, RefreshCw } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface TeacherDashboardProps {
  teacher: User;
}

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ teacher }) => {
  const [view, setView] = useState<'generate' | 'history' | 'manual'>('generate');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedDept, setSelectedDept] = useState('CS');
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
  const students = Database.getUsers().filter(u => u.role === UserRole.STUDENT);

  // Polling for new records to make the "Live Attendance" list update automatically
  useEffect(() => {
    const pollInterval = setInterval(() => {
      setAllRecords(Database.getRecords());
    }, 3000); // Poll every 3 seconds
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
          // Automatic submission happens here by clearing the session
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

    const expiryTime = Date.now() + 10 * 60 * 1000; // 10 minutes
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
    if (!isAuto && !window.confirm('Check and Submit: Are you sure you want to finalize and close the QR session now?')) {
      return;
    }
    
    // Finalize: Clear the active session and refresh records
    setActiveSession(null);
    setTimeLeft(0);
    setAllRecords(Database.getRecords());
    
    if (isAuto) {
      alert('Time up! QR Code expired. Session automatically submitted and closed.');
    } else {
      alert('Session finalized. Attendance has been submitted to the database.');
    }
  };

  const handleCancelSession = () => {
    if (window.confirm('Are you sure you want to cancel this session? Students can no longer scan, but previous scans are saved.')) {
      setActiveSession(null);
      setTimeLeft(0);
    }
  };

  // Manual Entry Logic
  const handleSearchStudent = () => {
    if (!manualRollNo.trim()) return alert('Please enter a roll number.');
    const student = Database.findUserByRollNumber(manualRollNo.trim());
    if (student) {
      setManualFoundStudent(student);
    } else {
      alert('No student found with this Roll Number.');
      setManualFoundStudent(null);
    }
  };

  const handleSubmitManual = () => {
    if (!manualFoundStudent) return;
    if (!selectedSubject) return alert('Please select a subject first.');

    // Add manual record
    const newRecord: AttendanceRecord = {
      id: `manual-${Math.random().toString(36).substr(2, 9)}`,
      sessionId: `MANUAL_${Date.now()}`, 
      studentId: manualFoundStudent.id,
      timestamp: Date.now()
    };

    Database.addRecord(newRecord);
    setAllRecords(Database.getRecords()); // Immediate refresh
    alert(`Attendance marked successfully for ${manualFoundStudent.name} (Roll: ${manualFoundStudent.rollNumber}) in Period ${selectedPeriod}`);
    
    // Clear manual form
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
          <p className="text-slate-500">Welcome back, {teacher.name}</p>
        </div>
        <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-sm overflow-x-auto w-full sm:w-auto">
          <button 
            onClick={() => setView('generate')}
            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${view === 'generate' ? 'bg-indigo-600 text-white' : 'text-slate-50' ? 'text-slate-500 hover:text-slate-700' : ''}`}
          >
            QR Generation
          </button>
          <button 
            onClick={() => setView('manual')}
            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${view === 'manual' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Manual Entry
          </button>
          <button 
            onClick={() => setView('history')}
            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${view === 'history' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Reports
          </button>
        </div>
      </div>

      {view === 'generate' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Configuration Panel */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-fit">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <ClipboardList size={20} className="text-indigo-600" />
              Class Parameters
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
                <select 
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  disabled={!!activeSession}
                >
                  <option value="">Select Subject</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
                  <select 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    disabled={!!activeSession}
                  >
                    <option>CS</option>
                    <option>EE</option>
                    <option>ME</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Year</label>
                  <select 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    disabled={!!activeSession}
                  >
                    <option>1st</option>
                    <option>2nd</option>
                    <option>3rd</option>
                    <option>4th</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Section</label>
                  <select 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                    value={selectedSection}
                    onChange={(e) => setSelectedSection(e.target.value)}
                    disabled={!!activeSession}
                  >
                    <option>A</option>
                    <option>B</option>
                    <option>C</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Period</label>
                  <select 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                    disabled={!!activeSession}
                  >
                    {Array.from({length: 8}, (_, i) => <option key={i+1}>{i+1}</option>)}
                  </select>
                </div>
              </div>

              {!activeSession ? (
                <button 
                  onClick={handleGenerateQR}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
                >
                  <QrCode size={20} />
                  Start QR Session
                </button>
              ) : (
                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                  <div className="flex items-center justify-between text-indigo-700 font-bold mb-2">
                    <span className="flex items-center gap-1.5"><Timer size={18} /> Active Session</span>
                    <span className="text-lg font-mono">{formatTime(timeLeft)}</span>
                  </div>
                  <div className="w-full bg-indigo-200 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-600 transition-all duration-1000" 
                      style={{width: `${(timeLeft / 600) * 100}%`}}
                    ></div>
                  </div>
                  <p className="text-[10px] text-indigo-400 mt-2 text-center uppercase tracking-widest">Automatic submission on expiry</p>
                </div>
              )}
            </div>
          </div>

          {/* QR & Live Status Panel */}
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center relative overflow-hidden">
              {activeSession ? (
                <>
                  <div className="p-6 bg-white border-2 border-slate-100 rounded-2xl shadow-inner mb-6">
                    <QRCodeSVG value={activeSession.qrPayload} size={250} level="H" includeMargin />
                  </div>
                  <h4 className="text-xl font-bold text-slate-800">Scan to Mark Attendance</h4>
                  <p className="text-slate-500 text-sm mt-1">Class: {selectedDept} {selectedYear} Section {selectedSection}</p>
                  
                  <div className="flex gap-3 mt-8">
                    <button 
                      onClick={() => handleFinalizeSession(false)}
                      className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white hover:bg-green-700 rounded-xl font-bold transition-all shadow-lg shadow-green-100 active:scale-95"
                    >
                      <CheckCircle2 size={18} />
                      Check and Submit
                    </button>
                    <button 
                      onClick={handleCancelSession}
                      className="flex items-center gap-2 px-4 py-3 bg-slate-50 text-slate-400 hover:text-red-600 rounded-xl font-semibold transition-all"
                      title="Cancel Session"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </>
              ) : (
                <div className="py-20 flex flex-col items-center">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4">
                    <QrCode size={40} />
                  </div>
                  <p className="text-slate-400 font-medium max-w-xs">QR code will appear here after parameters are set and session is started</p>
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Users size={18} className="text-indigo-600" />
                  Live Attendance ({currentSessionRecords.length}/{activeStudents.length})
                </h3>
                {activeSession && <div className="animate-pulse flex items-center gap-1.5 text-[10px] text-green-600 font-bold uppercase"><span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> Live</div>}
              </div>
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {activeStudents.length > 0 ? activeStudents.map(student => {
                  const isPresent = currentSessionRecords.some(r => r.studentId === student.id);
                  return (
                    <div key={student.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${isPresent ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-400'}`}>
                          {student.name.charAt(0)}
                        </div>
                        <div>
                          <p className={`text-sm font-bold ${isPresent ? 'text-slate-800' : 'text-slate-400'}`}>{student.name}</p>
                          <p className="text-[10px] text-slate-400">Roll: {student.rollNumber}</p>
                        </div>
                      </div>
                      {isPresent ? (
                        <CheckCircle2 size={16} className="text-green-500" />
                      ) : (
                        <XCircle size={16} className="text-slate-200" />
                      )}
                    </div>
                  );
                }) : (
                  <p className="text-xs text-slate-400 text-center py-6 italic">Adjust parameters to see student list</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {view === 'manual' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
              <UserPlus className="text-indigo-600" /> Manual Attendance Entry
            </h2>

            <div className="space-y-6">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Enter Student Roll Number (e.g. CS301)"
                    className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                    value={manualRollNo}
                    onChange={(e) => setManualRollNo(e.target.value.toUpperCase())}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearchStudent()}
                  />
                </div>
                <button 
                  onClick={handleSearchStudent}
                  className="bg-indigo-600 text-white px-8 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95"
                >
                  Search
                </button>
              </div>

              {manualFoundStudent && (
                <div className="p-6 bg-indigo-50/50 rounded-2xl border border-indigo-100 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-2xl font-bold text-indigo-600 shadow-sm border border-indigo-100">
                      {manualFoundStudent.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-xl">{manualFoundStudent.name}</h4>
                      <p className="text-slate-500 text-sm font-medium">Roll: <span className="text-indigo-600 font-bold">{manualFoundStudent.rollNumber}</span></p>
                      <p className="text-slate-400 text-xs mt-0.5">{manualFoundStudent.department} Dept | {manualFoundStudent.year} Year | Section {manualFoundStudent.section}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5 ml-1">Select Subject</label>
                      <select 
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                        value={selectedSubject}
                        onChange={(e) => setSelectedSubject(e.target.value)}
                      >
                        <option value="">-- Choose Subject --</option>
                        {subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5 ml-1">Select Period</label>
                      <select 
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                        value={selectedPeriod}
                        onChange={(e) => setSelectedPeriod(e.target.value)}
                      >
                        {Array.from({length: 8}, (_, i) => <option key={i+1} value={i+1}>Period {i+1}</option>)}
                      </select>
                    </div>
                  </div>

                  <button 
                    onClick={handleSubmitManual}
                    className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-xl shadow-indigo-100 active:scale-95"
                  >
                    <CheckCircle2 size={20} />
                    Submit Manual Attendance
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {view === 'history' && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 text-center py-20">
          <Share2 size={56} className="mx-auto text-slate-100 mb-6" />
          <h2 className="text-3xl font-bold text-slate-800">Attendance Reports</h2>
          <p className="text-slate-500 max-w-md mx-auto mt-4 leading-relaxed">View detailed subject-wise trends, daily summaries, and export attendance logs to Excel for your classes.</p>
          <div className="flex gap-4 justify-center mt-10">
            <button className="px-8 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-bold shadow-lg shadow-indigo-100 active:scale-95">View Trends</button>
            <button className="px-8 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all font-bold active:scale-95">Download PDF</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;
