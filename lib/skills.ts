import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { zipSync, type Zippable } from "fflate";

/**
 * WorkBuddy skills that accountants and SME consultants can import into their own
 * WorkBuddy. Each skill lives in workbuddy/skills/<id>/ with SKILL.md at its root
 * (generated inside WorkBuddy, see workbuddy/skills/README.md). A skill shows up as
 * downloadable as soon as its folder has a SKILL.md.
 */

export const SKILLS = [
  {
    id: "sme-classifier",
    title: "SME classifier",
    blurb: "Official SME Corp Malaysia category (2024 definition) from annual sales and full-time employees.",
    input: "Sector, annual sales, employees",
    icon: "tag",
  },
  {
    id: "financial-analyzer",
    title: "Financial analyzer",
    blurb: "Monthly profit and loss, costs by category, margin, and duplicate invoices removed.",
    input: "Sales and purchases",
    icon: "calculator",
  },
  {
    id: "supplier-price-tracker",
    title: "Supplier price tracker",
    blurb: "Flags supplier price rises above 5% and what they cost you each month.",
    input: "Purchases with unit prices",
    icon: "search",
  },
  {
    id: "funding-matcher",
    title: "Funding matcher",
    blurb: "The top five funding programmes a business qualifies for in its market, with official links.",
    input: "Business profile",
    icon: "landmark",
  },
  {
    id: "brief-writer",
    title: "Brief writer",
    blurb: "Turns the results into a branded one-page CFO brief PDF.",
    input: "BizDecide result JSON",
    icon: "clipboard",
  },
] as const;

export type SkillId = (typeof SKILLS)[number]["id"];

/** WorkBuddy rejects skill packages above this size. */
export const MAX_ZIP_BYTES = 10 * 1024 * 1024;

const ROOT = path.join(process.cwd(), "workbuddy", "skills");
const SKIP = new Set([".DS_Store", "node_modules", "__pycache__", ".git"]);

export const isSkillId = (id: string): id is SkillId => SKILLS.some((s) => s.id === id);

export interface SkillMeta {
  name?: string;
  description?: string;
  version?: string;
}

/** Reads the simple `key: value` YAML frontmatter at the top of SKILL.md. */
function frontmatter(md: string): SkillMeta {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const meta: Record<string, string> = {};
  for (const line of m[1]!.split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (kv) meta[kv[1]!] = kv[2]!.trim().replace(/^["']|["']$/g, "");
  }
  return { name: meta.name, description: meta.description, version: meta.version };
}

/** Metadata for a packaged skill, or null if its folder has no SKILL.md yet. */
export async function readSkill(id: SkillId): Promise<SkillMeta | null> {
  try {
    return frontmatter(await readFile(path.join(ROOT, id, "SKILL.md"), "utf8"));
  } catch {
    return null;
  }
}

async function collect(dir: string, prefix: string, out: Zippable) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name) || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) await collect(full, rel, out);
    else if (entry.isFile() && (await stat(full)).size > 0) out[rel] = new Uint8Array(await readFile(full));
  }
}

/** Zips workbuddy/skills/<id>/ with SKILL.md at the root, ready for WorkBuddy's Import. */
export async function packSkill(id: SkillId): Promise<{ zip: Uint8Array; fileName: string } | null> {
  const meta = await readSkill(id);
  if (!meta) return null;
  const files: Zippable = {};
  await collect(path.join(ROOT, id), "", files);
  const zip = zipSync(files, { level: 9 });
  return { zip, fileName: `${id}${meta.version ? `-${meta.version}` : ""}.zip` };
}
