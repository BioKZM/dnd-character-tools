import fs from "node:fs";
import path from "node:path";
import {
  classOptionCollectionSchema,
  classOptionGroupSchema,
  type ClassOptionCollection,
  type ClassOptionGroup,
} from "@/lib/content/class-options-schema";

const ROOT = path.join(process.cwd(), "data", "classes");

function readOptionFile(relativePath: string): ClassOptionGroup | null {
  const absolutePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  return classOptionGroupSchema.parse(JSON.parse(fs.readFileSync(absolutePath, "utf-8")));
}

export function readClassOptionCollection(): ClassOptionCollection {
  return classOptionCollectionSchema.parse({
    warlock: {
      pactBoon: readOptionFile(path.join("warlock", "options", "pact-boon.json")),
      eldritchInvocations: readOptionFile(path.join("warlock", "options", "eldritch-invocations.json")),
    },
    fighter: {
      fightingStyle: readOptionFile(path.join("fighter", "options", "fighting-style.json")),
      battleMasterManeuvers: readOptionFile(path.join("fighter", "options", "battle-master-maneuvers.json")),
    },
  });
}
