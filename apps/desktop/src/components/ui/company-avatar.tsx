import { cn } from "@/lib/utils";

// Muted, evenly spaced hues so a long list reads calm rather than rainbow.
const HUES = [262, 200, 160, 32, 330, 220, 120, 290] as const;

function hashCompany(name: string): number {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return hash;
}

function companyInitial(name: string): string {
  const letter = name.trim().match(/\p{L}|\p{N}/u)?.[0];
  return letter ? letter.toLocaleUpperCase() : "·";
}

export function CompanyAvatar({ className, name }: { className?: string; name: string }) {
  const hue = HUES[hashCompany(name) % HUES.length];
  return (
    <span
      aria-hidden="true"
      className={cn("company-avatar", className)}
      style={{ "--avatar-hue": hue } as React.CSSProperties}
    >
      {companyInitial(name)}
    </span>
  );
}
