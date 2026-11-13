// Data denetimi: `npm run audit:data`
// - Her grant tipinin motorda (src/lib/engine/derive.ts) bir handler'i var mi
// - featId / spellId / pactBoon / subclass referanslari gercekten var mi
// Sema (zod) dogrulamasi zaten build sirasinda yapiliyor; bu script referanslari ve kapsami kontrol eder.
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), "utf-8"));
const errors = [];
const warnings = [];

const deriveSource = fs.readFileSync(path.join(root, "src/lib/engine/derive.ts"), "utf-8");
const handledBlock = deriveSource.match(/HANDLED_GRANT_TYPES[^=]*=\s*\[([\s\S]*?)\]/);
const handled = new Set((handledBlock?.[1] ?? "").match(/"([a-z_]+)"/g)?.map((value) => value.slice(1, -1)) ?? []);
if (!handled.size) {
  errors.push("HANDLED_GRANT_TYPES derive.ts icinde bulunamadi");
}

const spellIds = new Set(read("data/spells/catalog.json").entries.map((entry) => entry.id));
const featIds = new Set(read("data/feats.json").map((entry) => entry.id));
const slug = (value) => value.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const counts = { files: 0, grants: 0 };

function checkGrants(grants, where) {
  for (const grant of grants ?? []) {
    counts.grants += 1;
    if (!handled.has(grant.type)) {
      errors.push(`${where}: '${grant.type}' grant tipinin motorda handler'i yok`);
    }
    if (grant.type === "spell" && !spellIds.has(grant.spellId)) {
      errors.push(`${where}: bilinmeyen spellId '${grant.spellId}'`);
    }
    if (grant.type === "feat" && !featIds.has(grant.featId)) {
      errors.push(`${where}: bilinmeyen featId '${grant.featId}'`);
    }
  }
}

function walkFiles(directory) {
  return fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(relative) : relative.endsWith(".json") ? [relative] : [];
  });
}

// Classes, subclasses, options
for (const classId of fs.readdirSync(path.join(root, "data/classes"))) {
  const base = `data/classes/${classId}`;
  if (!fs.existsSync(path.join(root, base, "data.json"))) continue;
  const entry = read(`${base}/data.json`);
  counts.files += 1;
  if (!entry.savingThrows?.length) errors.push(`${base}/data.json: savingThrows bos`);
  if (!entry.primaryAbilities?.length) errors.push(`${base}/data.json: primaryAbilities bos`);
  checkGrants(entry.startingGrants, `${base}/data.json startingGrants`);
  for (const feature of entry.classFeatures ?? []) {
    if (!feature.unlockLevel) warnings.push(`${base}/data.json: '${feature.id}' icin unlockLevel yok`);
    checkGrants(feature.grants, `${base}/data.json ${feature.id}`);
  }
  const missingSubclasses = (entry.subclasses ?? []).filter((id) => !fs.existsSync(path.join(root, base, "subclasses", `${id}.json`)));
  if (missingSubclasses.length) {
    warnings.push(`${base}: listelenen ama dosyasi olmayan subclass'lar (creator'da gorunmez): ${missingSubclasses.join(", ")}`);
  }
  for (const file of fs.existsSync(path.join(root, base, "subclasses")) ? fs.readdirSync(path.join(root, base, "subclasses")) : []) {
    const subclass = read(`${base}/subclasses/${file}`);
    counts.files += 1;
    for (const feature of subclass.features ?? []) checkGrants(feature.grants, `${base}/subclasses/${file} ${feature.id}`);
    for (const group of subclass.expandedSpells ?? []) {
      for (const name of group.spells) {
        if (!spellIds.has(slug(name))) errors.push(`${base}/subclasses/${file}: expanded spell '${name}' katalogda yok`);
      }
    }
  }
  for (const file of fs.existsSync(path.join(root, base, "options")) ? fs.readdirSync(path.join(root, base, "options")) : []) {
    const group = read(`${base}/options/${file}`);
    counts.files += 1;
    for (const option of group.options ?? []) {
      checkGrants(option.grants, `${base}/options/${file} ${option.id}`);
      if (option.prerequisite?.spellId && !spellIds.has(option.prerequisite.spellId)) {
        errors.push(`${base}/options/${file} ${option.id}: on kosul buyusu '${option.prerequisite.spellId}' yok`);
      }
    }
  }
}

// Pact boon referanslari
const pactBoons = new Set(read("data/classes/warlock/options/pact-boon.json").options.map((option) => option.id));
for (const option of read("data/classes/warlock/options/eldritch-invocations.json").options) {
  if (option.prerequisite?.pactBoon && !pactBoons.has(option.prerequisite.pactBoon)) {
    errors.push(`eldritch-invocations ${option.id}: bilinmeyen pact boon '${option.prerequisite.pactBoon}'`);
  }
}

// Feats & backgrounds
for (const feat of read("data/feats.json")) checkGrants(feat.grants, `data/feats.json ${feat.id}`);
for (const background of read("data/backgrounds.json")) checkGrants(background.grants, `data/backgrounds.json ${background.id}`);
counts.files += 2;

// Lineage'lar (eski format; adapter ile cevriliyor)
for (const file of walkFiles("data/lineages")) {
  counts.files += 1;
  const lineage = read(file);
  const spells = JSON.stringify(lineage).match(/"spellName":\s*"([^"]+)"/g) ?? [];
  for (const match of spells) {
    const name = match.split(":")[1].trim().replace(/"/g, "");
    if (!spellIds.has(slug(name))) errors.push(`${file}: lineage buyusu '${name}' katalogda yok`);
  }
}

const withoutGrants = read("data/feats.json").filter((feat) => !feat.grants?.length && !feat.choices?.length).length;
console.log(`audit:data -> ${counts.files} dosya, ${counts.grants} grant, ${handled.size} handler`);
console.log(`  bilgi: ${withoutGrants} feat henuz grant'siz (sadece metin olarak gorunur)`);
warnings.forEach((message) => console.log(`  uyari: ${message}`));
errors.forEach((message) => console.error(`  HATA: ${message}`));
if (errors.length) {
  process.exit(1);
}
