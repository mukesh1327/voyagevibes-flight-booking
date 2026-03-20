import type { ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const createIcon = (path: ReactNode) => {
  function Icon(props: IconProps) {
    return (
      <svg
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
        {...props}
      >
        {path}
      </svg>
    );
  }

  return Icon;
};

export const PlaneIcon = createIcon(
  <>
    <path d="M2 16.5 22 12 2 7.5l3 4.5-3 4.5Z" />
    <path d="M8 12h14" />
  </>
);

export const LocationIcon = createIcon(
  <>
    <path d="M12 21s6-4.4 6-10a6 6 0 1 0-12 0c0 5.6 6 10 6 10Z" />
    <circle cx="12" cy="11" r="2.5" />
  </>
);

export const CalendarIcon = createIcon(
  <>
    <path d="M7 3v4M17 3v4M4 9h16" />
    <rect x="4" y="5" width="16" height="16" rx="3" />
  </>
);

export const PassengerIcon = createIcon(
  <>
    <circle cx="12" cy="8" r="3.2" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </>
);

export const CreditCardIcon = createIcon(
  <>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="M3 10h18M7 15h4" />
  </>
);

export const TicketIcon = createIcon(
  <>
    <path d="M4 8.5A2.5 2.5 0 0 0 6.5 6H18v4a2 2 0 1 1 0 4v4H6.5A2.5 2.5 0 0 0 4 15.5v-7Z" />
    <path d="M10 6v12" />
  </>
);

export const MoonIcon = createIcon(
  <path d="M20 14.5A7.5 7.5 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5Z" />
);

export const SunIcon = createIcon(
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
  </>
);

export const SparklesIcon = createIcon(
  <>
    <path d="m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Z" />
    <path d="m5 16 .8 2.2L8 19l-2.2.8L5 22l-.8-2.2L2 19l2.2-.8L5 16Z" />
    <path d="m19 14 .6 1.6L21 16l-1.4.4L19 18l-.6-1.6L17 16l1.4-.4L19 14Z" />
  </>
);
