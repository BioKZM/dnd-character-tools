import type { SVGProps } from "react";

type IconName =
  | "wand"
  | "scroll"
  | "class"
  | "species"
  | "background"
  | "level"
  | "multiclass"
  | "spark"
  | "book"
  | "feat"
  | "skill"
  | "shield"
  | "sword"
  | "search";

const iconMap: Record<IconName, string> = {
  wand: "M5 19 L19 5 M11 5 L13 7 M17 11 L19 13 M5 11 L7 13 M11 17 L13 19",
  scroll: "M7 5 H15 A3 3 0 0 1 18 8 V16 A3 3 0 0 1 15 19 H9 A3 3 0 0 1 6 16 V8 A3 3 0 0 1 9 5 Z M9 9 H15 M9 13 H14",
  class: "M6 18 V7.5 L12 5 L18 7.5 V18 M9 18 V13 H15 V18",
  species: "M12 5 C8 5 6 8 6 11 C6 15 9 19 12 19 C15 19 18 15 18 11 C18 8 16 5 12 5 Z M9.5 10.5 H9.51 M14.5 10.5 H14.51 M10 14 C10.8 14.6 11.4 14.9 12 14.9 C12.6 14.9 13.2 14.6 14 14",
  background: "M7 5 H17 V19 H7 Z M9 9 H15 M9 12 H15 M9 15 H13",
  level: "M12 5 L14.5 9.5 L19 12 L14.5 14.5 L12 19 L9.5 14.5 L5 12 L9.5 9.5 Z",
  multiclass: "M7 7 H13 V13 H7 Z M11 11 H17 V17 H11 Z",
  spark: "M12 4 L13.7 9.2 L19 11 L13.7 12.8 L12 18 L10.3 12.8 L5 11 L10.3 9.2 Z",
  book: "M6 6.5 A2.5 2.5 0 0 1 8.5 4 H18 V18 H8.5 A2.5 2.5 0 0 0 6 20 Z M6 6.5 A2.5 2.5 0 0 0 8.5 9 H18",
  feat: "M12 5 L13.8 8.8 L18 9.4 L15 12.2 L15.8 16.4 L12 14.3 L8.2 16.4 L9 12.2 L6 9.4 L10.2 8.8 Z",
  skill: "M6 17 L10 13 L13 16 L18 10 M18 10 V14 M18 10 H14",
  shield: "M12 4 L18 6.5 V11 C18 14.8 15.5 17.9 12 19 C8.5 17.9 6 14.8 6 11 V6.5 Z",
  sword: "M14 5 L19 10 L17 12 L15 10 L9 16 L7 16 L7 14 L13 8 L11 6 Z M6 18 H10",
  search: "M11 6 A5 5 0 1 1 10.99 6 M15.2 15.2 L19 19",
};

export function AppIcon({
  name,
  className,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path d={iconMap[name]} />
    </svg>
  );
}
