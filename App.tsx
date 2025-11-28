import React, { useEffect, useRef, useState } from 'react';
import { useGeminiLive } from './hooks/useGeminiLive';
import { ConnectionState } from './types';
import Visualizer from './components/Visualizer';
import TranscriptCard from './components/TranscriptCard';

// Icons
const MicIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
);

const StopIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="6" width="12" height="12" rx="2" ry="2"/></svg>
);

const App: React.FC = () => {
  const { connect, disconnect, status, turns, audioAnalyser } = useGeminiLive();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom when new turns arrive
  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [turns, autoScroll]);

  // Handle scroll events to disable auto-scroll if user scrolls up
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isAtBottom = scrollHeight - scrollTop === clientHeight;
    // Allow a small margin of error (20px)
    if (scrollHeight - scrollTop - clientHeight < 50) {
      setAutoScroll(true);
    } else {
      setAutoScroll(false);
    }
  };

  const handleToggleConnection = () => {
    if (status === ConnectionState.CONNECTED || status === ConnectionState.CONNECTING) {
      disconnect();
    } else {
      connect();
    }
  };

  return (
    <div className="flex flex-col h-screen max-h-screen bg-slate-900 text-slate-50 overflow-hidden">
      {/* Header */}
      <header className="flex-none p-4 border-b border-slate-800 bg-slate-900/95 backdrop-blur z-10 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-red-600 rounded-lg flex items-center justify-center shadow-lg">
             <span className="text-xl font-bold text-white">D</span>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Deutsch Perfekt</h1>
            <p className="text-xs text-slate-400 font-medium tracking-wide">AI PRONUNCIATION TUTOR</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
           <div className={`h-2.5 w-2.5 rounded-full ${status === ConnectionState.CONNECTED ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-slate-600'}`}></div>
           <span className="text-xs font-mono text-slate-400 uppercase">{status}</span>
        </div>
      </header>

      {/* Main Content / Chat Area */}
      <main 
        className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 scrollbar-hide relative"
        onScroll={handleScroll}
      >
        {turns.length === 0 && status !== ConnectionState.CONNECTED && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-60">
            <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mb-6 text-slate-600">
               <MicIcon />
            </div>
            <h2 className="text-2xl font-light text-slate-300 mb-2">Ready to practice?</h2>
            <p className="text-slate-500 max-w-md">
              Start speaking German. The AI will analyze your speech in real-time and provide text feedback on grammar and pronunciation.
            </p>
          </div>
        )}

        {turns.map((turn, index) => (
          <TranscriptCard 
            key={turn.id} 
            turn={turn} 
            isCurrent={index === turns.length - 1 && !turn.isComplete}
          />
        ))}
        
        <div ref={bottomRef} className="h-4" />
      </main>

      {/* Footer / Controls */}
      <div className="flex-none bg-slate-900 border-t border-slate-800 p-6 z-20">
        <div className="max-w-3xl mx-auto w-full flex flex-col gap-4">
          
          {/* Visualizer */}
          <div className="w-full bg-slate-950/50 rounded-xl overflow-hidden border border-slate-800/50 h-20 flex items-center justify-center relative shadow-inner">
             <Visualizer 
               isActive={status === ConnectionState.CONNECTED} 
               analyser={audioAnalyser} 
             />
             {status === ConnectionState.CONNECTED && (
               <div className="absolute top-2 right-2 flex space-x-1">
                 <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-red-400 opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
               </div>
             )}
          </div>

          {/* Control Button */}
          <div className="flex justify-center">
            <button
              onClick={handleToggleConnection}
              disabled={status === ConnectionState.CONNECTING}
              className={`
                group relative flex items-center justify-center space-x-3 px-8 py-4 rounded-full font-semibold text-lg transition-all duration-300 shadow-xl
                ${status === ConnectionState.CONNECTED 
                  ? 'bg-red-500/10 text-red-500 border border-red-500/50 hover:bg-red-500 hover:text-white' 
                  : 'bg-white text-slate-900 hover:bg-amber-400 hover:scale-105 hover:shadow-amber-400/20'
                }
                ${status === ConnectionState.CONNECTING ? 'opacity-75 cursor-not-allowed' : ''}
              `}
            >
              {status === ConnectionState.CONNECTING ? (
                 <span className="flex items-center"><div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></div> Connecting...</span>
              ) : status === ConnectionState.CONNECTED ? (
                <>
                  <StopIcon />
                  <span>End Session</span>
                </>
              ) : (
                <>
                  <MicIcon />
                  <span>Start Speaking</span>
                </>
              )}
            </button>
          </div>
          
          <p className="text-center text-xs text-slate-500 mt-2">
            Using Gemini 2.5 Flash • Audio is processed in real-time
          </p>
        </div>
      </div>
    </div>
  );
};

export default App;