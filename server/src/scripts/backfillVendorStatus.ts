// Marks the vendor profiles that existed before sign-up as demo data.
//
//   npm run backfill:vendors            -> DRY RUN: prints what would change, writes nothing
//   npm run backfill:vendors -- --apply -> writes it
//
// Every vendorDetails document with no `source` gets status "active", source "seed" and
// ownerUserId null (+ approvedAt). It never touches a profile that already has a `source`
// (real vendors approved through sign-up) and never overwrites an existing status or owner,
// so it is safe to run twice. Because a missing status already counts as active, running it
// changes nothing visible on the site - it only labels the demo profiles.
import dotenv from "dotenv";
import mongoose from "mongoose";
import { VendorDetails } from "../models/vendorDetailModel";

dotenv.config();
const { DB_USER, DB_PASS, DB_HOST, DB_NAME, MONGODB_URI } = process.env;

async function run() {
  const apply = process.argv.includes("--apply");
  await mongoose.connect(MONGODB_URI || `mongodb+srv://${DB_USER}:${DB_PASS}@${DB_HOST}/${DB_NAME}`);

  // Use the raw collection: the schema would fill defaults into the documents we are counting.
  const collection = VendorDetails.collection;
  const unlabelled = await collection.find({ source: { $exists: false } }).toArray();
  const total = await collection.countDocuments();

  console.log(`${total} vendor profile(s) in total, ${unlabelled.length} without a source label.`);
  for (const vendor of unlabelled) {
    const willSet: string[] = ["source: seed"];
    if (vendor.status === undefined) willSet.push("status: active");
    if (vendor.ownerUserId === undefined) willSet.push("ownerUserId: null");
    willSet.push("approvedAt");
    console.log(`  ${String(vendor.id).padEnd(4)} ${String(vendor.name).padEnd(34)} -> ${willSet.join(", ")}`);
  }

  if (!apply) {
    console.log("\nDry run only - nothing was written. Run again with --apply to write these labels.");
  } else {
    const now = new Date();
    let changed = 0;
    for (const vendor of unlabelled) {
      const set: Record<string, unknown> = { source: "seed", approvedAt: vendor.approvedAt ?? now };
      if (vendor.status === undefined) set.status = "active";
      if (vendor.ownerUserId === undefined) set.ownerUserId = null;
      const result = await collection.updateOne({ _id: vendor._id, source: { $exists: false } }, { $set: set });
      changed += result.modifiedCount;
    }
    console.log(`\nLabelled ${changed} profile(s).`);
  }

  await mongoose.disconnect();
}

run().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
