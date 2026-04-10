import type { SVGProps } from "react";

const emblemMap: Record<string, string> = {
  artificer: "M12 5 L14.5 7.5 L12 10 L9.5 7.5 Z M12 10 L16 14 L12 19 L8 14 Z M5 12 H9 M15 12 H19",
  barbarian: "M7 18 L10 6 L12 11 L14 6 L17 18 M9 14 H15",
  bard: "M12 5 C9.8 5 8.5 6.6 8.5 8.8 C8.5 11.2 10 12.7 12.1 12.7 C13 12.7 13.8 12.4 14.5 11.9 V16.2 C13.7 16.7 12.9 17.6 12.9 18.8 C12.9 20.1 11.8 21 10.3 21 C8.8 21 7.7 20.1 7.7 18.8 C7.7 17.3 9.1 16.2 10.9 16.2 V8.2 L16.8 6.7 V14.6",
  cleric: "M12 5 V19 M7 10 H17 M8.5 7.5 L15.5 14.5 M15.5 7.5 L8.5 14.5",
  druid: "M12 4 C8.2 6.8 6.4 10.2 6.4 13 C6.4 16.9 9.1 19.6 12 19.6 C14.9 19.6 17.6 16.9 17.6 13 C17.6 10.2 15.8 6.8 12 4 Z M10.1 12.2 C11.4 12.2 12.4 13.2 12.4 14.5 C12.4 15.6 11.7 16.5 10.7 16.9",
  fighter: "M12 4 L18.5 10.5 L16.8 12.2 L14.6 10 L12.2 12.4 L14.4 14.6 L12.7 16.3 L10.5 14.1 L6.5 18.1 L5 16.6 L9 12.6 L6.8 10.4 L8.5 8.7 L10.7 10.9 L13.1 8.5 L10.9 6.3 Z",
  monk: "M12 5 C9.2 5 7 7.2 7 10 C7 12.4 8.7 14.4 10.9 14.9 V18.8 M12 7.4 V18.8 M14.1 14.9 C16.3 14.4 18 12.4 18 10 C18 7.2 15.8 5 13 5",
  paladin: "M12 4 L18 6.4 V10.6 C18 14.6 15.3 17.9 12 19 C8.7 17.9 6 14.6 6 10.6 V6.4 Z M12 7.7 V15.8 M9 10.8 H15",
  ranger: "M6 18 L18 6 M8 6 H18 V16",
  rogue: "M12 4 L18 10 L12 20 L6 10 Z M12 9.3 L14.5 11.8 L12 16 L9.5 11.8 Z",
  sorcerer: "M12 4 C9.5 6.5 8.2 8.5 8.2 10.8 C8.2 13.8 10.2 15.8 12 15.8 C13.8 15.8 15.8 13.8 15.8 10.8 C15.8 8.5 14.5 6.5 12 4 Z M12 15.8 V20 M9.3 18 H14.7",
  warlock: "M12 4 L14.6 9.4 L20 10.2 L15.8 14.2 L16.8 20 L12 17.2 L7.2 20 L8.2 14.2 L4 10.2 L9.4 9.4 Z",
  wizard: "M12 4 L13.5 9 H19 L14.5 12.2 L16.2 18 L12 14.6 L7.8 18 L9.5 12.2 L5 9 H10.5 Z",
};

export function ClassEmblem({
  classId,
  className,
  ...props
}: SVGProps<SVGSVGElement> & { classId?: string; className?: string }) {
  const emblem = emblemMap[classId ?? "wizard"] ?? emblemMap.wizard;

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.55"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <circle cx="12" cy="12" r="9" opacity="0.14" />
      <path d={emblem} />
    </svg>
  );
}
