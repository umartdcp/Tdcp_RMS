import { useAuth } from "../context/AuthContext";
import { organizationDisplayName, organizationLogoUrl } from "../lib/orgBranding";

export default function OrganizationLogo({ size = 44, className = "", organization: orgProp }) {
  const ctx = useAuth() || {};
  const organization = orgProp || ctx.organization;
  const raw = organizationLogoUrl(organization);
  const src = raw && /tdcp-logo/i.test(raw) ? `${raw.split("?")[0]}?v=3` : raw;
  const name = organizationDisplayName(organization);
  const letter = String(name).trim().charAt(0).toUpperCase() || "R";

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className={`rounded-full bg-white object-contain ${className}`}
        onError={(e) => {
          e.currentTarget.replaceWith(Object.assign(document.createElement("div"), { className: e.currentTarget.className }));
        }}
      />
    );
  }

  return (
    <div
      className={`grid place-items-center rounded-full font-extrabold text-white ${className}`}
      style={{ width: size, height: size, background: organization?.primary_color || "var(--brand-primary, #0c553c)", fontSize: Math.max(14, size * 0.38) }}
      aria-label={name}
    >
      {letter}
    </div>
  );
}
