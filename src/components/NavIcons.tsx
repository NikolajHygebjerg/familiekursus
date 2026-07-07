import type { ReactNode } from "react";

type NavIconName =
  | "program"
  | "meetUs"
  | "songs"
  | "myWorkshops"
  | "workshops"
  | "register"
  | "race";

const ICONS: Record<NavIconName, ReactNode> = {
  program: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8 3v4M16 3v4M4 10h16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </>
  ),
  meetUs: (
    <>
      <circle cx="9" cy="8" r="2.25" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="15" cy="8" r="2.25" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M5.5 18c.6-2 1.8-3 3.5-3s2.9 1 3.5 3M12.5 18c.6-2 1.8-3 3.5-3s2.9 1 3.5 3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </>
  ),
  songs: (
    <>
      <path
        d="M12 4v12.5M12 4l5 2.5M12 16.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  myWorkshops: (
    <>
      <path
        d="M6 12.5 10 16l8-9"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.75" />
    </>
  ),
  workshops: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
    </>
  ),
  register: (
    <>
      <path
        d="M6 4h12v16H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </>
  ),
  race: (
    <>
      <circle cx="14" cy="6" r="2" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M6 20l3.5-7 3 2 2.5-5 3.5 3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
};

export default function NavIcon({
  name,
  className = "h-6 w-6",
}: {
  name: NavIconName;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {ICONS[name]}
    </svg>
  );
}

export type { NavIconName };
