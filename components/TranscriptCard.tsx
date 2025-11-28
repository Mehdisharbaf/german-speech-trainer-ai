import React from 'react';
import { Turn } from '../types';

interface TranscriptCardProps {
  turn: Turn;
  isCurrent?: boolean;
}

const TranscriptCard: React.FC<TranscriptCardProps> = ({ turn, isCurrent }) => {
  // Simple parser to format the structured feedback text if it matches the pattern
  const formatFeedback = (text: string) => {
    const sections = text.split('\n').filter(line => line.trim() !== '');
    
    // Check if it follows our strict format
    const isStructured = text.includes('Transcript:') && text.includes('Feedback:');

    if (!isStructured) {
      return <p className="text-slate-300 whitespace-pre-wrap">{text}</p>;
    }

    return sections.map((line, idx) => {
      if (line.startsWith('Transcript:')) {
        return null; // Don't show redundant transcript in feedback section
      }
      if (line.startsWith('Feedback:')) {
        return <h4 key={idx} className="text-amber-400 font-bold mt-2 mb-1 uppercase text-xs tracking-wider">Feedback</h4>;
      }
      if (line.includes('Error explanation')) {
         return <div key={idx} className="mb-1"><span className="text-red-400 font-semibold">Error:</span> <span className="text-slate-300">{line.replace(/-? ?Error explanation \(English\):/, '').trim()}</span></div>;
      }
      if (line.includes('Corrected version')) {
         return <div key={idx} className="mb-1"><span className="text-green-400 font-semibold">Correct:</span> <span className="text-slate-200">{line.replace(/-? ?Corrected version \(German\):/, '').trim()}</span></div>;
      }
      if (line.includes('Improved natural version')) {
         return <div key={idx} className="mb-1"><span className="text-blue-400 font-semibold">Native:</span> <span className="text-slate-200 italic">{line.replace(/-? ?Improved natural version \(German\):/, '').trim()}</span></div>;
      }
      return <p key={idx} className="text-slate-400 text-sm">{line}</p>;
    });
  };

  return (
    <div className={`mb-6 transition-all duration-500 ${isCurrent ? 'opacity-100' : 'opacity-80 hover:opacity-100'}`}>
      {/* User Bubble */}
      <div className="flex justify-end mb-2">
        <div className="bg-slate-700 text-white px-4 py-3 rounded-2xl rounded-tr-sm max-w-[85%] shadow-md border border-slate-600">
          <p className="font-medium font-serif leading-relaxed">
            {turn.userTranscript || <span className="italic text-slate-400">Listening...</span>}
          </p>
        </div>
      </div>

      {/* AI Feedback Bubble */}
      {(turn.modelResponse || isCurrent) && (
        <div className="flex justify-start">
          <div className={`bg-slate-800 border border-slate-700 text-white px-5 py-4 rounded-2xl rounded-tl-sm max-w-[90%] shadow-lg ${isCurrent && !turn.modelResponse ? 'animate-pulse' : ''}`}>
            {turn.modelResponse ? (
              <div className="text-sm font-light">
                 {formatFeedback(turn.modelResponse)}
              </div>
            ) : (
              <div className="flex items-center space-x-2 text-amber-500/70">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TranscriptCard;