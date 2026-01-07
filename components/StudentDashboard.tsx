
import React, { useState, useEffect } from 'react';
import { Database } from '../store';
import { User, AttendanceSession, AttendanceRecord, Subject } from '../types';
import { Calendar, CheckCircle, Clock, History, Camera, UserCheck, AlertTriangle } from 'lucide-react';

interface StudentDashboardProps {
  student: User;
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({ student }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{success: boolean, message: string} | null>(null);
  const [history, setHistory] = useState<{subject: string, date: string, period: string}[]>([]);

  useEffect(() => {
    const records = Database.getRecords().filter(r => r.studentId === student.id);
    const sessions = Database.getSessions();
    const subjects = Database.getSubjects();

    const historyData = records.map(r => {
      const session = sessions.find(s => s.id === r.sessionId);
      const subject = subjects.find(sub => sub.id === session?.subjectId);
      return {
        subject: subject?.name || 'Unknown',
        date: new Date(r.timestamp).toLocaleDateString(),
        period: session?.period || '?'
      };
    }).reverse();

    setHistory(historyData);
  }, [student, scanResult]);

  const simulateScan = () => {
    // In a real app, this would use a camera library.
    // For this prototype, we'll simulate the scanning logic.
    setIsScanning(true);
    setTimeout(() => {
      const sessions = Database.getSessions();
      // Find the most recent active session for this student's class
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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Profile Card */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-full flex items-center justify-center text-2xl font-bold">
            {student.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{student.name}</h1>
            <p className="text-indigo-100 opacity-90">{student.department} | {student.year} Year | Section {student.section}</p>
            <p className="text-xs font-mono mt-1 bg-white/10 w-fit px-2 py-0.5 rounded">Roll No: {student.rollNumber}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Scanner Section */}
        <div className="md:col-span-2 space-y-6">
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
                  className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-all"
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
                <p className="text-slate-400 text-sm">Please hold your device steady</p>
              </div>
            ) : (
              <>
                <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-6">
                  <Camera size={32} />
                </div>
                <h2 className="text-2xl font-bold text-slate-800">Ready to Scan?</h2>
                <p className="text-slate-500 mt-2 mb-8 max-w-xs">Scan the QR code displayed by your teacher to mark your attendance for the current period.</p>
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

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <History size={20} className="text-indigo-600" />
              Recent Attendance
            </h3>
            {history.length > 0 ? (
              <div className="space-y-3">
                {history.slice(0, 5).map((entry, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <p className="font-bold text-slate-800">{entry.subject}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <Calendar size={12} /> {entry.date}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <Clock size={12} /> Period {entry.period}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-green-600 font-bold text-sm bg-green-50 px-3 py-1 rounded-full">
                      <UserCheck size={14} /> Present
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
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 text-center">
            <p className="text-slate-500 text-sm font-medium">Average Attendance</p>
            <div className="relative inline-flex items-center justify-center mt-4">
              <svg className="w-24 h-24">
                <circle className="text-slate-100" strokeWidth="8" stroke="currentColor" fill="transparent" r="40" cx="48" cy="48" />
                <circle className="text-indigo-600" strokeWidth="8" strokeDasharray={251.2} strokeDashoffset={251.2 * (1 - 0.85)} strokeLinecap="round" stroke="currentColor" fill="transparent" r="40" cx="48" cy="48" />
              </svg>
              <span className="absolute text-xl font-bold text-slate-800">85%</span>
            </div>
            <p className="text-xs text-slate-400 mt-4">Required: 75%</p>
          </div>

          <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
            <h4 className="font-bold text-indigo-900 mb-2">Notice Board</h4>
            <div className="space-y-4">
              <div className="text-xs">
                <p className="font-bold text-indigo-700">Lab Submission</p>
                <p className="text-indigo-600/80">Submit your DS assignments by tomorrow 5 PM.</p>
              </div>
              <div className="text-xs border-t border-indigo-200 pt-2">
                <p className="font-bold text-indigo-700">Exam Update</p>
                <p className="text-indigo-600/80">Mid-term schedule released on student portal.</p>
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
