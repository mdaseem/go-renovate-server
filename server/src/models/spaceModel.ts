import mongoose from "mongoose";
const Schema = mongoose.Schema;

// A "Space" is a selectable base layout for a category's room preview in the
// Customize tab (see the room-visual-preview skill): a bedroom with a window
// wall, a compact kitchen, a shelf, a terrace… Spaces differ in *kind*, not
// just artwork, so each declares how it should be rendered. Only
// "room-elevation" (a front-view back wall + floor) is implemented today;
// "shelf-grid" and "plan" are reserved so they can slot in without a data
// migration.
//
// Everything is in REAL-WORLD CENTIMETRES so products (which carry their own
// cm dimensions) are drawn to scale against the room: the room's width and
// ceiling height, and each fixture's position and size.
export const SPACE_KINDS = ["room-elevation", "shelf-grid", "plan"] as const;
export const FIXTURE_TYPES = ["window", "door", "artframe", "counter"] as const;

const FixtureSchema = new Schema(
  {
    type: { type: String, enum: FIXTURE_TYPES, required: true },
    // Current (cm) geometry: distance from the left wall, height of its bottom
    // edge above the floor, and its size.
    xCm: Number,
    bottomCm: Number,
    widthCm: Number,
    heightCm: Number,
    color: String,
    // LEGACY geometry (0–1 fractions of the old fixed 16:10 box). Only present
    // on spaces seeded before the true-scale model; the frontend converts them.
    x: Number,
    y: Number,
    w: Number,
    h: Number,
  },
  { _id: false },
);

const SpecSchema = new Schema(
  {
    wall: {
      color: { type: String, required: true },
      shade: String,
      pattern: { type: String, enum: ["plain", "tiles"], default: "plain" },
    },
    floor: {
      color: { type: String, required: true },
      lineColor: String,
    },
    baseboard: String,
    // LEGACY: 0–1 from the top where the wall met the floor in the old fixed
    // box. Superseded by ceilingHeightCm (the frontend derives it).
    floorLine: { type: Number, min: 0.3, max: 0.85 },
    fixtures: [FixtureSchema],
    // Placement zones this space supports (a terrace has no ceiling, say).
    zones: {
      type: [String],
      enum: ["floor", "wall", "ceiling"],
      default: ["floor", "wall", "ceiling"],
    },
  },
  { _id: false },
);

const SpaceSchema = new Schema({
  slug: { type: String, required: true, unique: true },
  categorySlug: { type: String, required: true, index: true },
  name: { type: String, required: true },
  description: String,
  sortOrder: { type: Number, default: 0 },
  // The space preselected when a category's Customize tab opens.
  isDefault: { type: Boolean, default: false },
  kind: { type: String, enum: SPACE_KINDS, default: "room-elevation" },
  // Real-world width the scene's full width represents (drives item scale).
  sceneWidthCm: { type: Number, required: true, min: 50 },
  // Floor-to-ceiling height. With sceneWidthCm this defines the scene's shape
  // (aspect ratio) and the vertical scale of every piece and fixture.
  ceilingHeightCm: { type: Number, min: 150, max: 600 },
  // How much floor the camera sees in front of the back wall (a visual strip,
  // not a literal room depth). Defaults to 90 cm on the frontend.
  floorViewDepthCm: { type: Number, min: 20, max: 300 },
  // LEGACY: width / height of the old fixed scene box. Used only when
  // ceilingHeightCm is absent.
  aspect: { type: Number, min: 0.5, max: 3 },
  spec: { type: SpecSchema, required: true },
});

export const Spaces = mongoose.model("space", SpaceSchema, "spaces");
