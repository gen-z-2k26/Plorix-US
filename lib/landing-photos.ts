function pexels(id: string, width = 1600) {
  return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${width}`;
}

export const HERO_SCENE = {
  src: pexels("7915357", 2000),
  alt: "Triple monitor gaming setup",
};

export const STORY_SCENE = {
  src: pexels("1714208"),
  alt: "Desk with computer monitors and speakers",
};

export const NEWSLETTER_SCENE = {
  src: pexels("4792728"),
  alt: "Gaming keyboard and desktop computer",
};

const SCENES: Record<string, { src: string; alt: string }> = {
  "computer-monitors": {
    src: pexels("1714208"),
    alt: "Two monitors on a desk",
  },
  "i-o-cards": {
    src: pexels("2582937"),
    alt: "Computer motherboard and processor socket",
  },
  "video-game-consoles": {
    src: pexels("442576"),
    alt: "Game controllers in front of a screen",
  },
  "3d-printers": {
    src: pexels("9241763"),
    alt: "Electronics assembled at a workbench",
  },
  ram: {
    src: pexels("2582937"),
    alt: "Computer motherboard and memory slots",
  },
  "video-servers": {
    src: pexels("4709289"),
    alt: "Monitor on a work desk",
  },
};

export function sceneForCategory(slug: string) {
  return SCENES[slug.toLowerCase()] ?? {
    src: pexels("7915357"),
    alt: "Computer and gaming setup",
  };
}
