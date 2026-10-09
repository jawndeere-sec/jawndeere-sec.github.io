import fs from "node:fs";
import path from "node:path";

export const technicalCabinetRoot = path.resolve(
  process.env.TECHNICAL_CABINET_ROOT ?? "reference/cabinet",
);

export const cppCabinetRoot = path.join(
  technicalCabinetRoot,
  "cabinets",
  "cpp",
);

export type ReferenceExample = {
  name: string;
  source: string;
  language: "c" | "cpp";
  expected?: string;
};

export type DrawerMetadata = {
  slug: string;
  title: string;
  summary: string;
  sectionCount: number;
  examples: ReferenceExample[];
};

export function conceptSlugFromId(id: string): string {
  return id.replace(/\/notes(?:\.md)?$/, "");
}

export function cppConceptDirectory(slug: string): string {
  return path.join(cppCabinetRoot, "concepts", slug);
}

export function cppSnippetDirectory(slug: string): string {
  return path.join(cppCabinetRoot, "snippets", slug);
}

export function listExamples(slug: string): ReferenceExample[] {
  const directory = cppConceptDirectory(slug);

  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(?:c|cpp)$/.test(entry.name))
    .map((entry) => {
      const sourcePath = path.join(directory, entry.name);
      const expectedPath = sourcePath.replace(/\.(?:c|cpp)$/, ".expected.txt");

      return {
        name: entry.name,
        source: fs.readFileSync(sourcePath, "utf8"),
        language: entry.name.endsWith(".cpp") ? "cpp" : "c",
        expected: fs.existsSync(expectedPath)
          ? fs.readFileSync(expectedPath, "utf8")
          : undefined,
      };
    })
    .filter((example) => example.source.trim().length > 0)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function getDrawerMetadata(slug: string): DrawerMetadata {
  const notes = fs.readFileSync(
    path.join(cppConceptDirectory(slug), "notes.md"),
    "utf8",
  );
  const title = notes.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? humanizeSlug(slug);
  const summaryLine = notes
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("- "));

  return {
    slug,
    title: title.replace(/\s+NOTES$/i, ""),
    summary:
      summaryLine?.replace(/^-\s+/, "") ??
      "Personal notes and verified examples.",
    sectionCount: Array.from(notes.matchAll(/^##\s+/gm)).length,
    examples: listExamples(slug),
  };
}

function humanizeSlug(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
