import { GAME_ICONS } from "@/components/ui/game-icon-data";
import type { GameIconName } from "@/lib/ui/game-icons";

/** game-icons.net ikonu, renk currentColor. */
export function GameIcon({ name, className, label }: { name: GameIconName; className?: string; label?: string }) {
  const body = GAME_ICONS[name] ?? GAME_ICONS["star-swirl"];
  return (
    <svg
      viewBox="0 0 512 512"
      className={className ? `game-icon ${className}` : "game-icon"}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      dangerouslySetInnerHTML={{ __html: body }}
    />
  );
}
