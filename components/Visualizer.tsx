import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  isActive: boolean;
  analyser?: AnalyserNode;
}

const Visualizer: React.FC<VisualizerProps> = ({ isActive, analyser }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyser || !isActive) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      // Draw mirrored visualization
      const centerX = canvas.width / 2;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * (canvas.height * 0.8);

        // Dynamic color based on height
        const r = barHeight + 25 * (i / bufferLength);
        const g = 250 * (i / bufferLength);
        const b = 50;

        ctx.fillStyle = `rgb(245, 158, 11)`; // Amber-500 equivalent usually, but hardcoded nicely here
        ctx.fillStyle = `rgba(251, 191, 36, ${Math.min(1, barHeight / 50 + 0.2)})`; // Amber-400

        // Draw right side
        ctx.fillRect(centerX + x, (canvas.height - barHeight) / 2, barWidth, barHeight);
        // Draw left side
        ctx.fillRect(centerX - x - barWidth, (canvas.height - barHeight) / 2, barWidth, barHeight);

        x += barWidth + 1;
        if (x > centerX) break;
      }
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, analyser]);

  if (!isActive) {
    return (
      <div className="h-16 w-full flex items-center justify-center opacity-30">
        <div className="w-16 h-1 bg-slate-500 rounded-full"></div>
      </div>
    );
  }

  return (
    <canvas 
      ref={canvasRef} 
      width={300} 
      height={64} 
      className="w-full h-16 rounded-lg"
    />
  );
};

export default Visualizer;