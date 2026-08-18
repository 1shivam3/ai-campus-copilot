export function CoursePilotMark({ className = "h-8 w-8", ...props }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="CoursePilot Logo Mark"
      {...props}
    >
      <defs>
        {/* Cap Top Gradient - Deep Academic Forest/Teal */}
        <linearGradient id="logoCapTop" x1="15%" y1="10%" x2="85%" y2="90%">
          <stop offset="0%" stopColor="#115E59" />
          <stop offset="50%" stopColor="#0F766E" />
          <stop offset="100%" stopColor="#12312F" />
        </linearGradient>

        {/* Cap Highlight Edge - Emerald Light */}
        <linearGradient id="logoCapHighlight" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#2DD4BF" />
          <stop offset="100%" stopColor="#0F766E" />
        </linearGradient>

        {/* C-Ribbon Main Outer Arc Gradient - Emerald brand */}
        <linearGradient id="logoCRibbonMain" x1="20%" y1="15%" x2="80%" y2="85%">
          <stop offset="0%" stopColor="#14B8A6" />
          <stop offset="40%" stopColor="#0F766E" />
          <stop offset="85%" stopColor="#115E59" />
          <stop offset="100%" stopColor="#12312F" />
        </linearGradient>

        {/* C-Ribbon Top Fold / Under-Cap */}
        <linearGradient id="logoCFoldTop" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2DD4BF" />
          <stop offset="100%" stopColor="#0F766E" />
        </linearGradient>

        {/* C-Ribbon Bottom Return / Wing */}
        <linearGradient id="logoCFoldBottom" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0F766E" />
          <stop offset="100%" stopColor="#12312F" />
        </linearGradient>

        {/* Pilot Navigation Arrow - Restrained Gold Accent #C49A3A */}
        <linearGradient id="logoArrowLeft" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="40%" stopColor="#EAB308" />
          <stop offset="100%" stopColor="#C49A3A" />
        </linearGradient>
        
        <linearGradient id="logoArrowRight" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#C49A3A" />
          <stop offset="100%" stopColor="#92400E" />
        </linearGradient>
      </defs>

      {/* 1. The Dynamic C-Ribbon Body */}
      <g>
        {/* Outer Curved Back & Bottom Loop of 'C' */}
        <path
          d="M 50 25 C 32 25, 20 38, 20 54 C 20 70, 33 83, 50 83 C 58 83, 64 80, 68 76 L 57 69 C 54 71, 51 72, 48 72 C 38 72, 30 64, 30 54 C 30 43, 38 35, 49 35 C 57 35, 63 39, 67 44 L 76 36 C 70 29, 61 25, 50 25 Z"
          fill="url(#logoCRibbonMain)"
        />

        {/* Upper Top Arch Segment connecting to Cap */}
        <path
          d="M 33 46 C 36 36, 44 29, 54 29 C 63 29, 71 34, 76 41 L 66 48 C 63 43, 58 40, 53 40 C 46 40, 40 45, 37 51 Z"
          fill="url(#logoCFoldTop)"
        />

        {/* Bottom Return Wing / Fold of 'C' */}
        <path
          d="M 46 72 C 53 72, 60 69, 65 64 L 74 72 C 67 79, 58 83, 48 83 C 43 83, 38 82, 34 79 L 41 71 C 43 72, 44 72, 46 72 Z"
          fill="url(#logoCFoldBottom)"
        />
      </g>

      {/* 2. Academic Mortarboard / Graduation Cap */}
      <g>
        {/* Cap Diamond / Rhombus Top Surface */}
        <path
          d="M 50 8 L 83 23 L 50 38 L 17 23 Z"
          fill="url(#logoCapTop)"
        />

        {/* Cap Top Bevel Highlight */}
        <path
          d="M 50 8 L 83 23 L 79 24.5 L 50 11.5 L 21 24.5 L 17 23 Z"
          fill="url(#logoCapHighlight)"
          opacity="0.8"
        />

        {/* Cap Skull Base */}
        <path
          d="M 28 28 C 28 28, 38 37, 50 37 C 62 37, 72 28, 72 28 L 72 32 C 72 32, 62 41, 50 41 C 38 41, 28 32, 28 32 Z"
          fill="#12312F"
        />

        {/* Tassel String */}
        <path
          d="M 50 23 Q 70 24 74 34 L 75 44"
          stroke="#C49A3A"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
        {/* Tassel Button on Cap Center */}
        <circle cx="50" cy="23" r="2.2" fill="#C49A3A" />
        
        {/* Tassel Bell / Drop Shape */}
        <path
          d="M 73.5 43 L 76.5 43 L 78 52 C 78 53.5, 72 53.5, 72 52 Z"
          fill="#C49A3A"
        />
        <circle cx="75" cy="43.5" r="1.5" fill="#FDE68A" />
      </g>

      {/* 3. Pilot Compass Navigation Arrow (Restrained Gold Accent) */}
      <g>
        {/* Left Facet */}
        <path
          d="M 58 39 L 42 58 L 49 55 Z"
          fill="url(#logoArrowLeft)"
        />

        {/* Right Facet */}
        <path
          d="M 58 39 L 49 55 L 52 68 Z"
          fill="url(#logoArrowRight)"
        />
      </g>
    </svg>
  )
}

export function CoursePilotLogo({
  showTagline = false,
  tagline = "Your AI-powered academic co-pilot.",
  size = "md",
  className = "",
}) {
  const iconSizes = {
    sm: "h-7 w-7",
    md: "h-9 w-9",
    lg: "h-11 w-11",
  }

  const textSizes = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-2xl",
  }

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <CoursePilotMark className={`${iconSizes[size] || iconSizes.md} shrink-0`} />
      <div>
        <div className="flex items-center tracking-tight font-black leading-none">
          <span className={`${textSizes[size] || textSizes.md} text-[#12312F] dark:text-[#ECFDF5]`}>
            Course
          </span>
          <span className={`${textSizes[size] || textSizes.md} text-[#0F766E] dark:text-[#2DD4BF]`}>
            Pilot
          </span>
        </div>
        {showTagline && (
          <p className="mt-1 text-xs text-[#52525B] dark:text-[#A1A1AA] font-medium leading-snug">
            {tagline}
          </p>
        )}
      </div>
    </div>
  )
}

export default CoursePilotLogo
