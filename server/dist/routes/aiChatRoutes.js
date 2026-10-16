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
const express_1 = __importDefault(require("express"));
const groq_sdk_1 = __importDefault(require("groq-sdk"));
const vendorDetailModel_1 = require("../models/vendorDetailModel");
const vendorVisibility_1 = require("../services/vendorVisibility");
const featureFlags_1 = require("../services/featureFlags");
const shopCatalogue_1 = require("../services/shopCatalogue");
const textSafety_1 = require("../services/textSafety");
const productModel_1 = require("../models/productModel");
const router = express_1.default.Router();
let client = null;
function getClient() {
    if (!client) {
        client = new groq_sdk_1.default({ apiKey: process.env.GROQ_API_KEY });
    }
    return client;
}
function getModel() {
    return process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
}
const SERVICES_PROMPT = "You are the Go Renovate assistant, embedded in a home-renovation marketplace app. " +
    "Help users find renovation vendors, compare services, and understand pricing using the tools available to you. " +
    "Only answer from tool results — do not invent vendors, services, or prices. " +
    "Keep responses concise and focused on what the user asked.";
// Shop mode (services switched off): vendors sell products, not services.
const SHOP_PROMPT = "You are the Go Renovate assistant, embedded in a home furnishing marketplace app where vendors sell products " +
    "(furniture, lighting, rugs, decor). Help users find vendors and compare their products and prices using the tools " +
    "available to you. The app does not offer renovation services right now, so do not suggest booking any. " +
    "Only answer from tool results — do not invent vendors, products, or prices. " +
    "Keep responses concise and focused on what the user asked.";
function systemPrompt() {
    return (0, featureFlags_1.servicesEnabled)() ? SERVICES_PROMPT : SHOP_PROMPT;
}
const TOOL_DEFINITIONS = [
    {
        type: "function",
        function: {
            name: "search_vendors",
            description: "Search renovation vendors by name, location, or service category. Call this whenever the user asks to find, browse, or compare vendors/contractors.",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "Free-text match against the vendor's name or tagline",
                    },
                    location: {
                        type: "string",
                        description: "bellandur",
                    },
                    category: {
                        type: "string",
                        description: "Service category label to filter by, e.g. 'Painting', 'Plumbing', 'Flooring'",
                    },
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_vendor_services",
            description: "Get the full list of service categories and priced service options offered by one vendor, looked up by vendor id. " +
                "Call this after search_vendors when the user wants pricing or details for a specific vendor.",
            parameters: {
                type: "object",
                properties: {
                    vendorId: {
                        type: "string",
                        description: "The vendor's id, as returned by search_vendors",
                    },
                },
                required: ["vendorId"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "search_products",
            description: "Search renovation products/materials by description text and an optional max price. " +
                "Call this when the user asks about materials or products rather than vendor services.",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "Free-text match against the product description",
                    },
                    maxPrice: {
                        type: "number",
                        description: "Maximum discount price, in rupees",
                    },
                },
            },
        },
    },
];
function runSearchVendors(input) {
    return __awaiter(this, void 0, void 0, function* () {
        const extra = {};
        // The model supplies these strings, so they are treated as untrusted text: escaped, length-capped,
        // and matched literally (never as a regex).
        const query = (0, textSafety_1.safeContainsFilter)(input.query);
        if (query) {
            extra.$or = [{ name: query }, { tagline: query }];
        }
        const location = (0, textSafety_1.safeContainsFilter)(input.location);
        if (location) {
            extra.location = location;
        }
        const category = (0, textSafety_1.safeContainsFilter)(input.category);
        if (category) {
            if ((0, featureFlags_1.servicesEnabled)()) {
                extra["categories.label"] = category;
            }
            else {
                // Shop mode: "category" matches a product's name or type (Sofa, Lighting...).
                extra.id = { $in: yield (0, shopCatalogue_1.vendorIdsMatchingProducts)(new RegExp(category.$regex, "i")) };
            }
        }
        const found = yield vendorDetailModel_1.VendorDetails.find(yield (0, vendorVisibility_1.publicVendorQuery)(extra), { ownerUserId: 0 }).limit(10);
        const vendors = yield (0, shopCatalogue_1.presentVendors)(found);
        return JSON.stringify(vendors.map((v) => {
            var _a;
            return ({
                id: v.id,
                name: v.name,
                tagline: v.tagline,
                rating: v.rating,
                reviewCount: v.reviewCount,
                location: v.location,
                verified: v.verified,
                badges: v.badges,
                categories: (_a = v.categories) === null || _a === void 0 ? void 0 : _a.map((c) => c.label),
            });
        }));
    });
}
function runGetVendorServices(input) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        const found = yield vendorDetailModel_1.VendorDetails.findOne(yield (0, vendorVisibility_1.publicVendorQuery)({ id: String(input.vendorId) }), { ownerUserId: 0 });
        if (!found) {
            return JSON.stringify({ error: "Vendor not found" });
        }
        const [vendor] = (yield (0, shopCatalogue_1.presentVendors)([found]));
        if (!(0, featureFlags_1.servicesEnabled)()) {
            return JSON.stringify({
                id: vendor.id,
                name: vendor.name,
                categories: (_a = vendor.categories) === null || _a === void 0 ? void 0 : _a.map((c) => {
                    var _a;
                    return ({
                        label: c.label,
                        products: (_a = c.services) === null || _a === void 0 ? void 0 : _a.map((p) => ({
                            name: p.name,
                            description: p.description,
                            price: p.price,
                            inStock: p.isAvailable,
                        })),
                    });
                }),
            });
        }
        return JSON.stringify({
            id: vendor.id,
            name: vendor.name,
            categories: (_b = vendor.categories) === null || _b === void 0 ? void 0 : _b.map((c) => {
                var _a;
                return ({
                    label: c.label,
                    services: (_a = c.services) === null || _a === void 0 ? void 0 : _a.map((s) => ({
                        name: s.name,
                        description: s.description,
                        price: s.price,
                        unit: s.unit,
                        estimatedDays: s.estimatedDays,
                        popular: s.popular,
                    })),
                });
            }),
        });
    });
}
function runSearchProducts(input) {
    return __awaiter(this, void 0, void 0, function* () {
        const filter = {};
        const query = (0, textSafety_1.safeContainsFilter)(input.query);
        if (query) {
            filter.description = query;
        }
        if (typeof input.maxPrice === "number") {
            filter.discountPrice = { $lte: input.maxPrice };
        }
        const products = yield productModel_1.Products.find(filter).limit(10);
        return JSON.stringify(products.map((p) => ({
            id: p._id,
            description: p.description,
            actualPrice: p.actualPrice,
            discountPrice: p.discountPrice,
            rating: p.rating,
        })));
    });
}
const TOOL_HANDLERS = {
    search_vendors: runSearchVendors,
    get_vendor_services: runGetVendorServices,
    search_products: runSearchProducts,
};
// Hard cap on model <-> tool round trips for a single request, so a model
// that keeps requesting tools without ever settling on an answer can't hang
// the request indefinitely.
const MAX_TOOL_TURNS = 5;
router.post("/chat", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "messages array is required" });
    }
    const conversation = [
        { role: "system", content: systemPrompt() },
        ...messages,
    ];
    try {
        let reply = "";
        for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
            const completion = yield getClient().chat.completions.create({
                model: getModel(),
                max_tokens: 1024,
                messages: conversation,
                tools: TOOL_DEFINITIONS,
                tool_choice: "auto",
            });
            const message = (_a = completion.choices[0]) === null || _a === void 0 ? void 0 : _a.message;
            if (!message) {
                break;
            }
            conversation.push(message);
            if (!message.tool_calls || message.tool_calls.length === 0) {
                reply = message.content || "";
                break;
            }
            for (const toolCall of message.tool_calls) {
                const handler = TOOL_HANDLERS[toolCall.function.name];
                let result;
                if (!handler) {
                    result = JSON.stringify({ error: "Unknown tool" });
                }
                else {
                    try {
                        const args = JSON.parse(toolCall.function.arguments || "{}");
                        result = yield handler(args);
                    }
                    catch (toolError) {
                        console.error("AI chat tool error:", toolError);
                        result = JSON.stringify({ error: "Tool execution failed" });
                    }
                }
                conversation.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: result,
                });
            }
        }
        if (!reply) {
            reply =
                "Sorry, I couldn't put together an answer for that — could you rephrase?";
        }
        return res.json({ reply, messages: conversation.slice(1) });
    }
    catch (error) {
        console.error("AI chat error:", error);
        return res.status(500).json({ error: "Failed to get AI response" });
    }
}));
exports.default = router;
