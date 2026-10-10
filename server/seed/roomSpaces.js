// Which Space (see seedSpaces.js) each curated Room is shown in. Shared by
// seedEssentials.js and seedSpaces.js so both bind rooms identically.
//
// Rule (explainable, data-driven — replace with real curation later): rooms
// tagged "minimal" suit a smaller/second space; everything else uses the
// category's default space.
const SPACES_BY_CATEGORY = {
  "living-room": { default: "living-window-wall", alt: "living-compact" },
  bedroom: { default: "bedroom-window-wall", alt: "bedroom-compact" },
  kitchen: { default: "kitchen-wall-cabinets", alt: "kitchen-dining-nook" },
  bathroom: { default: "bathroom-tiled", alt: "bathroom-compact" },
};

function spaceSlugForRoom(room) {
  const spaces = SPACES_BY_CATEGORY[room.categorySlug];
  if (!spaces) return undefined;
  const tags = room.styleTags || [];
  return tags.includes("minimal") ? spaces.alt : spaces.default;
}

module.exports = { spaceSlugForRoom };
