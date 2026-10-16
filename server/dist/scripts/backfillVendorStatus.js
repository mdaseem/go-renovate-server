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
const dotenv_1 = __importDefault(require("dotenv"));
const mongoose_1 = __importDefault(require("mongoose"));
const vendorDetailModel_1 = require("../models/vendorDetailModel");
dotenv_1.default.config();
const { DB_USER, DB_PASS, DB_HOST, DB_NAME, MONGODB_URI } = process.env;
function run() {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const apply = process.argv.includes("--apply");
        yield mongoose_1.default.connect(MONGODB_URI || `mongodb+srv://${DB_USER}:${DB_PASS}@${DB_HOST}/${DB_NAME}`);
        // Use the raw collection: the schema would fill defaults into the documents we are counting.
        const collection = vendorDetailModel_1.VendorDetails.collection;
        const unlabelled = yield collection.find({ source: { $exists: false } }).toArray();
        const total = yield collection.countDocuments();
        console.log(`${total} vendor profile(s) in total, ${unlabelled.length} without a source label.`);
        for (const vendor of unlabelled) {
            const willSet = ["source: seed"];
            if (vendor.status === undefined)
                willSet.push("status: active");
            if (vendor.ownerUserId === undefined)
                willSet.push("ownerUserId: null");
            willSet.push("approvedAt");
            console.log(`  ${String(vendor.id).padEnd(4)} ${String(vendor.name).padEnd(34)} -> ${willSet.join(", ")}`);
        }
        if (!apply) {
            console.log("\nDry run only - nothing was written. Run again with --apply to write these labels.");
        }
        else {
            const now = new Date();
            let changed = 0;
            for (const vendor of unlabelled) {
                const set = { source: "seed", approvedAt: (_a = vendor.approvedAt) !== null && _a !== void 0 ? _a : now };
                if (vendor.status === undefined)
                    set.status = "active";
                if (vendor.ownerUserId === undefined)
                    set.ownerUserId = null;
                const result = yield collection.updateOne({ _id: vendor._id, source: { $exists: false } }, { $set: set });
                changed += result.modifiedCount;
            }
            console.log(`\nLabelled ${changed} profile(s).`);
        }
        yield mongoose_1.default.disconnect();
    });
}
run().catch((error) => {
    console.error("Backfill failed:", error);
    process.exit(1);
});
