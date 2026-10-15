"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Read-only audit of the sizes stored on every product in the database.
//
//   npm run check:dimensions
//
// Prints each product that has an ERROR (cannot be drawn honestly) or a WARNING
// (outside the usual range / looks like inches…). Writes nothing. Exits with
// code 1 when there is at least one error, so it can also gate a deploy.
const dotenv_1 = __importDefault(require("dotenv"));
const mongoose_1 = __importDefault(require("mongoose"));
const essentialModel_1 = require("../models/essentialModel");
const dimensionRules_1 = require("../services/dimensionRules");
dotenv_1.default.config();
const { DB_USER, DB_PASS, DB_HOST, DB_NAME } = process.env;
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        yield mongoose_1.default.connect(`mongodb+srv://${DB_USER}:${DB_PASS}@${DB_HOST}/${DB_NAME}`);
        const products = yield essentialModel_1.Essentials.find().lean();
        let errorCount = 0;
        let warningCount = 0;
        let withoutSize = 0;
        for (const product of products) {
            if (!product.dimensionsCm)
                withoutSize += 1;
            const { errors, warnings } = (0, dimensionRules_1.validateDimensions)({
                slot: product.slot,
                cutoutUrl: product.cutoutUrl,
                dimensionsCm: product.dimensionsCm,
                model3d: product.model3d,
                placement: product.placement,
            });
            errorCount += errors.length;
            warningCount += warnings.length;
            for (const issue of errors)
                console.log(`ERROR   ${product.name} (${product.slot}): ${issue.message}`);
            for (const issue of warnings)
                console.log(`warning ${product.name} (${product.slot}): ${issue.message}`);
        }
        console.log(`\nChecked ${products.length} products: ${errorCount} error(s), ${warningCount} warning(s), ${withoutSize} without a size (shown as a labelled tile).`);
        yield mongoose_1.default.disconnect();
        process.exit(errorCount > 0 ? 1 : 0);
    });
}
run().catch((error) => {
    console.error("Size check failed to run:", error);
    process.exit(2);
});
