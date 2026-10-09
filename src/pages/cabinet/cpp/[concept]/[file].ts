import type { APIRoute } from "astro";
import fs from "node:fs";
import {
  cppCabinetRoot,
  cppConceptDirectory,
  cppSnippetDirectory,
} from "@/lib/technicalCabinet";

export function getStaticPaths() {
  const conceptsRoot = `${cppCabinetRoot}/concepts`;

  const sourceDirectories = fs
    .readdirSync(conceptsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      routeSegment: entry.name,
      directory: cppConceptDirectory(entry.name),
    }));

  sourceDirectories.push({
    routeSegment: "project-start",
    directory: cppSnippetDirectory("project-start"),
  });

  return sourceDirectories.flatMap(({ routeSegment, directory }) =>
    fs
      .readdirSync(directory, { withFileTypes: true })
      .filter((file) => file.isFile() && /\.(?:c|cpp|h|txt)$/.test(file.name))
      .map((file) => ({
        params: { concept: routeSegment, file: file.name },
        props: {
          sourcePath: `${directory}/${file.name}`,
        },
      })),
  );
}

export const GET: APIRoute = ({ props }) => {
  const source = fs.readFileSync(props.sourcePath, "utf8");

  return new Response(source, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
};
