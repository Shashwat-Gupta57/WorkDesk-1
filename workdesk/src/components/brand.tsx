// ─────────────────────────────────────────────────────────────────────────────
// Flex Studios brand mark + wordmark.
//
// Logo: an "F.S" monogram on a rounded accent tile. Pure SVG/CSS — no asset files.
// Use <Logo /> for the tile alone, or <Brand /> for tile + wordmark.
// ─────────────────────────────────────────────────────────────────────────────

export const COMPANY_NAME = "Flex Studios";
export const PRODUCT_NAME = "WorkDesk";

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      role="img"
      aria-label="Flex Studios"
      className="shrink-0"
    >
      <defs>
        <linearGradient id="fs-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#58A6FF" />
          <stop offset="100%" stopColor="#1F6FEB" />
        </linearGradient>
      </defs>
      {/* Rounded tile */}
      <rect x="0" y="0" width="40" height="40" rx="9" fill="url(#fs-grad)" />
      {/* "F" */}
      <path
        d="M11 11h9v3.2h-5.4v3.1H19v3.1h-4.4V29H11V11Z"
        fill="#0D1117"
      />
      {/* dot separator */}
      <circle cx="22.2" cy="27.2" r="1.7" fill="#0D1117" />
      {/* "S" */}
      <path
        d="M31.4 14.2c-1-.8-2.2-1.3-3.6-1.3-2.6 0-4.4 1.5-4.4 3.7 0 2 1.3 2.9 3.4 3.6 1.6.5 2.1.9 2.1 1.6 0 .7-.6 1.1-1.6 1.1-1.2 0-2.3-.5-3.2-1.4l-1.7 2.4c1.2 1.1 2.9 1.8 4.8 1.8 2.8 0 4.7-1.5 4.7-3.9 0-2.1-1.4-3-3.6-3.7-1.5-.5-1.9-.8-1.9-1.4 0-.6.5-1 1.4-1 1 0 1.9.4 2.7 1.1l1.5-2.5Z"
        fill="#0D1117"
      />
    </svg>
  );
}

export function Brand({ size = 40 }: { size?: number }) {
  return (
    <div className="flex items-center gap-3">
      <Logo size={size} />
      <div className="leading-tight">
        <p className="text-base font-semibold text-text-primary">{PRODUCT_NAME}</p>
        <p className="text-xs text-text-secondary">{COMPANY_NAME}</p>
      </div>
    </div>
  );
}
