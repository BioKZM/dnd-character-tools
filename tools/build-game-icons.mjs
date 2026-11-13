// game-icons.net (CC BY 3.0) ikonlarindan sadece kullanilanlari src/components/ui/game-icon-data.ts dosyasina yazar.
// Kullanim: node tools/build-game-icons.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const set = require("@iconify-json/game-icons/icons.json");
const sources = ["src/lib/ui/game-icons.ts", "src/lib/content/item-info.ts"];
const names = new Set(["star-swirl", "padlock", "check-mark"]);
for (const file of sources) {
  for (const match of readFileSync(file, "utf8").matchAll(/"([a-z0-9-]+)"/g)) {
    if (set.icons[match[1]]) {
      names.add(match[1]);
    }
  }
}
const lines = [...names].sort().map((name) => `  ${JSON.stringify(name)}: ${JSON.stringify(set.icons[name].body)},`);
writeFileSync(
  "src/components/ui/game-icon-data.ts",
  `// Uretildi: node tools/build-game-icons.mjs. Elle duzenleme.\n// Ikonlar: game-icons.net, CC BY 3.0 (Lorc, Delapouite ve digerleri).\nexport const GAME_ICONS = {\n${lines.join("\n")}\n} as const;\n`,
);
console.log(`${names.size} icons written`);
