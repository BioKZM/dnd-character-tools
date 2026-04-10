import fs from "node:fs";
import path from "node:path";
import { creatorOptionsSchema, type CreatorOptions } from "@/lib/content/creator-options";
import { contentBundleSchema, type ContentBundle } from "@/lib/content/schema";

function readJsonFile<T>(relativePath: string): T {
  const absolutePath = path.join(process.cwd(), "content", "normalized", relativePath);
  return JSON.parse(fs.readFileSync(absolutePath, "utf-8")) as T;
}

export function readNormalizedContent(): ContentBundle {
  const bundle = {
    sourceBooks: readJsonFile("source-books.json"),
    classes: readJsonFile("classes.json"),
    species: readJsonFile("species.json"),
    backgrounds: readJsonFile("backgrounds.json"),
    feats: readJsonFile("feats.json"),
    spells: readJsonFile("spells.json"),
  };

  return contentBundleSchema.parse(bundle);
}

export function readCreatorOptions(): CreatorOptions {
  return creatorOptionsSchema.parse(readJsonFile("creator-options.json"));
}
