// Film name (a page's `film.name` in site-metadata.js) → its scene module.
export const SCENES = {
  robotics: () => import("./scenes/robotics.js"),
  "opengraph-image": () => import("./scenes/opengraph-image.js"),
  "opengraph-text": () => import("./scenes/opengraph-text.js"),
  "opengraph-table": () => import("./scenes/opengraph-table.js"),
  "image-video-search": () => import("./scenes/image-video-search.js"),
  "multimodal-agents": () => import("./scenes/multimodal-agents.js"),
  research: () => import("./scenes/research.js"),
};
