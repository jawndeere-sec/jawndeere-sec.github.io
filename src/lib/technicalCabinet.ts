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

export const studyCabinets = [
  {
    slug: "ai-security",
    title: "AI Security",
    description:
      "Local AI engineering, keyword RAG, grounding, and bounded AI security study.",
  },
  {
    slug: "security-platforms",
    title: "Security Platforms",
    description:
      "Course-derived endpoint, response, and SIEM mechanism distinctions.",
  },
] as const;

export function studyConceptSlug(id: string): string {
  return id.split("/")[2];
}

export function studyCabinetSlug(id: string): string {
  return id.split("/")[0];
}

export function getStudyDrawerMetadata(
  cabinet: string,
  slug: string,
): DrawerMetadata {
  const notes = fs.readFileSync(
    path.join(
      technicalCabinetRoot,
      "cabinets",
      cabinet,
      "concepts",
      slug,
      "notes.md",
    ),
    "utf8",
  );

  return metadataFromNotes(slug, notes, []);
}

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
  return metadataFromNotes(slug, notes, listExamples(slug));
}

function metadataFromNotes(
  slug: string,
  notes: string,
  examples: ReferenceExample[],
): DrawerMetadata {
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
    examples,
  };
}

function humanizeSlug(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
