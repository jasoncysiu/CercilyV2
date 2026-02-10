'use client';

interface CircularProgressProps {
  size?: number;
  strokeWidth?: number;
  text?: string;
  subtext?: string;
}

export default function CircularProgress({
  size = 60,
  strokeWidth = 4,
  text,
  subtext,
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const center = size / 2;

  return (
    <div className="circular-progress-container">
      <div className="circular-progress" style={{ width: size, height: size }}>
        {/* Background circle */}
        <svg width={size} height={size} className="circular-progress-svg">
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--border-primary)"
            strokeWidth={strokeWidth}
          />
          {/* Animated arc */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * 0.75}
            className="circular-progress-arc"
          />
        </svg>
        {/* Center dot that pulses */}
        <div className="circular-progress-center" />
      </div>
      {(text || subtext) && (
        <div className="circular-progress-text">
          {text && <span className="circular-progress-label">{text}</span>}
          {subtext && <span className="circular-progress-sublabel">{subtext}</span>}
        </div>
      )}
    </div>
  );
}
