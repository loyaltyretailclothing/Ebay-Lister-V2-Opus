// Stroke icons from the Claude Design export (1.7 stroke on a 24 viewBox).
// Each takes a className for sizing; colour comes from currentColor.

function Svg({ className = "size-[18px]", strokeWidth = 1.7, fill = "none", children, ...rest }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={fill === "none" ? "currentColor" : undefined}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const TagIcon = (p) => (
  <Svg {...p}>
    <path d="M13.4 3.5H20a.5.5 0 0 1 .5.5v6.6l-9.4 9.4a1.6 1.6 0 0 1-2.2 0l-5.4-5.4a1.6 1.6 0 0 1 0-2.2z" />
    <circle cx="16.7" cy="7.3" r="1.2" />
  </Svg>
);
export const CreateIcon = (p) => (
  <Svg {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
    <path d="M12 8.4v7.2M8.4 12h7.2" />
  </Svg>
);
export const ChartIcon = (p) => (
  <Svg {...p}>
    <path d="M4 20h16M6.5 16.5V11M11 16.5V6.5M15.5 16.5v-4M20 16.5V8.5" />
  </Svg>
);
export const SettingsIcon = (p) => (
  <Svg {...p}>
    <path d="M3.5 7.5h10M18.4 7.5h2.1M3.5 16.5h4.1M12.4 16.5h8.1" />
    <circle cx="15.9" cy="7.5" r="2.3" />
    <circle cx="9.9" cy="16.5" r="2.3" />
  </Svg>
);
export const LibraryIcon = (p) => (
  <Svg {...p}>
    <rect x="3.5" y="3.5" width="7.2" height="7.2" rx="1.6" />
    <rect x="13.3" y="3.5" width="7.2" height="7.2" rx="1.6" />
    <rect x="3.5" y="13.3" width="7.2" height="7.2" rx="1.6" />
    <rect x="13.3" y="13.3" width="7.2" height="7.2" rx="1.6" />
  </Svg>
);
export const DraftsIcon = (p) => (
  <Svg {...p}>
    <rect x="4.2" y="3.5" width="13.5" height="17" rx="2.4" />
    <path d="M7.6 8.4h6.7M7.6 12h6.7M7.6 15.6h3.6" />
  </Svg>
);
export const CameraIcon = (p) => (
  <Svg {...p}>
    <path d="M3.5 8.6h3.2L8.2 6.5h7.6l1.5 2.1h3.2a1 1 0 0 1 1 1v7.9a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V9.6a1 1 0 0 1 1-1z" />
    <circle cx="12" cy="13.4" r="3.2" />
  </Svg>
);
export const MoreIcon = ({ className = "size-[21px]" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="5.5" cy="12" r="1.8" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="18.5" cy="12" r="1.8" />
  </svg>
);
export const CheckIcon = (p) => (
  <Svg strokeWidth={2.4} {...p}>
    <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />
  </Svg>
);
export const CheckCircleIcon = (p) => (
  <Svg strokeWidth={2} {...p}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M8.2 12.2 11 15l4.8-5.4" />
  </Svg>
);
export const AlertIcon = (p) => (
  <Svg strokeWidth={2} {...p}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M12 7.6v5.2M12 16.2v.1" />
  </Svg>
);
export const XIcon = (p) => (
  <Svg strokeWidth={2.6} {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);
export const MicIcon = (p) => (
  <Svg strokeWidth={1.9} {...p}>
    <rect x="9" y="3.5" width="6" height="11" rx="3" />
    <path d="M5.8 11.5a6.2 6.2 0 0 0 12.4 0M12 17.7v2.8" />
  </Svg>
);
export const PlusIcon = (p) => (
  <Svg strokeWidth={2} {...p}>
    <path d="M12 6v12M6 12h12" />
  </Svg>
);
export const ChevronDownIcon = (p) => (
  <Svg strokeWidth={2} {...p}>
    <path d="M6 9.5 12 15.5 18 9.5" />
  </Svg>
);
export const ChevronLeftIcon = (p) => (
  <Svg strokeWidth={2} {...p}>
    <path d="M14.5 5.5 8 12l6.5 6.5" />
  </Svg>
);
export const ChevronRightIcon = (p) => (
  <Svg strokeWidth={2} {...p}>
    <path d="M9.5 5.5 16 12l-6.5 6.5" />
  </Svg>
);
export const RefreshIcon = (p) => (
  <Svg strokeWidth={2} {...p}>
    <path d="M20 12a8 8 0 1 1-2.3-5.6" />
    <path d="M20.5 4v4.4h-4.4" />
  </Svg>
);
export const TrashIcon = (p) => (
  <Svg strokeWidth={1.8} {...p}>
    <path d="M4.8 6.6h14.4" />
    <path d="M9.3 6.6V4.9h5.4v1.7" />
    <path d="M6.6 6.6 7.5 20h9l.9-13.4" />
    <path d="M10.4 10.2v6M13.6 10.2v6" />
  </Svg>
);
export const UploadIcon = (p) => (
  <Svg strokeWidth={1.9} {...p}>
    <path d="M12 16.5V4.2M7.4 8.8 12 4.2l4.6 4.6" />
    <path d="M4.5 15.5v3.2a1.3 1.3 0 0 0 1.3 1.3h12.4a1.3 1.3 0 0 0 1.3-1.3v-3.2" />
  </Svg>
);
export const SearchIcon = (p) => (
  <Svg strokeWidth={1.9} {...p}>
    <circle cx="11" cy="11" r="6.6" />
    <path d="M15.9 15.9 20.5 20.5" />
  </Svg>
);
export const AnalyzeIcon = (p) => (
  <Svg strokeWidth={1.8} {...p}>
    <path d="M12 3.2v4M12 16.8v4M3.2 12h4M16.8 12h4" />
    <circle cx="12" cy="12" r="3.4" />
  </Svg>
);
export const NoteIcon = (p) => (
  <Svg strokeWidth={2.2} {...p}>
    <path d="M5.5 7h13M5.5 12h13M5.5 17h8" />
  </Svg>
);
export const FolderIcon = (p) => (
  <Svg strokeWidth={1.8} {...p}>
    <path d="M3.5 6.5h6l1.6 2h9.4v9.5a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1z" />
  </Svg>
);
export const LockIcon = (p) => (
  <Svg strokeWidth={1.9} {...p}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
    <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" />
  </Svg>
);
export const StarIcon = ({ filled, className = "size-[18px]" }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth={1.7}
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" />
  </svg>
);
export const ExternalIcon = (p) => (
  <Svg strokeWidth={2} {...p}>
    <path d="M14 4.5h5.5V10" />
    <path d="M19.5 4.5 11 13" />
    <path d="M18.5 14v5.5h-14v-14H10" />
  </Svg>
);
export const CopyIcon = (p) => (
  <Svg strokeWidth={1.8} {...p}>
    <rect x="8.5" y="8.5" width="12" height="12" rx="2" />
    <path d="M15.5 5.5h-11a1 1 0 0 0-1 1v11" />
  </Svg>
);
export const FlipIcon = (p) => (
  <Svg strokeWidth={1.8} {...p}>
    <path d="M3.6 9.2a8.6 8.6 0 0 1 14.2-3.3l2.6 2.4" />
    <path d="M20.4 14.8a8.6 8.6 0 0 1-14.2 3.3l-2.6-2.4" />
    <path d="M20.5 3.6v4.7h-4.7M3.5 20.4v-4.7h4.7" />
  </Svg>
);
export const TorchIcon = ({ on, className = "size-5" }) => (
  <Svg strokeWidth={1.9} className={className}>
    <path d="M13.2 2.5 5.5 13.4h5.1l-.8 8.1 7.7-10.9h-5.1z" />
    {!on && <path d="M3.6 3.6 20.4 20.4" />}
  </Svg>
);
export const ShirtIcon = ({ className = "size-6" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="rgba(30,38,50,.32)" strokeWidth="1.4" strokeLinejoin="round" aria-hidden="true">
    <path d="M9.5 3.5 4.5 6.2 6 9.4l2-.9V20h8V8.5l2 .9 1.5-3.2-5-2.7a3 3 0 0 1-5 0z" />
  </svg>
);

export function Spinner({ className = "size-3.5" }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M12 3.6a8.4 8.4 0 1 1-5.9 2.5" />
    </svg>
  );
}
