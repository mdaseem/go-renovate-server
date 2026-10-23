import { FilterQuery } from "mongoose";

// A product a vendor created starts "pending" (waiting for the owner's review) and can later be "live",
// "paused" (by the vendor or by the owner) or "rejected". A product with NO status is live: every
// product that existed before vendors could add products (the seeded catalogue) keeps working untouched,
// so the field has no schema default, the same way `vendorDetails.status` works.
export const PRODUCT_STATUSES = ["pending", "live", "paused", "rejected"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const NOT_PUBLIC_PRODUCT_STATUSES: string[] = ["pending", "paused", "rejected"];

// Every public path that reads products (the shop, vendor pages, the room pickers, search, availability,
// saved designs and ordering) must combine its query with this filter, so a product that is not live is
// never shown or sold. Use it as `{ ...PUBLIC_PRODUCT_FILTER }` inside a query.
export const PUBLIC_PRODUCT_FILTER: FilterQuery<unknown> = {
  status: { $nin: NOT_PUBLIC_PRODUCT_STATUSES },
};

// What a stored status means to a reader: a missing status is live.
export function effectiveStatus(status: unknown): ProductStatus {
  return typeof status === "string" && (PRODUCT_STATUSES as readonly string[]).includes(status)
    ? (status as ProductStatus)
    : "live";
}

export function isPublicStatus(status: unknown): boolean {
  return !NOT_PUBLIC_PRODUCT_STATUSES.includes(String(status ?? ""));
}
