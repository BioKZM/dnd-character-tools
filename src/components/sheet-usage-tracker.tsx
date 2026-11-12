"use client";

/** Kullanim kutucuklari: dolu = harcanmis. Bir kutuya tiklamak o kutuya kadar harcar / geri verir. */
export function UsageDots({
  total,
  used,
  label,
  onChange,
}: {
  total: number;
  used: number;
  label: string;
  onChange: (nextUsed: number) => void;
}) {
  return (
    <span className="usage-dots" role="group" aria-label={`${label}: ${total - used} of ${total} left`}>
      {Array.from({ length: total }, (_, index) => {
        const spent = index < used;
        return (
          <button
            key={`${label}-${index}`}
            type="button"
            className={spent ? "usage-dot spent" : "usage-dot"}
            aria-pressed={spent}
            aria-label={`${label} ${index + 1}${spent ? " (used)" : ""}`}
            onClick={() => onChange(spent ? index : index + 1)}
          />
        );
      })}
    </span>
  );
}
