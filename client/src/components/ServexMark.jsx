export default function ServexMark({ size = 40, className = "", wordmark = true, inverted = false, caption = false }) {
  return (
    <div className={`flex gap-2.5 ${caption ? "items-start" : "items-center"} ${className}`}>
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={`shrink-0 ${caption ? "mt-0.5" : ""}`}>
        <g fill="#FF7A1A">
          <circle cx="16" cy="40" r="15" />
          <circle cx="33" cy="29" r="17" />
          <circle cx="50" cy="40" r="13" />
          <rect x="5" y="36" width="55" height="18" rx="9" />
        </g>
        <path fill="#fff" d="M33 17.2c-3.3 0-6 2.2-6.6 5.1-2.6.7-4.5 3-4.5 5.8 0 .4.04.75.1 1.1-2.1 1.1-3.5 3.3-3.5 5.7V37h29v-2.1c0-2.4-1.4-4.6-3.5-5.7.06-.35.1-.7.1-1.1 0-2.8-1.9-5.1-4.5-5.8-.6-2.9-3.3-5.1-6.6-5.1Z" />
        <path fill="#fff" d="M19.6 37.1h26.8c1.45 0 2.4 1.2 2.05 2.55l-1 4c-.5 1.85-2.15 3.15-4.05 3.15H22.6c-1.9 0-3.55-1.3-4.05-3.15l-1-4c-.35-1.35.6-2.55 2.05-2.55Z" />
        <path stroke="#FFC999" strokeWidth="1.2" strokeLinecap="round" d="M29 25.2v8.2M33 23.2v11M37 25.2v8.2" />
      </svg>
      {wordmark ? (
        <span className="flex min-w-0 flex-col">
          <span
            className="font-extrabold tracking-tight"
            style={{ fontSize: Math.max(16, size * 0.46), lineHeight: 1 }}
          >
            <span className={inverted ? "text-white" : "text-[#1B2A4A]"}>KitchenIQ</span>
            <span className="text-[#FF7A1A]">.cloud</span>
          </span>
          {caption ? (
            <span className="mt-1.5 text-[10px] font-semibold tracking-[0.14em] text-slate-400">
              RESTAURANT MANAGEMENT SYSTEM
            </span>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}
