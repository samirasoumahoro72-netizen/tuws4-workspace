import React from 'react';

interface LogoProps {
  className?: string;
  variant?: 'default' | 'white';
  showSubtitle?: boolean;
}

export const BrandName: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span className={`inline-flex items-baseline font-headline font-bold text-slate-500 tracking-tight ${className}`}>
    <span>Tuwshi</span>
    <span className="relative inline-flex flex-col items-center justify-center mx-[1px]">
      <span className="text-[#008CE4] font-extrabold leading-none">u</span>
      <svg
        className="w-[11px] h-[5px] text-[#008CE4] -mt-[1px]"
        viewBox="0 0 16 6"
        fill="none"
      >
        <path
          d="M2 1.5C4.5 4.8 11.5 4.8 14 1.5"
          stroke="currentColor"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
      </svg>
    </span>
    <span>ah</span>
  </span>
);

export const Logo: React.FC<LogoProps> = ({
  className = 'h-9 w-auto',
  variant = 'default',
  showSubtitle = true,
}) => {
  const isWhite = variant === 'white';
  const greyColor = isWhite ? '#CBD5E1' : '#5C6672';
  const uColor = '#008CE4';
  const orangeColor = '#FF4D00';

  return (
    <div className={`inline-flex flex-col justify-center select-none ${className}`}>
      {/* Main Wordmark matching the company wall */}
      <div className="flex items-baseline font-headline font-bold text-[24px] leading-none tracking-tight">
        <span style={{ color: greyColor }}>Tuwshi</span>
        
        {/* The iconic Sky Blue 'u' with the smile arc underneath */}
        <span className="relative inline-flex flex-col items-center justify-center mx-[0.5px]">
          <span style={{ color: uColor }} className="font-extrabold leading-none">
            u
          </span>
          <svg
            className="w-[13px] h-[5.5px] -mt-[1px]"
            viewBox="0 0 16 6"
            fill="none"
          >
            <path
              d="M2 1.5C4.5 4.8 11.5 4.8 14 1.5"
              stroke={uColor}
              strokeWidth="2.8"
              strokeLinecap="round"
            />
          </svg>
        </span>

        <span style={{ color: greyColor }}>ah</span>
      </div>

      {/* Subtitle from the wall: AI & Digital Agency in vivid orange */}
      {showSubtitle && (
        <span
          className="font-headline font-bold text-[9.5px] tracking-wide mt-1.5 leading-none"
          style={{ color: orangeColor }}
        >
          AI &amp; Digital Agency
        </span>
      )}
    </div>
  );
};

export default Logo;
