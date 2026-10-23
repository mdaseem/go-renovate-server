import { FilterQuery } from "mongoose";
import { Essentials } from "../models/essentialModel";
import { servicesEnabled } from "./featureFlags";
import { PUBLIC_PRODUCT_FILTER } from "./productVisibility";

// A profile that is pending or paused is never public and cannot take orders. A missing status means
// active, which keeps every profile created before sign-up existed visible.
export const NOT_PUBLIC_STATUSES = ["pending", "paused"];

// Services mode (SERVICES_ENABLED=true): a vendor is public once it has at least one service listed.
export const PUBLIC_VENDOR_FILTER: FilterQuery<unknown> = {
  status: { $nin: NOT_PUBLIC_STATUSES },
  "categories.0": { $exists: true },
};

// Shop mode (the default): a vendor is public once it has at least one LIVE product.
async function shopVendorFilter(): Promise<FilterQuery<unknown>> {
  const vendorIds: string[] = await Essentials.distinct("vendorId", PUBLIC_PRODUCT_FILTER);
  return { status: { $nin: NOT_PUBLIC_STATUSES }, id: { $in: vendorIds } };
}

export async function getPublicVendorFilter(): Promise<FilterQuery<unknown>> {
  return servicesEnabled() ? PUBLIC_VENDOR_FILTER : shopVendorFilter();
}

// Always combine with $and: the shop filter constrains `id`, so spreading it next to `{ id }` would
// silently replace the id being looked up.
export async function publicVendorQuery(
  extra: FilterQuery<unknown> = {},
): Promise<FilterQuery<unknown>> {
  return { $and: [extra, await getPublicVendorFilter()] };
}
