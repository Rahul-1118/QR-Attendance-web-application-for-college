
import React, { useState, useEffect, useMemo } from 'react';
import { Database } from '../store';
import { User, AttendanceSession, AttendanceRecord, Subject } from '../types';
import { Calendar, CheckCircle, Clock, History, Camera, UserCheck, AlertTriangle, ChevronLeft, ChevronRight, BarChart3 } from 'lucide-react';

interface StudentDashboardProps {
  student: User;
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({ student }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{success: boolean, message: string} | null>(null);
  const [activeTab, setActiveTab] = useState<'scan' | 'monthly'>('scan');
  
  // Monthly filter state
  const [viewDate, setViewDate] = useState(new Date());

  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const attendanceData = useMemo(() => {
    const allSessions = Database.getSessions();
    const allRecords = Database.getRecords();
    const allSubjects = Database.getSubjects();

    // 1. Filter sessions for student's specific batch
    const batchSessions = allSessions.filter(s => 
      s.department === student.department &&
      s.year === student.year &&
      s.section === student.section
    );

    // 2. Student's specific attendance records
    const myRecords = allRecords.filter(r => r.studentId === student.id);

    // 3. Filter for selected month/year
    const monthSessions = batchSessions.filter(s => {
      const d = new Date(s.startTime);
      return d.getMonth() === viewDate.getMonth() && d.getFullYear() === viewDate.getFullYear();
    });

    const monthRecords = myRecords.filter(r => {
      const d = new Date(r.timestamp);
      return d.getMonth() === viewDate.getMonth() && d.getFullYear() === viewDate.getFullYear();
    });

    // 4. Calculate Subject-wise Breakdown for the month
    const subjectStats = allSubjects
      .filter(sub => sub.department === student.department)
      .map(sub => {
        const subSessions = monthSessions.filter(s => s.subjectId === sub.id);
        const subRecords = monthRecords.filter(r => {
          const session = monthSessions.find(ms => ms.id === r.sessionId);
          return session?.subjectId === sub.id;
        });

        return {
          id: sub.id,
          name: sub.name,
          code: sub.code,
          conducted: subSessions.length,
          attended: subRecords.length,
          percentage: subSessions.length > 0 ? Math.round((subRecords.length / subSessions.length) * 100) : 0
        };
      })
      .filter(stat => stat.conducted > 0); // Only show subjects that had classes

    // 5. Overall percentage calculation
    const totalConducted = monthSessions.length;
    const totalAttended = monthRecords.filter(r => monthSessions.some(ms => ms.id === r.sessionId)).length;
    const overallPercentage = totalConducted > 0 ? Math.round((totalAttended / totalConducted) * 100) : 0;

    return {
      subjectStats,
      totalConducted,
      totalAttended,
      overallPercentage,
      recentRecords: myRecords.slice(-5).map(r => {
        const session = allSessions.find(s => s.id === r.sessionId);
        const subject = allSubjects.find(sub => sub.id === session?.subjectId);
        return {
          subject: subject?.name || 'Unknown',
          date: new Date(r.timestamp).toLocaleDateString(),
          period: session?.period || '?'
        };
      }).reverse()
    };
  }, [student, viewDate, scanResult]);

  const simulateScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      const sessions = Database.getSessions();
      const activeSession = sessions.find(s => 
        s.department === student.department &&
        s.year === student.year &&
        s.section === student.section &&
        s.expiryTime > Date.now()
      );

      if (!activeSession) {
        setScanResult({ success: false, message: 'No active session found for your class or QR code expired.' });
      } else {
        const existingRecord = Database.getRecords().find(r => 
          r.sessionId === activeSession.id && r.studentId === student.id
        );

        if (existingRecord) {
          setScanResult({ success: false, message: 'You have already marked attendance for this session.' });
        } else {
          const newRecord: AttendanceRecord = {
            id: Math.random().toString(36).substr(2, 9),
            sessionId: activeSession.id,
            studentId: student.id,
            timestamp: Date.now()
          };
          Database.addRecord(newRecord);
          setScanResult({ success: true, message: 'Attendance marked successfully!' });
        }
      }
      setIsScanning(false);
    }, 1500);
  };

  const changeMonth = (offset: number) => {
    const newDate = new Date(viewDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setViewDate(newDate);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Profile Card */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-full flex items-center justify-center text-2xl font-bold shadow-inner">
            {student.name.charAt(0)}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{student.name}</h1>
            <p className="text-indigo-100 opacity-90">{student.department} | {student.year} Year | Section {student.section}</p>
            <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-2">
               <span className="text-[10px] font-mono bg-white/10 px-2 py-0.5 rounded border border-white/10">ROLL: {student.rollNumber}</span>
               <span className="text-[10px] font-bold bg-indigo-500/50 px-2 py-0.5 rounded border border-white/10 uppercase">{student.role}</span>
            </div>
          </div>
          <div className="bg-white/10 p-3 rounded-xl border border-white/20 text-center min-w-[120px]">
             <p className="text-[10px] uppercase font-bold tracking-wider opacity-60">Avg Attendance</p>
             <p className="text-2xl font-black">{attendanceData.overallPercentage}%</p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex bg-white rounded-xl p-1 shadow-sm border border-slate-200">
        <button 
          onClick={() => setActiveTab('scan')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'scan' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          <Camera size={18} /> Attendance Scanner
        </button>
        <button 
          onClick={() => setActiveTab('monthly')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'monthly' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          <BarChart3 size={18} /> Monthly Reports
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Section */}
        <div className="lg:col-span-2 space-y-6">
          
          {activeTab === 'scan' ? (
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
              {scanResult ? (
                <div className={`p-8 rounded-2xl w-full ${scanResult.success ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'} border-2`}>
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${scanResult.success ? 'bg-green-500 text-white' : 'bg-orange-500 text-white'}`}>
                    {scanResult.success ? <CheckCircle size={32} /> : <AlertTriangle size={32} />}
                  </div>
                  <h3 className={`text-xl font-bold mb-2 ${scanResult.success ? 'text-green-800' : 'text-orange-800'}`}>
                    {scanResult.success ? 'Success!' : 'Oops!'}
                  </h3>
                  <p className={`mb-6 ${scanResult.success ? 'text-green-600' : 'text-orange-600'}`}>{scanResult.message}</p>
                  <button 
                    onClick={() => setScanResult(null)}
                    className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-all font-bold"
                  >
                    Okay
                  </button>
                </div>
              ) : isScanning ? (
                <div className="py-20 flex flex-col items-center">
                  <div className="relative w-48 h-48 border-2 border-indigo-600 rounded-2xl flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-x-0 top-0 h-1 bg-indigo-600 animate-[scan_2s_infinite]"></div>
                    <Camera size={64} className="text-indigo-200" />
                  </div>
                  <p className="mt-6 text-indigo-600 font-bold animate-pulse">Scanning QR Code...</p>
                  <p className="text-slate-400 text-sm">Validating batch details</p>
                </div>
              ) : (
                <>
                  <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-6">
                    <Camera size={32} />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-800">Scan Class QR</h2>
                  <p className="text-slate-500 mt-2 mb-8 max-w-xs">Scan the QR code displayed by your teacher to mark attendance for the current period.</p>
                  <button 
                    onClick={simulateScan}
                    className="w-full max-w-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 text-lg active:scale-95"
                  >
                    <Camera size={24} />
                    Open Scanner
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Calendar size={18} className="text-indigo-600" />
                  Monthly Attendance
                </h3>
                <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border">
                  <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-white rounded transition-all text-slate-400 hover:text-indigo-600"><ChevronLeft size={18} /></button>
                  <span className="text-xs font-bold text-slate-600 min-w-[100px] text-center">{months[viewDate.getMonth()]} {viewDate.getFullYear()}</span>
                  <button onClick={() => changeMonth(1)} className="p-1 hover:bg-white rounded transition-all text-slate-400 hover:text-indigo-600"><ChevronRight size={18} /></button>
                </div>
              </div>

              <div className="p-6">
                {attendanceData.subjectStats.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {attendanceData.subjectStats.map(stat => (
                      <div key={stat.id} className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-[10px] font-bold text-indigo-600 uppercase mb-0.5">{stat.code}</p>
                            <h4 className="font-bold text-slate-800 text-sm leading-tight">{stat.name}</h4>
                          </div>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${stat.percentage >= 75 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {stat.percentage}%
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="font-medium">Classes: {stat.attended} / {stat.conducted}</span>
                        </div>
                        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-500 ${stat.percentage >= 75 ? 'bg-green-500' : 'bg-red-500'}`} 
                            style={{width: `${stat.percentage}%`}}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-20 flex flex-col items-center">
                    <Calendar size={48} className="text-slate-200 mb-4" />
                    <p className="text-slate-400 font-medium">No classes recorded for this month</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <History size={20} className="text-indigo-600" />
              Latest Scans
            </h3>
            {attendanceData.recentRecords.length > 0 ? (
              <div className="space-y-3">
                {attendanceData.recentRecords.map((entry, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-indigo-200 transition-all group">
                    <div>
                      <p className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{entry.subject}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-[10px] font-medium text-slate-500">
                          <Calendar size={12} /> {entry.date}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] font-medium text-slate-500">
                          <Clock size={12} /> Period {entry.period}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-green-600 font-bold text-[10px] bg-green-50 px-3 py-1.5 rounded-full border border-green-100">
                      <UserCheck size={14} /> PRESENT
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-10 text-slate-400">No attendance records found yet.</p>
            )}
          </div>
        </div>

        {/* Sidebar stats */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 text-center flex flex-col items-center">
            <p className="text-slate-500 text-sm font-semibold mb-6">Current Monthly Summary</p>
            <div className="relative inline-flex items-center justify-center">
              <svg className="w-32 h-32 -rotate-90">
                <circle className="text-slate-100" strokeWidth="10" stroke="currentColor" fill="transparent" r="50" cx="64" cy="64" />
                <circle 
                  className={`${attendanceData.overallPercentage >= 75 ? 'text-indigo-600' : 'text-red-500'} transition-all duration-1000 ease-out`} 
                  strokeWidth="10" 
                  strokeDasharray={314.159} 
                  strokeDashoffset={314.159 * (1 - attendanceData.overallPercentage / 100)} 
                  strokeLinecap="round" 
                  stroke="currentColor" 
                  fill="transparent" 
                  r="50" 
                  cx="64" 
                  cy="64" 
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-2xl font-black text-slate-800">{attendanceData.overallPercentage}%</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">MONTHLY</span>
              </div>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-4 w-full pt-6 border-t border-slate-50">
               <div>
                  <p className="text-xs text-slate-400 font-bold mb-1">TOTAL CLASSES</p>
                  <p className="text-lg font-bold text-slate-800">{attendanceData.totalConducted}</p>
               </div>
               <div>
                  <p className="text-xs text-slate-400 font-bold mb-1">ATTENDED</p>
                  <p className="text-lg font-bold text-indigo-600">{attendanceData.totalAttended}</p>
               </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-6 leading-relaxed italic">Minimum 75% attendance is mandatory as per college norms.</p>
          </div>

          <div className="bg-indigo-600 p-6 rounded-2xl shadow-lg shadow-indigo-200 text-white relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all"></div>
            <h4 className="font-bold text-lg mb-3 flex items-center gap-2">
               <AlertTriangle size={18} className="text-indigo-200" />
               Institutional Info
            </h4>
            <div className="space-y-4">
              <div className="text-xs leading-relaxed">
                <p className="font-bold text-indigo-200 mb-1">Upcoming Holidays</p>
                <p className="opacity-90">Semester break begins from next Monday. Ensure all pending assignments are submitted.</p>
              </div>
              <div className="text-xs border-t border-white/10 pt-4 leading-relaxed">
                <p className="font-bold text-indigo-200 mb-1">Exam Hall Tickets</p>
                <p className="opacity-90">Available for download on the main portal starting Oct 1st.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes scan {
          0%, 100% { top: 0; }
          50% { top: 100%; }
        }
      `}</style>
    </div>
  );
};

export default StudentDashboard;
