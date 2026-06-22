export const CheckIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 32 32">
    <circle cx="16" cy="16" fill="none" r="12" stroke="currentColor" strokeWidth="3" />
    <path d="m10 16.5 4 4.2 8.2-10" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
  </svg>
)

export const AddIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 32 32">
    <circle cx="16" cy="16" fill="none" r="11" stroke="currentColor" strokeWidth="3" />
    <path d="M16 10v12M10 16h12" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
  </svg>
)

export const PlotIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 32 32">
    <path d="M6 24h20M8 23V7M11 20l5-6 4 3 6-8" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.7" />
    <circle cx="16" cy="14" fill="currentColor" r="1.7" />
    <circle cx="20" cy="17" fill="currentColor" r="1.7" />
    <circle cx="26" cy="9" fill="currentColor" r="1.7" />
  </svg>
)

export const ResetIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 32 32">
    <path d="M23.5 11.5A9 9 0 1 0 25 19" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
    <path d="M23.5 5.5v6h-6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
  </svg>
)

export const PrintIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 32 32">
    <path d="M10 12V6h12v6M10 22H7v-8h18v8h-3M10 18h12v8H10z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2.8" />
    <path d="M21 16h2" stroke="currentColor" strokeLinecap="round" strokeWidth="2.8" />
  </svg>
)

export const PdfIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 32 32">
    <path d="M9 4h10l5 5v19H9z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2.5" />
    <path d="M19 4v6h6" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2.5" />
    <path d="M8 17h16v8H8z" fill="currentColor" />
    <text
      fill="#fff"
      fontFamily="Arial, Helvetica, sans-serif"
      fontSize="6"
      fontWeight="900"
      x="10"
      y="23"
    >
      PDF
    </text>
  </svg>
)

export const FormulaIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 32 32">
    <defs>
      <linearGradient id="formula-page-gradient" x1="8" x2="24" y1="5" y2="28" gradientUnits="userSpaceOnUse">
        <stop stopColor="#fffaf0" />
        <stop offset="0.58" stopColor="#ffe8b5" />
        <stop offset="1" stopColor="#f0b85a" />
      </linearGradient>
      <linearGradient id="formula-fold-gradient" x1="20" x2="25" y1="5" y2="10" gradientUnits="userSpaceOnUse">
        <stop stopColor="#ffffff" />
        <stop offset="1" stopColor="#e7ba65" />
      </linearGradient>
    </defs>
    <path d="M8 27.5c2.6 1.2 13.3 1.2 16 0" fill="none" opacity="0.24" stroke="#22150d" strokeLinecap="round" strokeWidth="2.7" />
    <path d="M7.2 5h13.6L25 9.2v17.1c0 1-.8 1.8-1.8 1.8h-16c-1 0-1.8-.8-1.8-1.8V6.8c0-1 .8-1.8 1.8-1.8Z" fill="url(#formula-page-gradient)" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.85" />
    <path d="M20.8 5v3.7c0 .7.5 1.2 1.2 1.2H25Z" fill="url(#formula-fold-gradient)" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.45" />
    <path d="M10 12h6.6M10 24h12.3" fill="none" opacity="0.48" stroke="#8d642d" strokeLinecap="round" strokeWidth="1.35" />
    <path d="M10.4 22c2.5-3.8 2.9-8.7 1.2-11M9.4 15.4h5.8" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.85" />
    <path d="M17 14h5.8M17 18h5.8M18.2 12.4l3.4 7.1M21.6 12.4l-3.4 7.1" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.55" />
    <text fill="currentColor" fontFamily="Arial, Helvetica, sans-serif" fontSize="4.6" fontWeight="900" x="16.9" y="24">
      I1
    </text>
  </svg>
)

export const AutoConnectIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 32 32">
    <path d="M8 10h6M18 22h6M14 10c5.5 0 4.5 12 10 12M18 22c-5.5 0-4.5-12-10-12" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.6" />
    <circle cx="7" cy="10" fill="none" r="3" stroke="currentColor" strokeWidth="2.4" />
    <circle cx="25" cy="22" fill="none" r="3" stroke="currentColor" strokeWidth="2.4" />
    <path d="M23 5.5 24 8l2.5 1L24 10l-1 2.5L22 10l-2.5-1L22 8Z" fill="currentColor" />
  </svg>
)
export const AiGuide = () => (
  <svg aria-hidden="true" viewBox="0 0 32 32">
    <path d="M16 6v4M11 6h10M8 17H5M27 17h-3M8 22H5M27 22h-3" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.4" />
    <rect fill="none" height="16" rx="4" stroke="currentColor" strokeLinejoin="round" strokeWidth="2.5" width="18" x="7" y="11" />
    <circle cx="12.5" cy="18" fill="currentColor" r="1.7" />
    <circle cx="19.5" cy="18" fill="currentColor" r="1.7" />
    <path d="M13 23h6" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.3" />
    <path d="M25 4.5 26 7l2.5 1-2.5 1-1 2.5L24 9l-2.5-1L24 7Z" fill="currentColor" />
  </svg>
)

export const SlidersIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 32 32">
    <path d="M5 8h22M5 16h22M5 24h22" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.4" />
    <circle cx="12" cy="8" fill="#efe3d2" r="3.3" stroke="currentColor" strokeWidth="2" />
    <circle cx="20" cy="16" fill="#efe3d2" r="3.3" stroke="currentColor" strokeWidth="2" />
    <circle cx="15" cy="24" fill="#efe3d2" r="3.3" stroke="currentColor" strokeWidth="2" />
  </svg>
)

export const TableIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 32 32">
    <rect fill="none" height="22" rx="2" stroke="currentColor" strokeWidth="2.5" width="22" x="5" y="5" />
    <path d="M5 12h22M5 19h22M12 5v22M20 5v22" stroke="currentColor" strokeWidth="2.2" />
  </svg>
)

export const ActionButtonsIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 32 32">
    <circle cx="14.7" cy="8.7" fill="currentColor" r="6.7" />
    <path
      d="M12.4 8.4c0-1.3 1-2.4 2.3-2.4s2.3 1.1 2.3 2.4v8.1c.5-.6 1.2-1 2.1-1 .9 0 1.6.5 2 1.2.5-.5 1.1-.8 1.9-.8 1.3 0 2.4 1.1 2.4 2.5v8.2c0 .8-.2 1.5-.7 2.1l-1.1 1.5H12.2v-3.9l-3.1-3.4c-.6-.7-1-1.6-1-2.6v-3.7c0-.8.6-1.4 1.4-1.4.4 0 .8.2 1.1.5l1.8 2.2Z"
      fill="currentColor"
      stroke="#f4eadc"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
    />
  </svg>
)

export const ButtonIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 32 32">
    <rect fill="none" height="22" rx="3" stroke="currentColor" strokeWidth="2.4" width="18" x="7" y="5" />
    <path d="M11 11h10M11 16h10M11 21h6" stroke="currentColor" strokeLinecap="round" strokeWidth="2.4" />
  </svg>
)

export const CloseIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 32 32">
    <path d="M9 9l14 14M23 9 9 23" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
  </svg>
)

export const LightIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 32 32">
    <path d="M11 23h10M13 27h6M22 14a6 6 0 1 0-12 0c0 2.7 1.8 4.1 3 5.7.4.6.5 1.1.5 1.8h5c0-.7.1-1.2.5-1.8 1.2-1.6 3-3 3-5.7Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
    <path d="M16 2v3M5.5 6.2 7.6 8.3M26.5 6.2l-2.1 2.1" stroke="currentColor" strokeLinecap="round" strokeWidth="2.5" />
  </svg>
)
