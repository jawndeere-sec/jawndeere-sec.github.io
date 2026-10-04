export type ArcadeExperience = {
  slug: string;
  title: string;
  description: string;
  tags: string[];
  links: { label: string; href: string }[];
  terminal?: {
    caption: string;
    scriptPath: string;
    wasmPath: string;
    factoryName?: string;
  };
};

export const ARCADE_EXPERIENCES: ArcadeExperience[] = [
  {
    slug: "cndnd",
    title: "C&D&D Terminal RPG",
    description:
      "My first ever game I built with my own hands in C. Just loads a party file with existing info and runs an encounter with real RNG and turn-based combat. It's a little slow (10-20secs) but you should get a different result every time!",
    tags: ["CLI", "RPG",],
    links: [
      { label: "Read the repo", href: "https://github.com/jawndeere-sec/cndnd" },
    ],
    terminal: {
      caption: "Live C&D&D run",
      scriptPath: "/arcade/cndnd.js",
      wasmPath: "/arcade/cndnd.wasm",
      factoryName: "createCndndModule",
    },
  },
  {
    slug: "roll-high-or-die",
    title: "Roll High Or Die",
    description:
      "Recommended to run in fullscreen mode. A procedural arcade runner game built in C++ with Raylib, as a vehicle for learning game physics, game dev best practices, Raylib and C++ project structure.",
    tags: ["Itch.io", "Dice", "Quick"],
    links: [
      { label: "Try on itch.io", href: "https://itch.io/embed-upload/16538024?color=333333" },
      { label: "Read the repo", href: "https://github.com/jawndeere-sec/rollhighordie" },
    ],
  },
];
