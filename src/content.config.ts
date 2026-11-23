import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

const technicalCabinetRoot =
  process.env.TECHNICAL_CABINET_ROOT ?? "./reference/cabinet";

const blog = defineCollection({
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    heroImage: z.string().optional(),
    slug: z.string().optional(), // 👈 add this line
  }),
});

const cppCabinet = defineCollection({
  loader: glob({
    pattern: "*/notes.md",
    base: `${technicalCabinetRoot}/cabinets/cpp/concepts`,
  }),
});

const studyCabinet = defineCollection({
  loader: glob({
    pattern: "*/concepts/*/notes.md",
    base: `${technicalCabinetRoot}/cabinets`,
  }),
});

export const collections = { blog, cppCabinet, studyCabinet };
