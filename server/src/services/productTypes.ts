import { Categories } from "../models/categoryModel";
import { slotIcon } from "./shopCatalogue";
import { FIT_OPTIONS, FitZone } from "./vendorProductRules";

// The product types a vendor can pick (a "slot": Sofa, Lighting...). They are the slots the room
// categories already define, plus "Other" for anything else. "Other" products sell in the shop but can
// never be put into rooms (no room has an "other" slot).
export const OTHER_TYPE_ID = "other";

export interface ProductType {
  id: string;
  label: string;
  icon: string;
  // The room categories that have this slot; a product of this type can be shown in these rooms.
  rooms: string[];
  // Present only for the types that ask the vendor "How is it fitted?" (services/vendorProductRules.ts).
  fits?: FitZone[];
}

export async function loadProductTypes(): Promise<Map<string, ProductType>> {
  const categories = await Categories.find({}, { slug: 1, slots: 1, sortOrder: 1 })
    .sort({ sortOrder: 1 })
    .lean();
  const types = new Map<string, ProductType>();
  for (const category of categories) {
    for (const slot of category.slots || []) {
      if (!slot.id || !slot.label) continue;
      const existing = types.get(slot.id);
      if (existing) {
        existing.rooms.push(category.slug);
      } else {
        types.set(slot.id, { id: slot.id, label: slot.label, icon: slotIcon(slot.id), rooms: [category.slug] });
      }
    }
  }
  for (const [id, fits] of Object.entries(FIT_OPTIONS)) {
    const type = types.get(id);
    if (type) type.fits = fits;
  }
  types.set(OTHER_TYPE_ID, { id: OTHER_TYPE_ID, label: "Other", icon: slotIcon(OTHER_TYPE_ID), rooms: [] });
  return types;
}
