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
const SYSTEM_PROMPT = "You are the Go Renovate assistant, embedded in a home-renovation marketplace app. " +
    "Help users find renovation vendors, compare services, and understand pricing using the tools available to you. " +
    "Only answer from tool results — do not invent vendors, services, or prices. " +
    "Keep responses concise and focused on what the user asked.";
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
        const filter = {};
        if (input.query) {
            filter.$or = [
                { name: { $regex: input.query, $options: "i" } },
                { tagline: { $regex: input.query, $options: "i" } },
            ];
        }
        if (input.location) {
            filter.location = { $regex: input.location, $options: "i" };
        }
        if (input.category) {
            filter["categories.label"] = { $regex: input.category, $options: "i" };
        }
        const vendors = yield vendorDetailModel_1.VendorDetails.find(filter).limit(10);
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
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const vendor = yield vendorDetailModel_1.VendorDetails.findOne({ id: input.vendorId });
        if (!vendor) {
            return JSON.stringify({ error: "Vendor not found" });
        }
        return JSON.stringify({
            id: vendor.id,
            name: vendor.name,
            categories: (_a = vendor.categories) === null || _a === void 0 ? void 0 : _a.map((c) => {
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
        if (input.query) {
            filter.description = { $regex: input.query, $options: "i" };
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
        { role: "system", content: SYSTEM_PROMPT },
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
