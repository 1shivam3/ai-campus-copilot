export function CoursePilotMark({ className = "h-8 w-8", ...props }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="CoursePilot"
      {...props}
    >
      <rect width="32" height="32" rx="9" fill="#0f172a" />
      <path
        d="M19.5 8.5C14.25 8.5 10 12.75 10 18C10 23.25 14.25 27.5 19.5 27.5C22.2 27.5 24.6 26.37 26.3 24.55L22.8 21.6C21.9 22.5 20.7 23 19.5 23C16.74 23 14.5 20.76 14.5 18C14.5 15.24 16.74 13 19.5 13C20.7 13 21.9 13.5 22.8 14.4L26.3 11.45C24.6 9.63 22.2 8.5 19.5 8.5Z"
        fill="#3b82f6"
      />
      <path d="M19 6L26.5 13.5L22.5 15L17.5 10L19 6Z" fill="#60a5fa" />
      <circle cx="20" cy="18" r="2.5" fill="#38bdf8" />
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
    <div className={`flex items-center gap-3 ${className}`}>
      <CoursePilotMark className={`${iconSizes[size] || iconSizes.md} shrink-0 shadow-xs`} />
      <div>
        <div className="flex items-center tracking-tight font-extrabold leading-none">
          <span className={`${textSizes[size] || textSizes.md} text-slate-900`}>
            Course
          </span>
          <span className={`${textSizes[size] || textSizes.md} text-blue-600`}>
            Pilot
          </span>
        </div>
        {showTagline && (
          <p className="mt-1 text-xs text-slate-500 font-medium leading-snug">
            {tagline}
          </p>
        )}
      </div>
    </div>
  )
}

export default CoursePilotLogo
