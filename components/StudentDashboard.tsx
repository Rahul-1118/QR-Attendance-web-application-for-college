
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Database } from '../store';
import { User, AttendanceSession, AttendanceRecord, Subject } from '../types';
import { Calendar, CheckCircle, Clock, History, Camera, UserCheck, AlertTriangle, ChevronLeft, ChevronRight, BarChart3, Info, Wifi, WifiOff, X, ScanLine, RefreshCcw, Loader2 } from 'lucide-react';

interface StudentDashboardProps {
  student: User;
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({ student }) => {
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanResult, setScanResult] = useState<{success: boolean, message: string} | null>(null);
  const [activeTab, setActiveTab] = useState<'scan' | 'monthly'>('scan');
  const [autoScanProgress, setAutoScanProgress] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [viewDate, setViewDate] = useState(new Date());
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const activeSessionForMe = useMemo(() => {
    const sessions = Database.getSessions();
    return sessions.find(s => 
      s.department === student.department &&
      s.year === student.year &&
      s.section === student.section &&
      s.expiryTime > Date.now()
    );
  }, [student, scanResult]);

  const checkAlreadyMarked = () => {
    if (!activeSessionForMe) return false;
    const records = Database.getRecords();
    return records.some(r => r.sessionId === activeSessionForMe.id && r.studentId === student.id);
  };

  const isMarked = checkAlreadyMarked();

  // Camera Initialization
  useEffect(() => {
    if (!isScannerOpen) return;

    let isMounted = true;
    setCameraError(null);
    setIsInitializing(true);
    setAutoScanProgress(0);

    const initCamera = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Your browser does not support camera access.");
        }

        // Try environment camera first
        const constraints: MediaStreamConstraints = { 
          video: { facingMode: 'environment' } 
        };
        
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (e) {
          console.warn("Environment camera failed, trying default", e);
          // Fallback to any available camera
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
        
        if (isMounted) {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            // Force play and stop initializing spinner
            try {
              await videoRef.current.play();
            } catch (playErr) {
              console.error("Autoplay blocked:", playErr);
            }
            setIsInitializing(false);
          }
        }
      } catch (err: any) {
        console.error("Camera Error:", err);
        if (isMounted) {
          setCameraError(err.message || "Could not start camera.");
          setIsInitializing(false);
        }
      }
    };

    // Small delay to ensure DOM is ready
    const timer = setTimeout(initCamera, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [isScannerOpen]);

  // Auto-Scan Logic
  useEffect(() => {
    let timer: any;
    if (isScannerOpen && !isInitializing && !isProcessing && !scanResult && !cameraError) {
      const duration = 2500; // 2.5 seconds
      const interval = 50;
      const step = (interval / duration) * 100;
      
      timer = setInterval(() => {
        setAutoScanProgress(prev => {
          if (prev >= 100) {
            clearInterval(timer);
            handleFinalizeScan();
            return 100;
          }
          return prev + step;
        });
      }, interval);
    }
    return () => clearInterval(timer);
  }, [isScannerOpen, isInitializing, isProcessing, scanResult, cameraError]);

  const handleFinalizeScan = () => {
    setIsProcessing(true);
    setTimeout(() => {
      const alreadyMarked = checkAlreadyMarked();
      if (!activeSessionForMe) {
        setScanResult({ success: false, message: 'No active session found for your batch.' });
      } else if (alreadyMarked) {
        setScanResult({ success: false, message: 'You have already marked attendance for this session.' });
      } else {
        const newRecord: AttendanceRecord = {
          id: Math.random().toString(36).substr(2, 9),
          sessionId: activeSessionForMe.id,
          studentId: student.id,
          timestamp: Date.now()
        };
        Database.addRecord(newRecord);
        setScanResult({ success: true, message: 'Attendance recorded successfully!' });
      }
      setIsProcessing(false);
      setIsScannerOpen(false);
    }, 500);
  };

  const resetAttendanceForDemo = () => {
    if (!activeSessionForMe) {
      alert("No active session detected.");
      return;
    }
    const records = Database.getRecords();
    const newRecords = records.filter(r => !(r.sessionId === activeSessionForMe.id && r.studentId === student.id));
    localStorage.setItem('qra_records', JSON.stringify(newRecords));
    setScanResult(null);
    alert("Records cleared! You can try scanning again.");
  };

  const changeMonth = (offset: number) => {
    const newDate = new Date(viewDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setViewDate(newDate);
  };

  const attendanceData = useMemo(() => {
    const allSessions = Database.getSessions();
    const allRecords = Database.getRecords();
    const allSubjects = Database.getSubjects();

    const batchSessions = allSessions.filter(s => 
      s.department === student.department &&
      s.year === student.year &&
      s.section === student.section
    );

    const myRecords = allRecords.filter(r => r.studentId === student.id);

    const monthSessions = batchSessions.filter(s => {
      const d = new Date(s.startTime);
      return d.getMonth() === viewDate.getMonth() && d.getFullYear() === viewDate.getFullYear();
    });

    const monthRecords = myRecords.filter(r => {
      const d = new Date(r.timestamp);
      return d.getMonth() === viewDate.getMonth() && d.getFullYear() === viewDate.getFullYear();
    });

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
      .filter(stat => stat.conducted > 0);

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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Profile Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center text-3xl font-bold backdrop-blur-md border border-white/30">
            {student.name.charAt(0)}
          </div>
          <div className="text-center md:text-left">
            <h2 className="text-2xl font-bold">{student.name}</h2>
            <div className="flex flex-wrap justify-center md:justify-start gap-3 mt-2 opacity-90 text-sm">
              <span className="bg-white/10 px-3 py-1 rounded-full border border-white/10">Roll: {student.rollNumber}</span>
              <span className="bg-white/10 px-3 py-1 rounded-full border border-white/10">{student.department} Dept</span>
              <span className="bg-white/10 px-3 py-1 rounded-full border border-white/10">{student.year} Year / Sec {student.section}</span>
            </div>
          </div>
          <div className="md:ml-auto flex gap-4">
             <div className="text-center">
                <p className="text-xs uppercase opacity-70 mb-1">Attendance</p>
                <p className="text-2xl font-bold">{attendanceData.overallPercentage}%</p>
             </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
        <button 
          onClick={() => setActiveTab('scan')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'scan' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          <Camera size={18} />
          Scan QR Code
        </button>
        <button 
          onClick={() => setActiveTab('monthly')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'monthly' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          <History size={18} />
          Reports & History
        </button>
      </div>

      {activeTab === 'scan' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Scan Section */}
          <div className="md:col-span-2 space-y-6">
             {scanResult && (
               <div className={`p-4 rounded-xl border flex items-center gap-3 animate-in slide-in-from-top-4 duration-300 ${scanResult.success ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                 {scanResult.success ? <CheckCircle className="shrink-0" /> : <AlertTriangle className="shrink-0" />}
                 <div className="flex-1">
                   <p className="font-bold">{scanResult.success ? 'Success!' : 'Scan Failed'}</p>
                   <p className="text-sm opacity-90">{scanResult.message}</p>
                 </div>
                 <button onClick={() => setScanResult(null)} className="p-1 hover:bg-black/5 rounded-full"><X size={16} /></button>
               </div>
             )}

             <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
               <div className="flex items-center justify-between mb-6">
                 <div>
                   <h3 className="text-lg font-bold text-slate-800">Current Session</h3>
                   <p className="text-xs text-slate-500">Only sessions for your batch appear here</p>
                 </div>
                 {activeSessionForMe && (
                   <div className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold animate-pulse">
                     <Wifi size={14} /> LIVE SESSION
                   </div>
                 )}
               </div>

               {activeSessionForMe ? (
                 <div className="p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-indigo-600 border border-indigo-100 shadow-sm">
                        <Clock size={24} />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-slate-800">{Database.getSubjects().find(s => s.id === activeSessionForMe.subjectId)?.name}</h4>
                        <div className="flex gap-4 mt-1">
                          <span className="text-xs font-medium text-slate-500 flex items-center gap-1"><UserCheck size={14} /> Period {activeSessionForMe.period}</span>
                          <span className="text-xs font-medium text-slate-500 flex items-center gap-1"><Clock size={14} /> Expiring Soon</span>
                        </div>
                      </div>
                    </div>

                    {!isMarked ? (
                      <button 
                        onClick={() => setIsScannerOpen(true)}
                        className="w-full mt-6 bg-indigo-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-100 active:scale-[0.98] transition-all"
                      >
                        <Camera size={20} />
                        Mark Attendance
                      </button>
                    ) : (
                      <div className="mt-6 flex flex-col items-center gap-3">
                         <div className="w-full bg-green-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 cursor-default">
                           <CheckCircle size={20} />
                           Attendance Marked
                         </div>
                         <button onClick={resetAttendanceForDemo} className="text-xs text-slate-400 hover:text-indigo-600 font-medium">Reset for Demo</button>
                      </div>
                    )}
                 </div>
               ) : (
                 <div className="py-12 flex flex-col items-center opacity-50">
                   <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-4">
                     <WifiOff size={32} />
                   </div>
                   <p className="text-slate-500 font-medium">No active session at the moment</p>
                 </div>
               )}
             </div>
          </div>

          {/* Side Info */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><History size={18} className="text-indigo-600" /> Recent Scans</h3>
              <div className="space-y-3">
                {attendanceData.recentRecords.length > 0 ? attendanceData.recentRecords.map((r, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <p className="text-sm font-bold text-slate-800 truncate max-w-[120px]">{r.subject}</p>
                      <p className="text-[10px] text-slate-500">{r.date} • Period {r.period}</p>
                    </div>
                    <CheckCircle size={16} className="text-green-500" />
                  </div>
                )) : (
                   <p className="text-xs text-slate-400 text-center py-4 italic">No recent activity</p>
                )}
              </div>
            </div>

            <div className="bg-indigo-600 p-6 rounded-2xl text-white shadow-lg shadow-indigo-100">
              <div className="flex items-center gap-3 mb-4">
                <Info size={18} className="opacity-80" />
                <h3 className="font-bold">Guidelines</h3>
              </div>
              <ul className="text-xs space-y-2 opacity-90 list-disc ml-4">
                <li>Scanner works best in good lighting</li>
                <li>Ensure you are connected to college Wi-Fi</li>
                <li>Duplicate scans will not be recorded</li>
                <li>Sessions expire after 10 minutes</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'monthly' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
             <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                   <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><ChevronLeft size={20} /></button>
                   <h3 className="text-lg font-bold text-slate-800 min-w-[150px] text-center">{months[viewDate.getMonth()]} {viewDate.getFullYear()}</h3>
                   <button onClick={() => changeMonth(1)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><ChevronRight size={20} /></button>
                </div>
                <div className="flex items-center gap-2 text-sm font-bold text-indigo-600 bg-indigo-50 px-4 py-2 rounded-full">
                  <BarChart3 size={18} />
                  {attendanceData.overallPercentage}% Monthly Avg
                </div>
             </div>

             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
               {attendanceData.subjectStats.map(stat => (
                 <div key={stat.id} className="p-5 rounded-2xl border border-slate-100 bg-slate-50/50 hover:border-indigo-200 transition-all group">
                   <div className="flex items-center justify-between mb-3">
                     <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase">{stat.code}</span>
                     <span className={`text-xs font-bold ${stat.percentage >= 75 ? 'text-green-600' : stat.percentage >= 60 ? 'text-orange-600' : 'text-red-600'}`}>
                       {stat.percentage}%
                     </span>
                   </div>
                   <h4 className="font-bold text-slate-800 text-sm mb-4 line-clamp-1">{stat.name}</h4>
                   <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                     <span>{stat.attended} Attended</span>
                     <span>{stat.conducted} Total</span>
                   </div>
                   <div className="mt-2 w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                     <div 
                        className={`h-full transition-all duration-1000 ${stat.percentage >= 75 ? 'bg-green-500' : stat.percentage >= 60 ? 'bg-orange-500' : 'bg-red-500'}`} 
                        style={{width: `${stat.percentage}%`}}
                      ></div>
                   </div>
                 </div>
               ))}
               {attendanceData.subjectStats.length === 0 && (
                 <div className="col-span-full py-12 text-center text-slate-400">
                    <Calendar size={48} className="mx-auto mb-4 opacity-20" />
                    <p>No classes conducted in this period</p>
                 </div>
               )}
             </div>
          </div>
        </div>
      )}

      {/* Scanner Modal */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col">
          <div className="p-4 flex items-center justify-between text-white bg-black/50 backdrop-blur-md absolute top-0 left-0 right-0 z-10">
            <div className="flex items-center gap-3">
              <Camera size={20} className="text-indigo-400" />
              <h3 className="font-bold">QR Attendance Scanner</h3>
            </div>
            <button onClick={() => setIsScannerOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <X size={24} />
            </button>
          </div>

          <div className="flex-1 relative flex items-center justify-center bg-slate-900">
            {isInitializing && (
              <div className="flex flex-col items-center gap-3 text-white">
                <Loader2 size={48} className="animate-spin text-indigo-500" />
                <p className="text-sm font-medium">Accessing Camera...</p>
              </div>
            )}

            {cameraError && (
              <div className="max-w-xs text-center p-8 bg-red-900/20 rounded-3xl border border-red-500/30 text-red-100">
                <AlertTriangle size={48} className="mx-auto mb-4 text-red-500" />
                <h4 className="font-bold mb-2">Camera Access Failed</h4>
                <p className="text-sm opacity-80 mb-6">{cameraError}</p>
                <button 
                  onClick={() => setIsScannerOpen(false)}
                  className="w-full bg-white text-slate-900 py-3 rounded-xl font-bold hover:bg-slate-100 transition-colors"
                >
                  Go Back
                </button>
              </div>
            )}

            {!cameraError && (
              <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted
                  className="w-full h-full object-cover"
                />
                
                {/* Scanner Overlay */}
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                  <div className="relative w-72 h-72">
                    {/* Corner Borders */}
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-indigo-500 rounded-tl-2xl"></div>
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-indigo-500 rounded-tr-2xl"></div>
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-indigo-500 rounded-bl-2xl"></div>
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-indigo-500 rounded-br-2xl"></div>
                    
                    {/* Scanning Line */}
                    <div className="absolute top-0 left-4 right-4 h-1 bg-indigo-500/50 shadow-[0_0_15px_rgba(79,70,229,0.8)] animate-scanner"></div>
                    
                    {/* Success/Processing Overlay */}
                    {isProcessing && (
                      <div className="absolute inset-0 bg-indigo-600/20 backdrop-blur-[2px] rounded-2xl flex items-center justify-center">
                        <RefreshCcw size={48} className="text-white animate-spin" />
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-12 text-center text-white space-y-4">
                    <p className="text-sm font-bold tracking-widest uppercase flex items-center gap-2">
                       <ScanLine size={16} className="text-indigo-400" /> Align QR within frame
                    </p>
                    <div className="w-64 h-2 bg-white/20 rounded-full overflow-hidden">
                       <div className="h-full bg-indigo-500 transition-all duration-100" style={{width: `${autoScanProgress}%`}}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-8 bg-black/80 backdrop-blur-xl border-t border-white/5 flex justify-center">
            <p className="text-white/40 text-xs font-medium uppercase tracking-[0.2em]">QR-Attend Secure Verification</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;
