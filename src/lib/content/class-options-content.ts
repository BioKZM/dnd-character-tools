import fs from "node:fs";
import path from "node:path";
import {
  warlockOptionCollectionSchema,
  warlockOptionGroupSchema,
  type WarlockOptionCollection,
  type WarlockOptionGroup,
} from "@/lib/content/class-options-schema";

const ROOT = path.join(process.cwd(), "content", "class-options-curated", "warlock");

function readOptionFile(relativePath: string): WarlockOptionGroup | null {
  const absolutePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  return warlockOptionGroupSchema.parse(JSON.parse(fs.readFileSync(absolutePath, "utf-8")));
}

export function readWarlockOptionCollection(): WarlockOptionCollection {
  return warlockOptionCollectionSchema.parse({
    pactBoon: readOptionFile(path.join("pact-boon", "data.json")),
    eldritchInvocations: readOptionFile(path.join("eldritch-invocations", "data.json")),
  });
}
