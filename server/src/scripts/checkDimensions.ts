// Read-only audit of the sizes stored on every product in the database.
//
//   npm run check:dimensions
//
// Prints each product that has an ERROR (cannot be drawn honestly) or a WARNING
// (outside the usual range / looks like inches…). Writes nothing. Exits with
// code 1 when there is at least one error, so it can also gate a deploy.
import dotenv from "dotenv";
import mongoose from "mongoose";
import { Essentials } from "../models/essentialModel";
import { validateDimensions } from "../services/dimensionRules";

dotenv.config();
const { DB_USER, DB_PASS, DB_HOST, DB_NAME } = process.env;

async function run() {
  await mongoose.connect(`mongodb+srv://${DB_USER}:${DB_PASS}@${DB_HOST}/${DB_NAME}`);
  const products = await Essentials.find().lean();
  let errorCount = 0;
  let warningCount = 0;
  let withoutSize = 0;

  for (const product of products) {
    if (!product.dimensionsCm) withoutSize += 1;
    const { errors, warnings } = validateDimensions({
      slot: product.slot,
      cutoutUrl: product.cutoutUrl,
      dimensionsCm: product.dimensionsCm,
      model3d: product.model3d,
      placement: product.placement as { zone?: "floor" | "wall" | "ceiling" | "surface"; layer?: number } | undefined,
    });
    errorCount += errors.length;
    warningCount += warnings.length;
    for (const issue of errors) console.log(`ERROR   ${product.name} (${product.slot}): ${issue.message}`);
    for (const issue of warnings) console.log(`warning ${product.name} (${product.slot}): ${issue.message}`);
  }

  console.log(
    `\nChecked ${products.length} products: ${errorCount} error(s), ${warningCount} warning(s), ${withoutSize} without a size (shown as a labelled tile).`,
  );
  await mongoose.disconnect();
  process.exit(errorCount > 0 ? 1 : 0);
}

run().catch((error) => {
  console.error("Size check failed to run:", error);
  process.exit(2);
});
