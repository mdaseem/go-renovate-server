require("dotenv").config();
const mongoose = require("mongoose");

const { DB_USER, DB_PASS, DB_HOST, DB_NAME } = process.env;

const EssentialSchema = new mongoose.Schema({
  name: String,
  description: String,
  images: [String],
  price: Number,
  discountPrice: Number,
  vendorId: String,
  categorySlugs: [String],
  slot: String,
  purchaseMode: String,
  externalStoreUrl: String,
});
const Essentials = mongoose.model("essential", EssentialSchema, "essentials");

const CategorySlotSchema = new mongoose.Schema(
  { id: String, label: String },
  { _id: false },
);
const CategorySchema = new mongoose.Schema({
  slug: String,
  name: String,
  icon: String,
  slots: [CategorySlotSchema],
  sortOrder: Number,
});
const Categories = mongoose.model("category", CategorySchema, "categories");

const RoomSchema = new mongoose.Schema({
  categorySlug: String,
  title: String,
  essentialIds: [mongoose.Schema.Types.ObjectId],
  heroImageUrl: String,
  totalPrice: Number,
  styleTags: [String],
});
const Rooms = mongoose.model("room", RoomSchema, "rooms");

// Fixed, deterministic ObjectIds so this seed script is safely re-runnable
// (upserted by _id) and so Rooms.essentialIds can reference them without a
// two-pass insert-then-look-up-generated-id dance.
function eid(n) {
  return new mongoose.Types.ObjectId(n.toString(16).padStart(24, "0"));
}

const categories = [
  {
    slug: "living-room",
    name: "Living Room",
    icon: "🛋️",
    sortOrder: 1,
    slots: [
      { id: "sofa", label: "Sofa" },
      { id: "coffee-table", label: "Coffee Table" },
      { id: "rug", label: "Rug" },
      { id: "lighting", label: "Lighting" },
    ],
  },
  {
    slug: "bedroom",
    name: "Bedroom",
    icon: "🛏️",
    sortOrder: 2,
    slots: [
      { id: "bed", label: "Bed" },
      { id: "wardrobe", label: "Wardrobe" },
      { id: "bedside-table", label: "Bedside Table" },
      { id: "lighting", label: "Lighting" },
    ],
  },
  {
    slug: "bathroom",
    name: "Bathroom",
    icon: "🚿",
    sortOrder: 3,
    slots: [
      { id: "vanity", label: "Vanity" },
      { id: "mirror", label: "Mirror" },
      { id: "storage", label: "Storage" },
      { id: "lighting", label: "Lighting" },
    ],
  },
  {
    slug: "kitchen",
    name: "Kitchen",
    icon: "🍳",
    sortOrder: 4,
    slots: [
      { id: "dining-table", label: "Dining Table" },
      { id: "chairs", label: "Chairs" },
      { id: "storage", label: "Storage" },
      { id: "lighting", label: "Lighting" },
    ],
  },
];

// vendorId values reuse real vendors already seeded in vendorDetails.seed.json
// (2 = ModuKitchens Co., 3 = AquaFit Bath Studio, 4 = BrightSpark Electricals,
// 5 = ColorCraft Painters) — there's no separate home-decor vendor pool yet.
const essentials = [
  // Living Room (1xxx)
  { _id: eid(1001), name: "Modern 3-Seater Sofa", price: 24999, vendorId: "2", categorySlugs: ["living-room"], slot: "sofa", purchaseMode: "on-platform", images: [] },
  { _id: eid(1002), name: "Velvet Loveseat", price: 18499, vendorId: "5", categorySlugs: ["living-room"], slot: "sofa", purchaseMode: "on-platform", images: [] },
  { _id: eid(1003), name: "Oak Coffee Table", price: 6499, vendorId: "2", categorySlugs: ["living-room"], slot: "coffee-table", purchaseMode: "on-platform", images: [] },
  { _id: eid(1004), name: "Marble-Top Coffee Table", price: 11999, vendorId: "5", categorySlugs: ["living-room"], slot: "coffee-table", purchaseMode: "on-platform", images: [] },
  { _id: eid(1005), name: "Handwoven Jute Rug", price: 3999, vendorId: "5", categorySlugs: ["living-room"], slot: "rug", purchaseMode: "on-platform", images: [] },
  { _id: eid(1006), name: "Persian-Style Area Rug", price: 7499, vendorId: "2", categorySlugs: ["living-room"], slot: "rug", purchaseMode: "on-platform", images: [] },
  { _id: eid(1007), name: "Arc Floor Lamp", price: 4499, vendorId: "4", categorySlugs: ["living-room"], slot: "lighting", purchaseMode: "on-platform", images: [] },
  { _id: eid(1008), name: "Pendant Cluster Light", price: 5999, vendorId: "4", categorySlugs: ["living-room"], slot: "lighting", purchaseMode: "on-platform", images: [] },

  // Bedroom (2xxx)
  { _id: eid(2001), name: "Queen Platform Bed", price: 32999, vendorId: "2", categorySlugs: ["bedroom"], slot: "bed", purchaseMode: "on-platform", images: [] },
  { _id: eid(2002), name: "King Upholstered Bed", price: 45999, vendorId: "5", categorySlugs: ["bedroom"], slot: "bed", purchaseMode: "external-store", externalStoreUrl: "https://example-vendor-store.example/king-upholstered-bed", images: [] },
  { _id: eid(2003), name: "3-Door Sliding Wardrobe", price: 28999, vendorId: "2", categorySlugs: ["bedroom"], slot: "wardrobe", purchaseMode: "on-platform", images: [] },
  { _id: eid(2004), name: "Compact 2-Door Wardrobe", price: 17499, vendorId: "5", categorySlugs: ["bedroom"], slot: "wardrobe", purchaseMode: "on-platform", images: [] },
  { _id: eid(2005), name: "Walnut Bedside Table", price: 3299, vendorId: "2", categorySlugs: ["bedroom"], slot: "bedside-table", purchaseMode: "on-platform", images: [] },
  { _id: eid(2006), name: "Round Marble Nightstand", price: 4799, vendorId: "5", categorySlugs: ["bedroom"], slot: "bedside-table", purchaseMode: "on-platform", images: [] },
  { _id: eid(2007), name: "Warm Bedside Lamp", price: 1899, vendorId: "4", categorySlugs: ["bedroom"], slot: "lighting", purchaseMode: "on-platform", images: [] },
  { _id: eid(2008), name: "Dimmable Reading Light", price: 2499, vendorId: "4", categorySlugs: ["bedroom"], slot: "lighting", purchaseMode: "on-platform", images: [] },

  // Bathroom (3xxx)
  { _id: eid(3001), name: "Single Sink Vanity Unit", price: 19999, vendorId: "3", categorySlugs: ["bathroom"], slot: "vanity", purchaseMode: "on-platform", images: [] },
  { _id: eid(3002), name: "Compact Wall-Mounted Vanity", price: 14499, vendorId: "3", categorySlugs: ["bathroom"], slot: "vanity", purchaseMode: "on-platform", images: [] },
  { _id: eid(3003), name: "Backlit LED Mirror", price: 6999, vendorId: "3", categorySlugs: ["bathroom"], slot: "mirror", purchaseMode: "external-store", externalStoreUrl: "https://example-vendor-store.example/backlit-led-mirror", images: [] },
  { _id: eid(3004), name: "Round Framed Mirror", price: 2999, vendorId: "3", categorySlugs: ["bathroom"], slot: "mirror", purchaseMode: "on-platform", images: [] },
  { _id: eid(3005), name: "Bathroom Storage Cabinet", price: 5499, vendorId: "3", categorySlugs: ["bathroom"], slot: "storage", purchaseMode: "on-platform", images: [] },
  { _id: eid(3006), name: "Corner Shelf Unit", price: 2199, vendorId: "3", categorySlugs: ["bathroom"], slot: "storage", purchaseMode: "on-platform", images: [] },
  { _id: eid(3007), name: "Waterproof Wall Sconce", price: 1799, vendorId: "4", categorySlugs: ["bathroom"], slot: "lighting", purchaseMode: "on-platform", images: [] },
  { _id: eid(3008), name: "IP44 Vanity Light Bar", price: 2399, vendorId: "4", categorySlugs: ["bathroom"], slot: "lighting", purchaseMode: "on-platform", images: [] },

  // Kitchen (4xxx)
  { _id: eid(4001), name: "4-Seater Dining Table", price: 21999, vendorId: "2", categorySlugs: ["kitchen"], slot: "dining-table", purchaseMode: "on-platform", images: [] },
  { _id: eid(4002), name: "Extendable Dining Table", price: 27499, vendorId: "2", categorySlugs: ["kitchen"], slot: "dining-table", purchaseMode: "on-platform", images: [] },
  { _id: eid(4003), name: "Set of 4 Dining Chairs", price: 12999, vendorId: "2", categorySlugs: ["kitchen"], slot: "chairs", purchaseMode: "on-platform", images: [] },
  { _id: eid(4004), name: "Cushioned Bar Stools (Set of 2)", price: 6499, vendorId: "5", categorySlugs: ["kitchen"], slot: "chairs", purchaseMode: "on-platform", images: [] },
  { _id: eid(4005), name: "Modular Kitchen Rack", price: 8999, vendorId: "2", categorySlugs: ["kitchen"], slot: "storage", purchaseMode: "on-platform", images: [] },
  { _id: eid(4006), name: "Pantry Storage Unit", price: 10499, vendorId: "2", categorySlugs: ["kitchen"], slot: "storage", purchaseMode: "on-platform", images: [] },
  { _id: eid(4007), name: "Pendant Kitchen Light Set", price: 4299, vendorId: "4", categorySlugs: ["kitchen"], slot: "lighting", purchaseMode: "on-platform", images: [] },
  { _id: eid(4008), name: "Under-Cabinet LED Strip", price: 1999, vendorId: "4", categorySlugs: ["kitchen"], slot: "lighting", purchaseMode: "on-platform", images: [] },
];

// One default Room (bundle) per Category — the first (cheaper) option in
// each slot. totalPrice is computed below from the actual essential prices
// so it can't drift out of sync with the picks. No admin curation screen
// exists yet, so this is still exactly one Room per Category — styleTags
// are illustrative, not derived from anything.
const rooms = [
  { categorySlug: "living-room", title: "Everyday Comfort", essentialIds: [eid(1001), eid(1003), eid(1005), eid(1007)], styleTags: ["modern", "minimal"] },
  { categorySlug: "bedroom", title: "Restful Retreat", essentialIds: [eid(2001), eid(2003), eid(2005), eid(2007)], styleTags: ["minimal", "traditional"] },
  { categorySlug: "bathroom", title: "Fresh Start", essentialIds: [eid(3001), eid(3004), eid(3005), eid(3007)], styleTags: ["modern", "contemporary"] },
  { categorySlug: "kitchen", title: "Family Table", essentialIds: [eid(4001), eid(4003), eid(4005), eid(4007)], styleTags: ["traditional", "contemporary"] },
];

function computeTotalPrice(room) {
  const priceById = new Map(essentials.map((e) => [e._id.toString(), e.price]));
  return room.essentialIds.reduce(
    (sum, id) => sum + (priceById.get(id.toString()) || 0),
    0,
  );
}

async function seed() {
  await mongoose.connect(
    `mongodb+srv://${DB_USER}:${DB_PASS}@${DB_HOST}/${DB_NAME}`,
  );
  console.log("Connected to MongoDB Atlas");

  for (const category of categories) {
    await Categories.updateOne(
      { slug: category.slug },
      { $set: category },
      { upsert: true },
    );
  }
  console.log(`Seeded ${categories.length} categories into "categories"`);

  // replaceOne, not updateOne+$set — a field that's since been removed from
  // the seed shape (e.g. the old roomSlugs, renamed to categorySlugs) would
  // otherwise linger forever on already-seeded documents, since $set only
  // adds/overwrites, never removes.
  for (const essential of essentials) {
    const { _id, ...rest } = essential;
    await Essentials.replaceOne({ _id }, rest, { upsert: true });
  }
  console.log(`Seeded ${essentials.length} essentials into "essentials"`);

  // The "rooms" collection used to hold Category-shaped docs pre-rename,
  // with a unique index on `slug`. New Room docs don't have a `slug` field
  // (they use `categorySlug`), so every one of them collides on
  // `slug: null` against that stale index unless it's dropped first.
  try {
    await mongoose.connection.db.collection("rooms").dropIndex("slug_1");
    console.log('Dropped stale "slug_1" index from "rooms"');
  } catch (err) {
    if (err.codeName !== "IndexNotFound") throw err;
  }

  for (const room of rooms) {
    const doc = { ...room, totalPrice: computeTotalPrice(room) };
    await Rooms.replaceOne(
      { categorySlug: room.categorySlug, title: room.title },
      doc,
      { upsert: true },
    );
  }
  console.log(`Seeded ${rooms.length} rooms into "rooms"`);

  // Migration cleanup: "rooms" used to be the Category-taxonomy collection
  // (pre-rename) and "roomCombos" used to hold what Rooms now holds. Both
  // are stale now that Categories moved to its own collection and Rooms
  // moved into "rooms" — remove the leftover Category-shaped docs (they
  // predate the categorySlug field, so this can't touch anything just
  // seeded above) and drop the now-unused roomCombos collection.
  const staleCategoryShapedDocs = await Rooms.deleteMany({
    categorySlug: { $exists: false },
  });
  if (staleCategoryShapedDocs.deletedCount > 0) {
    console.log(
      `Removed ${staleCategoryShapedDocs.deletedCount} stale pre-rename doc(s) from "rooms"`,
    );
  }
  try {
    await mongoose.connection.db.collection("roomCombos").drop();
    console.log('Dropped unused "roomCombos" collection');
  } catch (err) {
    if (err.codeName !== "NamespaceNotFound") throw err;
  }

  await mongoose.disconnect();
  console.log("Done.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
