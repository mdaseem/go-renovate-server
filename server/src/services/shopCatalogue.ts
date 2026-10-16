import { Categories } from "../models/categoryModel";
import { Essentials } from "../models/essentialModel";
import { servicesEnabled } from "./featureFlags";

// Shop mode (SERVICES_ENABLED off): the vendor pages show a vendor's PRODUCTS in the same shape the
// pages already use for services - `categories[].services[]` - so the list, filters, search, category
// pages and vendor page keep their layout. Here "category" = the product's slot (Sofa, Lighting...) and
// each entry in `services` is a product (it carries a `product` block that the frontend uses to switch
// the wording and the cart). The cart and orders for products go through /essentials, never /orders.

const SLOT_ICONS: Record<string, string> = {
  sofa: "🛋️",
  "coffee-table": "🪑",
  rug: "🧶",
  lighting: "💡",
  "wall-decor": "🖼️",
  decor: "🪴",
  bed: "🛏️",
  wardrobe: "🚪",
  "bedside-table": "🪑",
  vanity: "🪞",
  mirror: "🪞",
  storage: "🗄️",
  accessories: "🧴",
  "dining-table": "🍽️",
  chairs: "🪑",
  countertop: "🍳",
};
const DEFAULT_SLOT_ICON = "📦";

interface ShopProductBlock {
  stock: number | null;
  purchaseMode: "on-platform" | "external-store";
  externalStoreUrl?: string;
  dimensionsCm?: { w?: number; h?: number; d?: number };
  slot: string;
}

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  images: string[];
  isAvailable: boolean;
  product: ShopProductBlock;
}

export interface ShopCategory {
  id: string;
  label: string;
  icon: string;
  services: ShopItem[];
}

function humanize(slotId: string): string {
  const text = slotId.replace(/-/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// slot id -> label, per room category (a slot id such as "rug" is called "Bath mat" in Bathroom).
async function loadSlotLabels(): Promise<Map<string, Map<string, string>>> {
  const categories = await Categories.find({}, { slug: 1, slots: 1 }).lean();
  const bySlug = new Map<string, Map<string, string>>();
  for (const category of categories) {
    const labels = new Map<string, string>();
    for (const slot of category.slots || []) {
      if (slot.id && slot.label) labels.set(slot.id, slot.label);
    }
    bySlug.set(category.slug, labels);
  }
  return bySlug;
}

function labelFor(
  slot: string,
  categorySlugs: string[],
  labels: Map<string, Map<string, string>>,
): string {
  for (const slug of categorySlugs) {
    const label = labels.get(slug)?.get(slot);
    if (label) return label;
  }
  return humanize(slot);
}

// vendorId -> that vendor's products grouped by slot. One query for the products and one tiny one for
// the labels, however many vendors are asked for.
export async function buildShopCategories(
  vendorIds: string[],
): Promise<Map<string, ShopCategory[]>> {
  const result = new Map<string, ShopCategory[]>();
  if (vendorIds.length === 0) return result;

  const [products, labels] = await Promise.all([
    Essentials.find({ vendorId: { $in: vendorIds } }).sort({ name: 1 }).lean(),
    loadSlotLabels(),
  ]);

  const grouped = new Map<string, Map<string, ShopCategory>>();
  for (const product of products) {
    const vendorId = product.vendorId;
    const slot = product.slot;
    const stock = typeof product.stock === "number" ? product.stock : null;
    const isExternal = product.purchaseMode === "external-store";
    // Real photos first; the vendor's cut-out illustration (the one the room preview draws) stands in
    // until a photo exists.
    const photos = (product.images || []).filter(Boolean);
    const images = photos.length > 0 ? photos : product.cutoutUrl ? [product.cutoutUrl] : [];
    const item: ShopItem = {
      id: String(product._id),
      name: product.name,
      description: product.description || "",
      price: product.price,
      imageUrl: images[0],
      images,
      // External-store items are bought elsewhere, so their stock is not ours to judge.
      isAvailable: isExternal || stock === null || stock > 0,
      product: {
        stock: isExternal ? null : stock,
        purchaseMode: isExternal ? "external-store" : "on-platform",
        externalStoreUrl: isExternal ? product.externalStoreUrl : undefined,
        dimensionsCm: product.dimensionsCm
          ? { w: product.dimensionsCm.w, h: product.dimensionsCm.h, d: product.dimensionsCm.d }
          : undefined,
        slot,
      },
    };

    if (!grouped.has(vendorId)) grouped.set(vendorId, new Map());
    const byVendor = grouped.get(vendorId) as Map<string, ShopCategory>;
    if (!byVendor.has(slot)) {
      byVendor.set(slot, {
        id: slot,
        label: labelFor(slot, product.categorySlugs || [], labels),
        icon: SLOT_ICONS[slot] ?? DEFAULT_SLOT_ICON,
        services: [],
      });
    }
    (byVendor.get(slot) as ShopCategory).services.push(item);
  }

  for (const [vendorId, bySlot] of grouped) {
    result.set(
      vendorId,
      Array.from(bySlot.values()).sort((a, b) => a.label.localeCompare(b.label)),
    );
  }
  return result;
}

// Swaps the `categories` of vendor documents for their product categories (shop mode only).
export async function presentVendors<T>(vendors: T[]): Promise<unknown[]> {
  if (servicesEnabled()) return vendors;
  const plain = vendors.map((vendor) => {
    const doc = vendor as unknown as { toObject?: () => Record<string, unknown> };
    return (typeof doc.toObject === "function" ? doc.toObject() : { ...(vendor as object) }) as Record<
      string,
      unknown
    >;
  });
  const categories = await buildShopCategories(plain.map((vendor) => String(vendor.id)));
  return plain.map((vendor) => ({ ...vendor, categories: categories.get(String(vendor.id)) ?? [] }));
}

// Vendor ids that sell at least one product in any of these slots (the category filter in shop mode).
export async function vendorIdsWithSlots(slotIds: string[]): Promise<string[]> {
  return Essentials.distinct("vendorId", { slot: { $in: slotIds } });
}

// Vendor ids with a product whose name, or whose slot name, matches the search pattern.
export async function vendorIdsMatchingProducts(pattern: RegExp): Promise<string[]> {
  const categories = await Categories.find({}, { slots: 1 }).lean();
  const matchingSlots = new Set<string>();
  for (const category of categories) {
    for (const slot of category.slots || []) {
      if (slot.id && (pattern.test(slot.label || "") || pattern.test(slot.id))) matchingSlots.add(slot.id);
    }
  }
  return Essentials.distinct("vendorId", {
    $or: [{ name: pattern }, { slot: { $in: Array.from(matchingSlots) } }],
  });
}
