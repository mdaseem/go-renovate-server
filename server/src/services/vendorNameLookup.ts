import { VendorDetails } from "../models/vendorDetailModel";

// Essentials only store vendorId — shared by essentialRoutes.ts and
// essentialRoomRoutes.ts to enrich responses with a display name without
// duplicating the same lookup in both files.
export async function getVendorNameMap(
  vendorIds: string[],
): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(vendorIds));
  if (uniqueIds.length === 0) return new Map();

  const vendors = await VendorDetails.find(
    { id: { $in: uniqueIds } },
    { id: 1, name: 1 },
  );

  return new Map(
    vendors.map((vendor) => [
      vendor.get("id") as string,
      vendor.get("name") as string,
    ]),
  );
}
