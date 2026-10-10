// Seeds the selectable "spaces" (base layouts) for each category's Customize
// preview, and binds each curated Room to one. Standalone on purpose: it only
// touches the "spaces" collection and the `spaceSlug` field of rooms, so it is
// safe to run without resetting essentials' stock (unlike seedEssentials.js).
// Re-runnable — upserts by slug.
//
//   node seed/seedSpaces.js
//
// All geometry is in REAL-WORLD CENTIMETRES (see models/spaceModel.ts): the
// room's width and ceiling height, and every fixture's position and size, so
// products (which carry their own cm dimensions) are drawn to scale.
require("dotenv").config();
const mongoose = require("mongoose");
const { spaceSlugForRoom } = require("./roomSpaces");

const { DB_USER, DB_PASS, DB_HOST, DB_NAME } = process.env;

const SpaceSchema = new mongoose.Schema({
  slug: String,
  categorySlug: String,
  name: String,
  description: String,
  sortOrder: Number,
  isDefault: Boolean,
  kind: String,
  sceneWidthCm: Number,
  ceilingHeightCm: Number,
  floorViewDepthCm: Number,
  spec: mongoose.Schema.Types.Mixed,
});
const Spaces = mongoose.model("space", SpaceSchema, "spaces");

// Only the fields this script reads/writes — it never touches the rest of a Room.
const RoomSchema = new mongoose.Schema({
  categorySlug: String,
  title: String,
  styleTags: [String],
  spaceSlug: String,
});
const Rooms = mongoose.model("room", RoomSchema, "rooms");

const ALL_ZONES = ["floor", "wall", "ceiling"];

// Fixture geometry: xCm = distance from the left wall, bottomCm = height of the
// bottom edge above the floor, widthCm × heightCm = size.
const spaces = [
  // ── Living room ──────────────────────────────────────────────────────
  {
    slug: "living-window-wall",
    categorySlug: "living-room",
    name: "Living room — window wall",
    description: "A classic living room with a large window.",
    sortOrder: 1,
    isDefault: true,
    sceneWidthCm: 450,
    ceilingHeightCm: 270,
    spec: {
      wall: { color: "#efe7da", shade: "#e6dccb", pattern: "plain" },
      floor: { color: "#caa77c", lineColor: "#b8946a" },
      baseboard: "#faf6ee",
      fixtures: [
        { type: "window", xCm: 290, bottomCm: 90, widthCm: 140, heightCm: 140 },
      ],
      zones: ALL_ZONES,
    },
  },
  {
    slug: "living-compact",
    categorySlug: "living-room",
    name: "Compact living room",
    description: "A smaller room with a doorway — pieces look bigger here.",
    sortOrder: 2,
    sceneWidthCm: 340,
    ceilingHeightCm: 250,
    spec: {
      wall: { color: "#f1ebe1", shade: "#e7dfd1", pattern: "plain" },
      floor: { color: "#bda27f", lineColor: "#a98e6b" },
      baseboard: "#fbf8f2",
      fixtures: [
        { type: "door", xCm: 20, bottomCm: 0, widthCm: 90, heightCm: 205 },
        { type: "artframe", xCm: 150, bottomCm: 140, widthCm: 70, heightCm: 50, color: "#c9b79c" },
      ],
      zones: ALL_ZONES,
    },
  },

  // ── Bedroom ──────────────────────────────────────────────────────────
  {
    slug: "bedroom-window-wall",
    categorySlug: "bedroom",
    name: "Bedroom — window wall",
    description: "A calm bedroom with a window on the right.",
    sortOrder: 1,
    isDefault: true,
    sceneWidthCm: 420,
    ceilingHeightCm: 260,
    spec: {
      wall: { color: "#e4e9f0", shade: "#d8dfe9", pattern: "plain" },
      floor: { color: "#c2a37f", lineColor: "#ae8f6b" },
      baseboard: "#f8f9fb",
      fixtures: [
        { type: "window", xCm: 270, bottomCm: 95, widthCm: 130, heightCm: 130 },
      ],
      zones: ALL_ZONES,
    },
  },
  {
    slug: "bedroom-compact",
    categorySlug: "bedroom",
    name: "Compact bedroom",
    description: "A small bedroom with a window and wall art.",
    sortOrder: 2,
    sceneWidthCm: 320,
    ceilingHeightCm: 250,
    spec: {
      wall: { color: "#e8e4f0", shade: "#ddd8e8", pattern: "plain" },
      floor: { color: "#b9a285", lineColor: "#a58d70" },
      baseboard: "#faf9fc",
      fixtures: [
        { type: "window", xCm: 30, bottomCm: 100, widthCm: 100, heightCm: 120 },
        { type: "artframe", xCm: 190, bottomCm: 150, widthCm: 70, heightCm: 50, color: "#9aa7c7" },
      ],
      zones: ALL_ZONES,
    },
  },

  // ── Kitchen ──────────────────────────────────────────────────────────
  {
    slug: "kitchen-wall-cabinets",
    categorySlug: "kitchen",
    name: "Kitchen — wall cabinets",
    description: "A tiled kitchen with a counter run and a window.",
    sortOrder: 1,
    isDefault: true,
    sceneWidthCm: 450,
    ceilingHeightCm: 270,
    spec: {
      wall: { color: "#f4f0e6", shade: "#e9e3d4", pattern: "tiles" },
      floor: { color: "#d6d1c6", lineColor: "#c3bdb0" },
      baseboard: "#ffffff",
      fixtures: [
        { type: "counter", xCm: 20, bottomCm: 0, widthCm: 270, heightCm: 90 },
        { type: "window", xCm: 320, bottomCm: 110, widthCm: 90, heightCm: 100 },
      ],
      zones: ALL_ZONES,
    },
  },
  {
    slug: "kitchen-dining-nook",
    categorySlug: "kitchen",
    name: "Kitchen — dining nook",
    description: "An open kitchen with room to dine under a big window.",
    sortOrder: 2,
    sceneWidthCm: 520,
    ceilingHeightCm: 270,
    spec: {
      wall: { color: "#f6f1e7", shade: "#ece5d6", pattern: "plain" },
      floor: { color: "#cdbfa8", lineColor: "#b9ab94" },
      baseboard: "#ffffff",
      fixtures: [
        { type: "counter", xCm: 20, bottomCm: 0, widthCm: 115, heightCm: 90 },
        { type: "window", xCm: 190, bottomCm: 90, widthCm: 160, heightCm: 140 },
      ],
      zones: ALL_ZONES,
    },
  },

  // ── Bathroom ─────────────────────────────────────────────────────────
  {
    slug: "bathroom-tiled",
    categorySlug: "bathroom",
    name: "Bathroom — tiled wall",
    description: "A fully tiled bathroom with a small window.",
    sortOrder: 1,
    isDefault: true,
    sceneWidthCm: 300,
    ceilingHeightCm: 250,
    spec: {
      wall: { color: "#e3f0f1", shade: "#d3e5e7", pattern: "tiles" },
      floor: { color: "#cfd8dc", lineColor: "#bcc7cc" },
      baseboard: "#ffffff",
      fixtures: [
        { type: "window", xCm: 215, bottomCm: 140, widthCm: 45, heightCm: 60 },
      ],
      zones: ALL_ZONES,
    },
  },
  {
    slug: "bathroom-compact",
    categorySlug: "bathroom",
    name: "Compact bathroom",
    description: "A small tiled bathroom with a door and a mirror.",
    sortOrder: 2,
    sceneWidthCm: 240,
    ceilingHeightCm: 240,
    spec: {
      wall: { color: "#e8f1f0", shade: "#d9e7e6", pattern: "tiles" },
      floor: { color: "#c8d1d4", lineColor: "#b5c0c4" },
      baseboard: "#ffffff",
      fixtures: [
        { type: "door", xCm: 18, bottomCm: 0, widthCm: 75, heightCm: 200 },
        { type: "artframe", xCm: 120, bottomCm: 110, widthCm: 50, heightCm: 70, color: "#dbeef5" },
      ],
      zones: ALL_ZONES,
    },
  },
];

async function seed() {
  await mongoose.connect(
    `mongodb+srv://${DB_USER}:${DB_PASS}@${DB_HOST}/${DB_NAME}`,
  );
  console.log("Connected to MongoDB Atlas");

  for (const space of spaces) {
    // replaceOne so legacy fields (aspect, floorLine, fractional fixtures) from
    // earlier seeds don't linger on the document.
    await Spaces.replaceOne(
      { slug: space.slug },
      { kind: "room-elevation", floorViewDepthCm: 90, ...space },
      { upsert: true },
    );
  }
  console.log(`Seeded ${spaces.length} spaces into "spaces"`);

  // Bind each curated Room to a space (see roomSpaces.js). Updates only the
  // spaceSlug field, so it is safe on a live database.
  const rooms = await Rooms.find();
  let bound = 0;
  for (const room of rooms) {
    const spaceSlug = spaceSlugForRoom(room);
    if (!spaceSlug) continue;
    await Rooms.updateOne({ _id: room._id }, { $set: { spaceSlug } });
    bound += 1;
  }
  console.log(`Bound ${bound} of ${rooms.length} rooms to a space`);

  await mongoose.disconnect();
  console.log("Done.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
