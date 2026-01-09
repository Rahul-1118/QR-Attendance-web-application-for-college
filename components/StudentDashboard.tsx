
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Database, useDatabase } from '../store';
import { User, AttendanceSession, AttendanceRecord, Subject } from '../types';
import { CheckCircle, Clock, History, Camera, UserCheck, AlertTriangle, ChevronLeft, ChevronRight, BarChart3, X, ScanLine, RefreshCcw, Loader2, Zap, Smartphone, ArrowRight, Sparkles } from 'lucide-react';
import jsQR from 'jsqr';

interface StudentDashboardProps {
  student: User;
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({ student }) => {
  const { sessions, records, subjects } = useDatabase();
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanResult, setScanResult] = useState<{success: boolean, message: string} | null>(null);
  const [activeTab, setActiveTab] = useState<'scan' | 'monthly'>('scan');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [now, setNow] = useState(Date.now());

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestRef = useRef<number | null>(null);

  // Refs for high-speed access in the scan loop without triggering re-renders
  const activeSessionRef = useRef<AttendanceSession | null>(null);
  const isMarkedRef = useRef<boolean>(false);
  const isLoopActive = useRef<boolean>(false);
  const processingRef = useRef<boolean>(false);

  const [viewDate, setViewDate] = useState(new Date());
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Find session matching student's exact batch
  const activeSessionForMe = useMemo(() => {
    const studentDept = Database.normalize(student.department);
    const studentYear = Database.normalize(student.year);
    const studentSec = Database.normalize(student.section);

    return sessions.find(s => 
      Database.normalize(s.department) === studentDept &&
      Database.normalize(s.year) === studentYear &&
      Database.normalize(s.section) === studentSec &&
      s.expiryTime > now
    );
  }, [student, sessions, now]);

  const isMarked = useMemo(() => {
    if (!activeSessionForMe) return false;
    return records.some(r => r.sessionId === activeSessionForMe.id && r.studentId === student.id);
  }, [activeSessionForMe, records, student.id]);

  // Sync refs with state/memo
  useEffect(() => { activeSessionRef.current = activeSessionForMe; }, [activeSessionForMe]);
  useEffect(() => { isMarkedRef.current = isMarked; }, [isMarked]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Database.init();
    } finally {
      setTimeout(() => setIsRefreshing(false), 800);
    }
  };

  const handleProcessAttendance = async (session: AttendanceSession) => {
    if (processingRef.current) return;
    
    processingRef.current = true;
    isLoopActive.current = false;
    setIsProcessing(true);
    
    try {
      await Database.addRecord({
        id: Math.random().toString(36).substr(2, 9),
        sessionId: session.id,
        studentId: student.id,
        timestamp: Date.now()
      });
      
      setScanResult({ success: true, message: 'Attendance Recorded!' });
      
      // Auto-close scanner after success feedback
      setTimeout(() => {
        setIsScannerOpen(false);
        setScanResult(null);
        setIsProcessing(false);
        processingRef.current = false;
      }, 2500);
    } catch (err) {
      console.error("Attendance submission failed:", err);
      setScanResult({ success: false, message: 'Failed to sync with server. Try again.' });
      setIsProcessing(false);
      processingRef.current = false;
      // Resume loop on failure
      isLoopActive.current = true;
      requestRef.current = requestAnimationFrame(tick);
    }
  };

  const tick = () => {
    if (!isLoopActive.current || !isScannerOpen || processingRef.current) return;

    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const video = videoRef.current;
      const canvasElement = canvasRef.current;
      if (!canvasElement) return;
      
      const canvas = canvasElement.getContext("2d", { willReadFrequently: true });
      if (!canvas) return;

      // Always match canvas to actual video stream resolution for best QR detection
      if (canvasElement.width !== video.videoWidth || canvasElement.height !== video.videoHeight) {
        canvasElement.width = video.videoWidth;
        canvasElement.height = video.videoHeight;
      }
      
      // Draw frame from raw video
      canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
      
      // Analyze frame for QR
      const imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "attemptBoth", // Better detection in various environments
      });
      
      if (code && code.data) {
        const session = activeSessionRef.current;
        // Check if QR matches current live session for this specific student
        if (session && code.data === session.qrPayload) {
          if (!isMarkedRef.current) {
            handleProcessAttendance(session);
            return; // Stop the loop
          } else {
            setScanResult({ success: true, message: 'Already marked for this class.' });
            isLoopActive.current = false;
            setTimeout(() => setIsScannerOpen(false), 2000);
            return;
          }
        }
      }
    }
    
    // Request next frame
    requestRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    if (!isScannerOpen) {
      isLoopActive.current = false;
      processingRef.current = false;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      return;
    }

    let isMounted = true;
    setCameraError(null);
    setIsInitializing(true);
    setScanResult(null);

    const startCamera = async () => {
      try {
        const constraints = {
          video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints)
          .catch(() => navigator.mediaDevices.getUserMedia({ video: true }));

        if (isMounted) {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.setAttribute("playsinline", "true");
            await videoRef.current.play();
            setIsInitializing(false);
            isLoopActive.current = true;
            requestRef.current = requestAnimationFrame(tick);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          console.error("Camera access failed:", err);
          setCameraError("Camera permission denied. Please enable camera access in your browser settings.");
          setIsInitializing(false);
        }
      }
    };

    startCamera();

    return () => { 
      isMounted = false; 
      isLoopActive.current = false;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop()); 
    };
  }, [isScannerOpen]);

  const resetAttendanceForDemo = async () => {
    if (!activeSessionForMe) return;
    const myRecord = records.find(r => r.sessionId === activeSessionForMe.id && r.studentId === student.id);
    if (myRecord) {
      await Database.deleteRecord(myRecord.id);
      setScanResult(null);
      processingRef.current = false;
    }
  };

  const attendanceData = useMemo(() => {
    const studentDept = Database.normalize(student.department);
    const batchSessions = sessions.filter(s => 
      Database.normalize(s.department) === studentDept && 
      Database.normalize(s.year) === Database.normalize(student.year) && 
      Database.normalize(s.section) === Database.normalize(student.section)
    );
    const myRecords = records.filter(r => r.studentId === student.id);
    const monthSessions = batchSessions.filter(s => new Date(s.startTime).getMonth() === viewDate.getMonth());
    const monthRecords = myRecords.filter(r => monthSessions.some(ms => ms.id === r.sessionId));

    const subjectStats = subjects.filter(sub => Database.normalize(sub.department) === studentDept).map(sub => {
      const subSessions = monthSessions.filter(s => s.subjectId === sub.id);
      const subRecords = monthRecords.filter(r => {
        const sess = monthSessions.find(ms => ms.id === r.sessionId);
        return sess && sess.subjectId === sub.id;
      });
      return { 
        name: sub.name, 
        code: sub.code, 
        conducted: subSessions.length, 
        attended: subRecords.length, 
        percentage: subSessions.length > 0 ? Math.round((subRecords.length / subSessions.length) * 100) : 0 
      };
    }).filter(s => s.conducted > 0);

    const totalConducted = monthSessions.length;
    const totalAttended = monthRecords.length;
    return { subjectStats, overallPercentage: totalConducted > 0 ? Math.round((totalAttended / totalConducted) * 100) : 0 };
  }, [student, viewDate, sessions, records, subjects]);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 rounded-[2.5rem] p-8 text-white shadow-2xl flex flex-col sm:flex-row items-center gap-8 border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none"><Zap size={140} /></div>
        <div className="w-24 h-24 bg-white/20 rounded-3xl flex items-center justify-center text-4xl font-black border border-white/30 backdrop-blur-md shadow-inner shrink-0 rotate-3">
          {student.name.charAt(0)}
        </div>
        <div className="text-center sm:text-left flex-1">
          <h2 className="text-3xl font-black tracking-tight mb-2">{student.name}</h2>
          <div className="flex flex-wrap justify-center sm:justify-start gap-2">
            <span className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10">{student.department}</span>
            <span className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10">{student.year} YEAR</span>
            <span className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10">SEC {student.section}</span>
          </div>
        </div>
        <div className="bg-white/10 px-8 py-4 rounded-[2rem] backdrop-blur-xl border border-white/20 text-center min-w-[140px] shadow-lg">
          <p className="text-[10px] uppercase font-black opacity-60 tracking-widest mb-1">Overall</p>
          <p className="text-4xl font-black">{attendanceData.overallPercentage}%</p>
        </div>
      </div>

      <div className="flex bg-white p-2 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 sticky top-20 z-40">
        <button onClick={() => setActiveTab('scan')} className={`flex-1 py-4 rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-2 tracking-tight ${activeTab === 'scan' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200' : 'text-slate-400 hover:bg-slate-50'}`}>
          <Smartphone size={18} /> SCANNER
        </button>
        <button onClick={() => setActiveTab('monthly')} className={`flex-1 py-4 rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-2 tracking-tight ${activeTab === 'monthly' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200' : 'text-slate-400 hover:bg-slate-50'}`}>
          <History size={18} /> RECORDS
        </button>
      </div>

      {activeTab === 'scan' && (
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 space-y-8">
          <div className="flex justify-between items-center px-2">
            <h3 className="font-black text-slate-800 tracking-tight flex items-center gap-2 uppercase text-xs">
              <Zap size={16} className="text-indigo-600 fill-indigo-600" /> Live Detection
            </h3>
            <button 
              onClick={handleManualRefresh} 
              className={`flex items-center gap-2 px-4 py-2 text-xs font-black text-indigo-600 bg-indigo-50 rounded-xl border border-indigo-100 transition-all uppercase tracking-widest ${isRefreshing ? 'opacity-50 cursor-wait' : 'hover:bg-indigo-100'}`}
            >
              <RefreshCcw size={14} className={isRefreshing ? 'animate-spin' : ''} />
              {isRefreshing ? 'Syncing...' : 'Refresh'}
            </button>
          </div>

          {activeSessionForMe ? (
            <div className="p-10 bg-indigo-50/50 border-2 border-dashed border-indigo-200 rounded-[2.5rem] text-center relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-6">
                <span className="flex items-center gap-1.5 bg-green-500 text-white px-5 py-2 rounded-full text-[10px] font-black tracking-widest animate-pulse uppercase shadow-xl shadow-green-200">
                  <Sparkles size={12} fill="currentColor" /> Session Live
                </span>
              </div>
              
              <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-3xl shadow-xl text-indigo-600 mb-6 border border-indigo-50">
                <ScanLine size={40} />
              </div>

              <h4 className="font-black text-slate-800 text-3xl mb-2">
                {subjects.find(s => s.id === activeSessionForMe.subjectId)?.name || "Class Session"}
              </h4>
              <p className="text-slate-400 font-bold text-sm mb-10 flex items-center justify-center gap-2">
                <Clock size={16} className="text-indigo-400" /> Period {activeSessionForMe.period} • {activeSessionForMe.department}
              </p>
              
              {!isMarked ? (
                <button 
                  onClick={() => setIsScannerOpen(true)} 
                  className="w-full max-w-sm mx-auto bg-indigo-600 text-white py-6 rounded-[2rem] font-black flex items-center justify-center gap-3 shadow-[0_20px_40px_rgba(79,70,229,0.3)] hover:bg-indigo-700 transition-all active:scale-[0.98] uppercase tracking-widest text-sm"
                >
                  <Camera size={24} /> Point & Scan Faculty QR
                </button>
              ) : (
                <div className="space-y-6">
                  <div className="w-full max-w-sm mx-auto bg-green-600 text-white py-6 rounded-[2rem] font-black flex items-center justify-center gap-3 shadow-[0_20px_40px_rgba(22,163,74,0.3)]">
                    <CheckCircle size={24} /> Verified Present
                  </div>
                  <button onClick={resetAttendanceForDemo} className="text-[10px] text-slate-300 hover:text-indigo-600 uppercase font-black tracking-[0.2em] transition-colors">
                    Reset For Testing
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="py-24 text-center bg-slate-50/50 border-2 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center">
              <div className="w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center mb-8 text-slate-200 shadow-inner">
                <Smartphone size={48} />
              </div>
              <p className="font-black text-slate-500 text-xl mb-4">No Session Found for Your Batch</p>
              <div className="p-6 bg-white border border-slate-100 rounded-[2rem] text-xs text-slate-400 space-y-2 shadow-sm">
                <p className="uppercase font-black tracking-widest opacity-60">Your Registered Details</p>
                <div className="flex gap-3 justify-center font-black text-indigo-600 uppercase text-sm">
                  <span>{student.department}</span>
                  <span className="opacity-20">•</span>
                  <span>{student.year} YEAR</span>
                  <span className="opacity-20">•</span>
                  <span>SEC {student.section}</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-300 mt-10 max-w-[320px] leading-relaxed italic font-medium">
                Wait for your teacher to generate the QR code. Sessions will appear here instantly.
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'monthly' && (
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 space-y-8">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">{months[viewDate.getMonth()]} {viewDate.getFullYear()}</h3>
            <div className="flex gap-3">
              <button onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() - 1)))} className="w-12 h-12 flex items-center justify-center border border-slate-100 rounded-2xl hover:bg-slate-50 transition-colors shadow-sm"><ChevronLeft size={20}/></button>
              <button onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() + 1)))} className="w-12 h-12 flex items-center justify-center border border-slate-100 rounded-2xl hover:bg-slate-50 transition-colors shadow-sm"><ChevronRight size={20}/></button>
            </div>
          </div>
          {attendanceData.subjectStats.length === 0 ? (
            <div className="py-24 text-center text-slate-300 bg-slate-50/50 rounded-[2.5rem] border-2 border-dashed">
              <BarChart3 size={64} className="mx-auto mb-6 opacity-10" />
              <p className="text-sm font-black uppercase tracking-widest">No history for this month</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {attendanceData.subjectStats.map((s, i) => (
                <div key={i} className="p-6 bg-white border border-slate-100 rounded-3xl flex justify-between items-center group hover:border-indigo-400 transition-all hover:shadow-2xl hover:shadow-indigo-100/50">
                  <div className="space-y-1">
                    <p className="font-black text-slate-800 text-lg tracking-tight">{s.name}</p>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.15em]">{s.attended} Present / {s.conducted} Total</p>
                  </div>
                  <div className={`text-2xl font-black px-4 py-2 rounded-2xl ${s.percentage >= 75 ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}>
                    {s.percentage}%
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isScannerOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/98 backdrop-blur-2xl flex flex-col items-center justify-center p-6 overflow-hidden">
          <button 
            onClick={() => setIsScannerOpen(false)} 
            className="absolute top-10 right-10 p-4 bg-white/10 rounded-full text-white hover:bg-white/20 transition-all z-[110] border border-white/10 shadow-2xl"
          >
            <X size={24}/>
          </button>
          
          <div className="w-full max-w-sm flex flex-col items-center gap-10">
            {scanResult ? (
              <div className={`w-full rounded-[3rem] p-10 text-center space-y-6 shadow-2xl animate-in zoom-in duration-300 ${scanResult.success ? 'bg-white border-4 border-green-500 shadow-green-200' : 'bg-white border-4 border-red-500 shadow-red-200'}`}>
                <div className={`w-24 h-24 rounded-[2rem] mx-auto flex items-center justify-center shadow-inner ${scanResult.success ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                  {scanResult.success ? <UserCheck size={48} /> : <AlertTriangle size={48} />}
                </div>
                <div className="space-y-2">
                  <h3 className={`text-2xl font-black tracking-tight ${scanResult.success ? 'text-green-600' : 'text-red-600'}`}>
                    {scanResult.success ? 'Attendance Submitted' : 'Sync Error'}
                  </h3>
                  <p className="text-slate-500 font-bold">{scanResult.message}</p>
                </div>
              </div>
            ) : (
              <>
                <div className="relative w-full aspect-square border-[10px] border-indigo-500 rounded-[4rem] overflow-hidden shadow-[0_0_120px_rgba(79,70,229,0.5)] bg-black">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-indigo-400 shadow-[0_0_35px_rgba(79,70,229,1)] animate-scanner z-10"></div>
                  
                  {/* Viewfinder corners */}
                  <div className="absolute top-10 left-10 w-16 h-16 border-t-8 border-l-8 border-white/40 rounded-tl-2xl"></div>
                  <div className="absolute top-10 right-10 w-16 h-16 border-t-8 border-r-8 border-white/40 rounded-tr-2xl"></div>
                  <div className="absolute bottom-10 left-10 w-16 h-16 border-b-8 border-l-8 border-white/40 rounded-bl-2xl"></div>
                  <div className="absolute bottom-10 right-10 w-16 h-16 border-b-8 border-r-8 border-white/40 rounded-br-2xl"></div>
                  
                  {isInitializing && (
                    <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center text-white gap-6">
                      <div className="relative">
                        <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        <Camera className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-500" size={24} />
                      </div>
                      <p className="text-xs font-black uppercase tracking-[0.2em] animate-pulse">Vision Syncing...</p>
                    </div>
                  )}

                  {isProcessing && (
                    <div className="absolute inset-0 bg-indigo-600/90 backdrop-blur-md flex flex-col items-center justify-center text-white gap-4">
                      <Loader2 className="animate-spin" size={48} />
                      <p className="font-black uppercase tracking-widest text-xs">Authenticating...</p>
                    </div>
                  )}

                  {cameraError && (
                    <div className="absolute inset-0 bg-slate-900 p-10 flex flex-col items-center justify-center text-center text-white gap-6">
                      <AlertTriangle className="text-red-500" size={64} />
                      <div className="space-y-2">
                        <p className="font-black text-lg">Camera Error</p>
                        <p className="text-slate-400 text-xs font-medium leading-relaxed">{cameraError}</p>
                      </div>
                      <button onClick={() => setIsScannerOpen(false)} className="px-8 py-4 bg-indigo-600 rounded-2xl text-[10px] font-black uppercase tracking-widest">Go Back</button>
                    </div>
                  )}
                </div>
                
                <div className="text-center space-y-4">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/5 rounded-full border border-white/10 text-white">
                     <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
                     <p className="font-black tracking-[0.3em] uppercase text-[10px] opacity-80">
                        Analyzing: {subjects.find(s => s.id === activeSessionForMe?.subjectId)?.name || "Live Session"}
                     </p>
                  </div>
                  <p className="text-slate-400 text-sm max-w-[280px] font-medium leading-relaxed">
                    Point camera at the teacher's screen. Attendance is processed <span className="text-indigo-400 font-black uppercase">automatically</span>.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes scanner { 
          0% { top: 10%; opacity: 0; } 
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 90%; opacity: 0; } 
        } 
        .animate-scanner { animation: scanner 2s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
      `}</style>
    </div>
  );
};

export default StudentDashboard;
