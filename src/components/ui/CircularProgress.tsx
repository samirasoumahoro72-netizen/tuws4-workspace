import React from 'react';
import { ProjectStatus } from '../../types/database';

interface CircularProgressProps {
  value: number; // 0 to 100
  size?: number; // width and height in px
  strokeWidth?: number;
  status?: ProjectStatus;
  color?: string; // Optional override e.g. '#0ea5e9' or Tailwind text color
  trackColor?: string;
  showValue?: boolean;
  className?: string;
  valueClassName?: string;
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  value,
  size = 48,
  strokeWidth = 4,
  status,
  color,
  trackColor = '#E2E8F0',
  showValue = true,
  className = '',
  valueClassName = '',
}) => {
  const clampedValue = Math.min(100, Math.max(0, value));

  // Determine stroke color based on status or value
  const getStrokeColor = () => {
    if (color) return color;
    if (status === 'DELAYED') return '#DC2626'; // red-600
    if (status === 'COMPLETED' || clampedValue >= 100) return '#059669'; // emerald-600
    if (clampedValue >= 75) return '#0284C7'; // sky-600
    if (clampedValue >= 40) return '#0F2942'; // brand-navy / primary
    return '#F97316'; // brand-orange
  };

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedValue / 100) * circumference;
  const strokeColor = getStrokeColor();

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90 transform"
      >
        {/* Background track circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        {/* Animated Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>

      {showValue && (
        <span
          className={`absolute font-headline font-bold text-center leading-none text-on-surface ${valueClassName}`}
          style={{
            fontSize: size <= 40 ? '10px' : size <= 52 ? '11px' : '13px',
            color: status === 'DELAYED' ? '#DC2626' : undefined,
          }}
        >
          {Math.round(clampedValue)}%
        </span>
      )}
    </div>
  );
};

export default CircularProgress;
