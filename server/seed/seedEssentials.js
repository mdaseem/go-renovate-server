require("dotenv").config();
const mongoose = require("mongoose");
const { spaceSlugForRoom } = require("./roomSpaces");

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
  stock: Number,
  cutoutUrl: String,
  dimensionsCm: { w: Number, h: Number, d: Number },
  placement: { zone: String, layer: Number },
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
  scene: { backdrop: String, sceneWidthCm: Number, floorLine: Number },
});
const Categories = mongoose.model("category", CategorySchema, "categories");

const RoomSchema = new mongoose.Schema({
  categorySlug: String,
  title: String,
  essentialIds: [mongoose.Schema.Types.ObjectId],
  heroImageUrl: String,
  totalPrice: Number,
  styleTags: [String],
  spaceSlug: String,
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
    scene: { backdrop: "living-room", sceneWidthCm: 450, floorLine: 0.6 },
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
const DEFAULT_STOCK = 25;

// Preview data for the Living Room catalogue. The cutouts are flat-illustration
// PLACEHOLDERS served from the frontend's /public (stand-ins for the
// transparent images vendors will supply). dimensionsCm: w/h/d in centimetres.
const LR = "/essentials/living-room/";
const previewData = {
  1001: { cutoutUrl: LR + "sofa-modern-3-seater.svg", dimensionsCm: { w: 210, h: 85, d: 90 }, placement: { zone: "floor", layer: 1 } },
  1002: { cutoutUrl: LR + "sofa-velvet-loveseat.svg", dimensionsCm: { w: 150, h: 85, d: 85 }, placement: { zone: "floor", layer: 1 } },
  1003: { cutoutUrl: LR + "table-oak.svg", dimensionsCm: { w: 110, h: 45, d: 60 }, placement: { zone: "floor", layer: 2 } },
  1004: { cutoutUrl: LR + "table-marble.svg", dimensionsCm: { w: 100, h: 42, d: 55 }, placement: { zone: "floor", layer: 2 } },
  1005: { cutoutUrl: LR + "rug-jute.svg", dimensionsCm: { w: 200, h: 2, d: 140 }, placement: { zone: "floor", layer: 0 } },
  1006: { cutoutUrl: LR + "rug-persian.svg", dimensionsCm: { w: 240, h: 2, d: 170 }, placement: { zone: "floor", layer: 0 } },
  1007: { cutoutUrl: LR + "lamp-arc-floor.svg", dimensionsCm: { w: 120, h: 190, d: 40 }, placement: { zone: "floor", layer: 1 } },
  1008: { cutoutUrl: LR + "lamp-pendant-cluster.svg", dimensionsCm: { w: 70, h: 120, d: 70 }, placement: { zone: "ceiling", layer: 1 } },
  1009: { cutoutUrl: LR + "sofa-l-sectional.svg", dimensionsCm: { w: 280, h: 85, d: 160 }, placement: { zone: "floor", layer: 1 } },
  1010: { cutoutUrl: LR + "sofa-compact-2-seater.svg", dimensionsCm: { w: 140, h: 82, d: 80 }, placement: { zone: "floor", layer: 1 } },
  1011: { cutoutUrl: LR + "table-glass.svg", dimensionsCm: { w: 105, h: 42, d: 55 }, placement: { zone: "floor", layer: 2 } },
  1012: { cutoutUrl: LR + "table-industrial.svg", dimensionsCm: { w: 100, h: 45, d: 55 }, placement: { zone: "floor", layer: 2 } },
  1013: { cutoutUrl: LR + "rug-geometric.svg", dimensionsCm: { w: 200, h: 2, d: 140 }, placement: { zone: "floor", layer: 0 } },
  1014: { cutoutUrl: LR + "rug-shag.svg", dimensionsCm: { w: 160, h: 2, d: 120 }, placement: { zone: "floor", layer: 0 } },
  1015: { cutoutUrl: LR + "lamp-tripod-floor.svg", dimensionsCm: { w: 55, h: 160, d: 55 }, placement: { zone: "floor", layer: 1 } },
  1016: { cutoutUrl: LR + "lamp-led-panel.svg", dimensionsCm: { w: 70, h: 7, d: 70 }, placement: { zone: "ceiling", layer: 1 } },
};

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
  { _id: eid(1009), name: "L-Shaped Sectional Sofa", price: 38999, vendorId: "2", categorySlugs: ["living-room"], slot: "sofa", purchaseMode: "on-platform", images: [] },
  { _id: eid(1010), name: "Compact 2-Seater Sofa", price: 14999, vendorId: "5", categorySlugs: ["living-room"], slot: "sofa", purchaseMode: "on-platform", images: [] },
  { _id: eid(1011), name: "Glass-Top Coffee Table", price: 8999, vendorId: "5", categorySlugs: ["living-room"], slot: "coffee-table", purchaseMode: "on-platform", images: [] },
  { _id: eid(1012), name: "Industrial Metal Coffee Table", price: 7999, vendorId: "2", categorySlugs: ["living-room"], slot: "coffee-table", purchaseMode: "on-platform", images: [] },
  { _id: eid(1013), name: "Geometric Wool Rug", price: 5999, vendorId: "2", categorySlugs: ["living-room"], slot: "rug", purchaseMode: "on-platform", images: [] },
  { _id: eid(1014), name: "Shag Rug", price: 4499, vendorId: "5", categorySlugs: ["living-room"], slot: "rug", purchaseMode: "on-platform", images: [] },
  { _id: eid(1015), name: "Tripod Floor Lamp", price: 3799, vendorId: "4", categorySlugs: ["living-room"], slot: "lighting", purchaseMode: "on-platform", images: [] },
  { _id: eid(1016), name: "Smart LED Ceiling Panel", price: 6999, vendorId: "4", categorySlugs: ["living-room"], slot: "lighting", purchaseMode: "on-platform", images: [] },

  // Bedroom (2xxx)
  { _id: eid(2001), name: "Queen Platform Bed", price: 32999, vendorId: "2", categorySlugs: ["bedroom"], slot: "bed", purchaseMode: "on-platform", images: [] },
  { _id: eid(2002), name: "King Upholstered Bed", price: 45999, vendorId: "5", categorySlugs: ["bedroom"], slot: "bed", purchaseMode: "external-store", externalStoreUrl: "https://example-vendor-store.example/king-upholstered-bed", images: [] },
  { _id: eid(2003), name: "3-Door Sliding Wardrobe", price: 28999, vendorId: "2", categorySlugs: ["bedroom"], slot: "wardrobe", purchaseMode: "on-platform", images: [] },
  { _id: eid(2004), name: "Compact 2-Door Wardrobe", price: 17499, vendorId: "5", categorySlugs: ["bedroom"], slot: "wardrobe", purchaseMode: "on-platform", images: [] },
  { _id: eid(2005), name: "Walnut Bedside Table", price: 3299, vendorId: "2", categorySlugs: ["bedroom"], slot: "bedside-table", purchaseMode: "on-platform", images: [] },
  { _id: eid(2006), name: "Round Marble Nightstand", price: 4799, vendorId: "5", categorySlugs: ["bedroom"], slot: "bedside-table", purchaseMode: "on-platform", images: [] },
  { _id: eid(2007), name: "Warm Bedside Lamp", price: 1899, vendorId: "4", categorySlugs: ["bedroom"], slot: "lighting", purchaseMode: "on-platform", images: [] },
  { _id: eid(2008), name: "Dimmable Reading Light", price: 2499, vendorId: "4", categorySlugs: ["bedroom"], slot: "lighting", purchaseMode: "on-platform", images: [] },
  { _id: eid(2009), name: "Storage Bed with Drawers", price: 36999, vendorId: "2", categorySlugs: ["bedroom"], slot: "bed", purchaseMode: "on-platform", images: [] },
  { _id: eid(2010), name: "Minimalist Bed Frame", price: 21999, vendorId: "5", categorySlugs: ["bedroom"], slot: "bed", purchaseMode: "on-platform", images: [] },
  { _id: eid(2011), name: "4-Door Mirrored Wardrobe", price: 34999, vendorId: "2", categorySlugs: ["bedroom"], slot: "wardrobe", purchaseMode: "on-platform", images: [] },
  { _id: eid(2012), name: "Open Shelf Wardrobe", price: 19999, vendorId: "5", categorySlugs: ["bedroom"], slot: "wardrobe", purchaseMode: "on-platform", images: [] },
  { _id: eid(2013), name: "Floating Bedside Shelf", price: 2199, vendorId: "2", categorySlugs: ["bedroom"], slot: "bedside-table", purchaseMode: "on-platform", images: [] },
  { _id: eid(2014), name: "Rattan Bedside Table", price: 3799, vendorId: "5", categorySlugs: ["bedroom"], slot: "bedside-table", purchaseMode: "on-platform", images: [] },
  { _id: eid(2015), name: "Pendant Bedside Light", price: 2799, vendorId: "4", categorySlugs: ["bedroom"], slot: "lighting", purchaseMode: "on-platform", images: [] },
  { _id: eid(2016), name: "Smart Bedside Lamp", price: 3299, vendorId: "4", categorySlugs: ["bedroom"], slot: "lighting", purchaseMode: "on-platform", images: [] },

  // Bathroom (3xxx)
  { _id: eid(3001), name: "Single Sink Vanity Unit", price: 19999, vendorId: "3", categorySlugs: ["bathroom"], slot: "vanity", purchaseMode: "on-platform", images: [] },
  { _id: eid(3002), name: "Compact Wall-Mounted Vanity", price: 14499, vendorId: "3", categorySlugs: ["bathroom"], slot: "vanity", purchaseMode: "on-platform", images: [] },
  { _id: eid(3003), name: "Backlit LED Mirror", price: 6999, vendorId: "3", categorySlugs: ["bathroom"], slot: "mirror", purchaseMode: "external-store", externalStoreUrl: "https://example-vendor-store.example/backlit-led-mirror", images: [] },
  { _id: eid(3004), name: "Round Framed Mirror", price: 2999, vendorId: "3", categorySlugs: ["bathroom"], slot: "mirror", purchaseMode: "on-platform", images: [] },
  { _id: eid(3005), name: "Bathroom Storage Cabinet", price: 5499, vendorId: "3", categorySlugs: ["bathroom"], slot: "storage", purchaseMode: "on-platform", images: [] },
  { _id: eid(3006), name: "Corner Shelf Unit", price: 2199, vendorId: "3", categorySlugs: ["bathroom"], slot: "storage", purchaseMode: "on-platform", images: [] },
  { _id: eid(3007), name: "Waterproof Wall Sconce", price: 1799, vendorId: "4", categorySlugs: ["bathroom"], slot: "lighting", purchaseMode: "on-platform", images: [] },
  { _id: eid(3008), name: "IP44 Vanity Light Bar", price: 2399, vendorId: "4", categorySlugs: ["bathroom"], slot: "lighting", purchaseMode: "on-platform", images: [] },
  { _id: eid(3009), name: "Double Sink Vanity Unit", price: 27999, vendorId: "3", categorySlugs: ["bathroom"], slot: "vanity", purchaseMode: "on-platform", images: [] },
  { _id: eid(3010), name: "Floating Vanity Unit", price: 16999, vendorId: "3", categorySlugs: ["bathroom"], slot: "vanity", purchaseMode: "on-platform", images: [] },
  { _id: eid(3011), name: "Rectangular Framed Mirror", price: 3599, vendorId: "3", categorySlugs: ["bathroom"], slot: "mirror", purchaseMode: "on-platform", images: [] },
  { _id: eid(3012), name: "Anti-Fog Smart Mirror", price: 8999, vendorId: "3", categorySlugs: ["bathroom"], slot: "mirror", purchaseMode: "on-platform", images: [] },
  { _id: eid(3013), name: "Wall-Mounted Cabinet", price: 4299, vendorId: "3", categorySlugs: ["bathroom"], slot: "storage", purchaseMode: "on-platform", images: [] },
  { _id: eid(3014), name: "Tall Linen Tower", price: 6499, vendorId: "3", categorySlugs: ["bathroom"], slot: "storage", purchaseMode: "on-platform", images: [] },
  { _id: eid(3015), name: "LED Strip Mirror Light", price: 2699, vendorId: "4", categorySlugs: ["bathroom"], slot: "lighting", purchaseMode: "on-platform", images: [] },
  { _id: eid(3016), name: "Ceiling Exhaust Light Combo", price: 3299, vendorId: "4", categorySlugs: ["bathroom"], slot: "lighting", purchaseMode: "on-platform", images: [] },

  // Kitchen (4xxx)
  { _id: eid(4001), name: "4-Seater Dining Table", price: 21999, vendorId: "2", categorySlugs: ["kitchen"], slot: "dining-table", purchaseMode: "on-platform", images: [] },
  { _id: eid(4002), name: "Extendable Dining Table", price: 27499, vendorId: "2", categorySlugs: ["kitchen"], slot: "dining-table", purchaseMode: "on-platform", images: [] },
  { _id: eid(4003), name: "Set of 4 Dining Chairs", price: 12999, vendorId: "2", categorySlugs: ["kitchen"], slot: "chairs", purchaseMode: "on-platform", images: [] },
  { _id: eid(4004), name: "Cushioned Bar Stools (Set of 2)", price: 6499, vendorId: "5", categorySlugs: ["kitchen"], slot: "chairs", purchaseMode: "on-platform", images: [] },
  { _id: eid(4005), name: "Modular Kitchen Rack", price: 8999, vendorId: "2", categorySlugs: ["kitchen"], slot: "storage", purchaseMode: "on-platform", images: [] },
  { _id: eid(4006), name: "Pantry Storage Unit", price: 10499, vendorId: "2", categorySlugs: ["kitchen"], slot: "storage", purchaseMode: "on-platform", images: [] },
  { _id: eid(4007), name: "Pendant Kitchen Light Set", price: 4299, vendorId: "4", categorySlugs: ["kitchen"], slot: "lighting", purchaseMode: "on-platform", images: [] },
  { _id: eid(4008), name: "Under-Cabinet LED Strip", price: 1999, vendorId: "4", categorySlugs: ["kitchen"], slot: "lighting", purchaseMode: "on-platform", images: [] },
  { _id: eid(4009), name: "6-Seater Dining Table", price: 34999, vendorId: "5", categorySlugs: ["kitchen"], slot: "dining-table", purchaseMode: "on-platform", images: [] },
  { _id: eid(4010), name: "Round Dining Table", price: 18999, vendorId: "2", categorySlugs: ["kitchen"], slot: "dining-table", purchaseMode: "on-platform", images: [] },
  { _id: eid(4011), name: "Set of 6 Dining Chairs", price: 17999, vendorId: "2", categorySlugs: ["kitchen"], slot: "chairs", purchaseMode: "on-platform", images: [] },
  { _id: eid(4012), name: "Wicker Dining Chairs (Set of 4)", price: 9999, vendorId: "5", categorySlugs: ["kitchen"], slot: "chairs", purchaseMode: "on-platform", images: [] },
  { _id: eid(4013), name: "Kitchen Island Cart", price: 13999, vendorId: "5", categorySlugs: ["kitchen"], slot: "storage", purchaseMode: "on-platform", images: [] },
  { _id: eid(4014), name: "Wall-Mounted Spice Rack", price: 2999, vendorId: "2", categorySlugs: ["kitchen"], slot: "storage", purchaseMode: "on-platform", images: [] },
  { _id: eid(4015), name: "Track Lighting Kit", price: 5499, vendorId: "4", categorySlugs: ["kitchen"], slot: "lighting", purchaseMode: "on-platform", images: [] },
  { _id: eid(4016), name: "Smart Kitchen Ceiling Light", price: 4799, vendorId: "4", categorySlugs: ["kitchen"], slot: "lighting", purchaseMode: "on-platform", images: [] },
];

// Ten curated Rooms (bundles) per Category, each a different combination of
// the slot options above. The original one-per-category defaults (first
// entry in each group below) are untouched; the rest are additive — same
// admin-entered-curation situation as before, just more of it, since there's
// still no admin curation screen to generate these dynamically. styleTags
// are illustrative, drawn from the same six-tag set roomFilterConfig.ts's
// Style filter already surfaces.
const rooms = [
  // Living Room
  { categorySlug: "living-room", title: "Everyday Comfort", essentialIds: [eid(1001), eid(1003), eid(1005), eid(1007)], styleTags: ["modern", "minimal"] },
  { categorySlug: "living-room", title: "Urban Loft Lounge", essentialIds: [eid(1009), eid(1012), eid(1014), eid(1016)], styleTags: ["industrial", "smart-tech"] },
  { categorySlug: "living-room", title: "Classic Elegance", essentialIds: [eid(1002), eid(1004), eid(1006), eid(1008)], styleTags: ["traditional", "contemporary"] },
  { categorySlug: "living-room", title: "Minimalist Retreat", essentialIds: [eid(1010), eid(1003), eid(1005), eid(1015)], styleTags: ["minimal"] },
  { categorySlug: "living-room", title: "Contemporary Corner", essentialIds: [eid(1001), eid(1011), eid(1013), eid(1008)], styleTags: ["contemporary", "modern"] },
  { categorySlug: "living-room", title: "Smart Living Suite", essentialIds: [eid(1009), eid(1011), eid(1014), eid(1016)], styleTags: ["smart-tech", "modern"] },
  { categorySlug: "living-room", title: "Cozy Traditional", essentialIds: [eid(1002), eid(1003), eid(1006), eid(1007)], styleTags: ["traditional"] },
  { categorySlug: "living-room", title: "Sleek & Simple", essentialIds: [eid(1010), eid(1011), eid(1005), eid(1015)], styleTags: ["minimal", "modern"] },
  { categorySlug: "living-room", title: "Industrial Edge", essentialIds: [eid(1009), eid(1012), eid(1013), eid(1015)], styleTags: ["industrial"] },
  { categorySlug: "living-room", title: "Bright Family Room", essentialIds: [eid(1001), eid(1004), eid(1014), eid(1008)], styleTags: ["contemporary", "traditional"] },

  // Bedroom
  { categorySlug: "bedroom", title: "Restful Retreat", essentialIds: [eid(2001), eid(2003), eid(2005), eid(2007)], styleTags: ["minimal", "traditional"] },
  { categorySlug: "bedroom", title: "Luxury Suite", essentialIds: [eid(2002), eid(2011), eid(2006), eid(2016)], styleTags: ["contemporary", "smart-tech"] },
  { categorySlug: "bedroom", title: "Minimalist Haven", essentialIds: [eid(2010), eid(2012), eid(2013), eid(2008)], styleTags: ["minimal"] },
  { categorySlug: "bedroom", title: "Storage Smart Bedroom", essentialIds: [eid(2009), eid(2003), eid(2013), eid(2015)], styleTags: ["smart-tech", "modern"] },
  { categorySlug: "bedroom", title: "Compact City Bedroom", essentialIds: [eid(2010), eid(2004), eid(2013), eid(2007)], styleTags: ["minimal", "modern"] },
  { categorySlug: "bedroom", title: "Traditional Comfort", essentialIds: [eid(2001), eid(2004), eid(2006), eid(2007)], styleTags: ["traditional"] },
  { categorySlug: "bedroom", title: "Modern Mirrored Suite", essentialIds: [eid(2009), eid(2011), eid(2014), eid(2016)], styleTags: ["modern", "contemporary"] },
  { categorySlug: "bedroom", title: "Boutique Bedroom", essentialIds: [eid(2002), eid(2012), eid(2006), eid(2015)], styleTags: ["contemporary", "traditional"] },
  { categorySlug: "bedroom", title: "Airy Open Bedroom", essentialIds: [eid(2010), eid(2012), eid(2014), eid(2008)], styleTags: ["minimal", "contemporary"] },
  { categorySlug: "bedroom", title: "Elegant Master Suite", essentialIds: [eid(2009), eid(2004), eid(2006), eid(2016)], styleTags: ["modern", "smart-tech"] },

  // Bathroom
  { categorySlug: "bathroom", title: "Fresh Start", essentialIds: [eid(3001), eid(3004), eid(3005), eid(3007)], styleTags: ["modern", "contemporary"] },
  { categorySlug: "bathroom", title: "Spa Retreat", essentialIds: [eid(3009), eid(3012), eid(3014), eid(3016)], styleTags: ["smart-tech", "contemporary"] },
  { categorySlug: "bathroom", title: "Compact Powder Room", essentialIds: [eid(3002), eid(3011), eid(3006), eid(3008)], styleTags: ["minimal"] },
  { categorySlug: "bathroom", title: "Modern Double Vanity", essentialIds: [eid(3009), eid(3003), eid(3013), eid(3015)], styleTags: ["modern", "smart-tech"] },
  { categorySlug: "bathroom", title: "Minimal Wash Space", essentialIds: [eid(3010), eid(3004), eid(3006), eid(3007)], styleTags: ["minimal", "modern"] },
  { categorySlug: "bathroom", title: "Smart Mirror Bath", essentialIds: [eid(3002), eid(3012), eid(3013), eid(3016)], styleTags: ["smart-tech"] },
  { categorySlug: "bathroom", title: "Classic Bathroom", essentialIds: [eid(3001), eid(3011), eid(3005), eid(3008)], styleTags: ["traditional", "contemporary"] },
  { categorySlug: "bathroom", title: "Floating Elegance", essentialIds: [eid(3010), eid(3003), eid(3014), eid(3015)], styleTags: ["contemporary", "modern"] },
  { categorySlug: "bathroom", title: "Boutique Ensuite", essentialIds: [eid(3009), eid(3011), eid(3014), eid(3008)], styleTags: ["contemporary"] },
  { categorySlug: "bathroom", title: "Efficient Studio Bath", essentialIds: [eid(3002), eid(3004), eid(3013), eid(3007)], styleTags: ["minimal"] },

  // Kitchen
  { categorySlug: "kitchen", title: "Family Table", essentialIds: [eid(4001), eid(4003), eid(4005), eid(4007)], styleTags: ["traditional", "contemporary"] },
  { categorySlug: "kitchen", title: "Grand Gathering", essentialIds: [eid(4009), eid(4011), eid(4013), eid(4015)], styleTags: ["contemporary", "modern"] },
  { categorySlug: "kitchen", title: "Compact Breakfast Nook", essentialIds: [eid(4010), eid(4004), eid(4014), eid(4008)], styleTags: ["minimal"] },
  { categorySlug: "kitchen", title: "Smart Kitchen Diner", essentialIds: [eid(4002), eid(4003), eid(4006), eid(4016)], styleTags: ["smart-tech", "modern"] },
  { categorySlug: "kitchen", title: "Rustic Farmhouse", essentialIds: [eid(4001), eid(4012), eid(4006), eid(4007)], styleTags: ["traditional"] },
  { categorySlug: "kitchen", title: "Modern Island Kitchen", essentialIds: [eid(4009), eid(4004), eid(4013), eid(4015)], styleTags: ["modern", "contemporary"] },
  { categorySlug: "kitchen", title: "Minimalist Dining", essentialIds: [eid(4010), eid(4012), eid(4014), eid(4008)], styleTags: ["minimal"] },
  { categorySlug: "kitchen", title: "Entertainer's Kitchen", essentialIds: [eid(4009), eid(4011), eid(4005), eid(4016)], styleTags: ["contemporary", "smart-tech"] },
  { categorySlug: "kitchen", title: "Cozy Round Table", essentialIds: [eid(4010), eid(4003), eid(4005), eid(4007)], styleTags: ["traditional", "minimal"] },
  { categorySlug: "kitchen", title: "Efficient Studio Kitchen", essentialIds: [eid(4002), eid(4004), eid(4014), eid(4008)], styleTags: ["minimal", "modern"] },
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
    // Starting inventory for on-platform items (external-store items are
    // stocked by the vendor's own store, so they stay untracked). Set an
    // explicit `stock` on an entry above to override — e.g. stock: 0 to try
    // the out-of-stock UI. NOTE: replaceOne resets stock to this value on
    // every re-seed, so don't re-run this against a DB with real orders.
    if (rest.purchaseMode === "on-platform" && rest.stock === undefined) {
      rest.stock = DEFAULT_STOCK;
    }
    Object.assign(rest, previewData[parseInt(_id.toHexString(), 16)]);
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
    const doc = {
      ...room,
      totalPrice: computeTotalPrice(room),
      spaceSlug: spaceSlugForRoom(room),
    };
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
