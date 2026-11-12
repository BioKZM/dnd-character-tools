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
  | "search"
  | "dice"
  | "leaf"
  | "person"
  | "paw"
  | "heart"
  | "feather"
  | "eye"
  | "flame"
  | "snowflake"
  | "bolt"
  | "droplet"
  | "skull"
  | "sun"
  | "arrow-up"
  | "arrow-down";

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
  leaf: "M6 18 C6 10 11 5 19 5 C19 13 14 18 6 18 Z M6 18 L13 11",
  person: "M12 4 A3 3 0 1 1 11.99 4 M6 20 C6 15.5 8.7 12.5 12 12.5 C15.3 12.5 18 15.5 18 20",
  paw: "M8.5 7.5 A1.5 1.8 0 1 1 8.49 7.5 M15.5 7.5 A1.5 1.8 0 1 1 15.49 7.5 M5.2 11.5 A1.4 1.6 0 1 1 5.19 11.5 M18.8 11.5 A1.4 1.6 0 1 1 18.79 11.5 M12 12.5 C9 12.5 7.5 15.5 8.5 17.5 C9.5 19 14.5 19 15.5 17.5 C16.5 15.5 15 12.5 12 12.5 Z",
  heart: "M12 19 C7 15.5 4.5 12.8 4.5 9.6 C4.5 7.3 6.3 5.5 8.5 5.5 C10 5.5 11.3 6.3 12 7.6 C12.7 6.3 14 5.5 15.5 5.5 C17.7 5.5 19.5 7.3 19.5 9.6 C19.5 12.8 17 15.5 12 19 Z",
  feather: "M19 5 C12 5 7 10 7 17 L5 19 M7 17 C13 17 17 13 19 5 M9 15 L14 10 M10 12 H14",
  eye: "M3.5 12 C5.5 8 8.5 6 12 6 C15.5 6 18.5 8 20.5 12 C18.5 16 15.5 18 12 18 C8.5 18 5.5 16 3.5 12 Z M12 9.5 A2.5 2.5 0 1 1 11.99 9.5",
  flame: "M12 20 C8.7 20 6.5 17.8 6.5 14.8 C6.5 11.5 9.5 9.8 10 6 C12.5 7.5 13.5 10 13.2 12 C14.2 11.4 14.8 10.4 15 9.2 C16.6 10.8 17.5 12.7 17.5 14.8 C17.5 17.8 15.3 20 12 20 Z",
  snowflake: "M12 4 V20 M5.1 8 L18.9 16 M5.1 16 L18.9 8 M10 5.5 L12 7 L14 5.5 M10 18.5 L12 17 L14 18.5",
  bolt: "M13 3.5 L6.5 13 H11.5 L10.5 20.5 L17.5 10.5 H12.5 Z",
  droplet: "M12 4.5 C12 4.5 6.5 10.5 6.5 14.2 C6.5 17.4 9 19.5 12 19.5 C15 19.5 17.5 17.4 17.5 14.2 C17.5 10.5 12 4.5 12 4.5 Z",
  skull: "M12 4.5 C8 4.5 5.5 7.3 5.5 10.6 C5.5 12.8 6.6 14.4 8 15.2 V18 H16 V15.2 C17.4 14.4 18.5 12.8 18.5 10.6 C18.5 7.3 16 4.5 12 4.5 Z M9.5 11 H9.51 M14.5 11 H14.51 M11 18 V16 M13 18 V16",
  sun: "M12 8.5 A3.5 3.5 0 1 1 11.99 8.5 M12 3.5 V5.5 M12 18.5 V20.5 M3.5 12 H5.5 M18.5 12 H20.5 M6 6 L7.4 7.4 M16.6 16.6 L18 18 M6 18 L7.4 16.6 M16.6 7.4 L18 6",
  "arrow-up": "M12 19 V5 M6.5 10.5 L12 5 L17.5 10.5",
  "arrow-down": "M12 5 V19 M6.5 13.5 L12 19 L17.5 13.5",
  dice: "M8 5 H16 L19 8 V16 L16 19 H8 L5 16 V8 Z M9 9 H9.01 M15 9 H15.01 M9 15 H9.01 M15 15 H15.01 M12 12 H12.01",
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
