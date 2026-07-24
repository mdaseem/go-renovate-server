import express, { Request, Response, Router } from "express";
import Groq from "groq-sdk";
import { VendorDetails } from "../models/vendorDetailModel";
import { Products } from "../models/productModel";

const router: Router = express.Router();

let client: Groq | null = null;
function getClient(): Groq {
  if (!client) {
    client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return client;
}

function getModel(): string {
  return process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
}

const SYSTEM_PROMPT =
  "You are the Go Renovate assistant, embedded in a home-renovation marketplace app. " +
  "Help users find renovation vendors, compare services, and understand pricing using the tools available to you. " +
  "Only answer from tool results — do not invent vendors, services, or prices. " +
  "Keep responses concise and focused on what the user asked.";

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: {
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }[];
  tool_call_id?: string;
}

const TOOL_DEFINITIONS: Groq.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_vendors",
      description:
        "Search renovation vendors by name, location, or service category. Call this whenever the user asks to find, browse, or compare vendors/contractors.",
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
            description:
              "Service category label to filter by, e.g. 'Painting', 'Plumbing', 'Flooring'",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_vendor_services",
      description:
        "Get the full list of service categories and priced service options offered by one vendor, looked up by vendor id. " +
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
      description:
        "Search renovation products/materials by description text and an optional max price. " +
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

async function runSearchVendors(input: {
  query?: string;
  location?: string;
  category?: string;
}): Promise<string> {
  const filter: Record<string, unknown> = {};
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

  const vendors = await VendorDetails.find(filter).limit(10);
  return JSON.stringify(
    vendors.map((v: any) => ({
      id: v.id,
      name: v.name,
      tagline: v.tagline,
      rating: v.rating,
      reviewCount: v.reviewCount,
      location: v.location,
      verified: v.verified,
      badges: v.badges,
      categories: v.categories?.map((c: any) => c.label),
    })),
  );
}

async function runGetVendorServices(input: {
  vendorId: string;
}): Promise<string> {
  const vendor: any = await VendorDetails.findOne({ id: input.vendorId });
  if (!vendor) {
    return JSON.stringify({ error: "Vendor not found" });
  }
  return JSON.stringify({
    id: vendor.id,
    name: vendor.name,
    categories: vendor.categories?.map((c: any) => ({
      label: c.label,
      services: c.services?.map((s: any) => ({
        name: s.name,
        description: s.description,
        price: s.price,
        unit: s.unit,
        estimatedDays: s.estimatedDays,
        popular: s.popular,
      })),
    })),
  });
}

async function runSearchProducts(input: {
  query?: string;
  maxPrice?: number;
}): Promise<string> {
  const filter: Record<string, unknown> = {};
  if (input.query) {
    filter.description = { $regex: input.query, $options: "i" };
  }
  if (typeof input.maxPrice === "number") {
    filter.discountPrice = { $lte: input.maxPrice };
  }

  const products = await Products.find(filter).limit(10);
  return JSON.stringify(
    products.map((p: any) => ({
      id: p._id,
      description: p.description,
      actualPrice: p.actualPrice,
      discountPrice: p.discountPrice,
      rating: p.rating,
    })),
  );
}

const TOOL_HANDLERS: Record<string, (input: any) => Promise<string>> = {
  search_vendors: runSearchVendors,
  get_vendor_services: runGetVendorServices,
  search_products: runSearchProducts,
};

// Hard cap on model <-> tool round trips for a single request, so a model
// that keeps requesting tools without ever settling on an answer can't hang
// the request indefinitely.
const MAX_TOOL_TURNS = 5;

router.post("/chat", async (req: Request, res: Response) => {
  const { messages } = req.body as { messages?: ChatMessage[] };

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array is required" });
  }

  const conversation: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...messages,
  ];

  try {
    let reply = "";

    for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
      const completion = await getClient().chat.completions.create({
        model: getModel(),
        max_tokens: 1024,
        messages:
          conversation as Groq.Chat.Completions.ChatCompletionMessageParam[],
        tools: TOOL_DEFINITIONS,
        tool_choice: "auto",
      });

      const message = completion.choices[0]?.message;
      if (!message) {
        break;
      }
      conversation.push(message as ChatMessage);

      if (!message.tool_calls || message.tool_calls.length === 0) {
        reply = message.content || "";
        break;
      }

      for (const toolCall of message.tool_calls) {
        const handler = TOOL_HANDLERS[toolCall.function.name];
        let result: string;
        if (!handler) {
          result = JSON.stringify({ error: "Unknown tool" });
        } else {
          try {
            const args = JSON.parse(toolCall.function.arguments || "{}");
            result = await handler(args);
          } catch (toolError) {
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
  } catch (error) {
    console.error("AI chat error:", error);
    return res.status(500).json({ error: "Failed to get AI response" });
  }
});

export default router;
