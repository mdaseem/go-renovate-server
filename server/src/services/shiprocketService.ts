import axios, { AxiosError } from "axios";

const SHIPROCKET_BASE_URL = "https://apiv2.shiprocket.in/v1/external";
const REQUEST_TIMEOUT_MS = 10_000;

export class ShiprocketNotConfiguredError extends Error {
  constructor() {
    super("Shiprocket credentials are not configured");
    this.name = "ShiprocketNotConfiguredError";
  }
}

export class ShiprocketApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ShiprocketApiError";
    this.status = status;
  }
}

function toShiprocketApiError(error: unknown, context: string): ShiprocketApiError {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ message?: string }>;
    const status = axiosError.response?.status;
    const body = axiosError.response?.data;
    console.error(`Shiprocket ${context} failed:`, status, body || axiosError.message);
    return new ShiprocketApiError(
      body?.message || axiosError.message || `Shiprocket ${context} failed`,
      status,
    );
  }
  console.error(`Shiprocket ${context} failed:`, error);
  return new ShiprocketApiError(`Shiprocket ${context} failed`);
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

let cachedToken: CachedToken | null = null;

function isConfigured(): boolean {
  return Boolean(
    process.env.SHIPROCKET_EMAIL && process.env.SHIPROCKET_PASSWORD,
  );
}

async function getToken(forceRefresh = false): Promise<string> {
  if (!isConfigured()) {
    throw new ShiprocketNotConfiguredError();
  }

  if (!forceRefresh && cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  try {
    const response = await axios.post(
      `${SHIPROCKET_BASE_URL}/auth/login`,
      {
        email: process.env.SHIPROCKET_EMAIL,
        password: process.env.SHIPROCKET_PASSWORD,
      },
      { timeout: REQUEST_TIMEOUT_MS },
    );

    const token: string = response.data.token;
    // Shiprocket tokens are valid ~10 days; refresh a little early to be safe.
    cachedToken = { token, expiresAt: Date.now() + 9 * 24 * 60 * 60 * 1000 };
    return token;
  } catch (error) {
    cachedToken = null;
    throw toShiprocketApiError(error, "authentication");
  }
}

interface OrderItemForShipment {
  serviceId: string;
  name: string;
  price: number;
  quantity: number;
}

interface OrderAddressForShipment {
  contactName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
}

interface OrderForShipment {
  orderNumber: string;
  total: number;
  items: OrderItemForShipment[];
  address: OrderAddressForShipment;
}

export interface ShiprocketShipmentResult {
  shiprocketOrderId: string;
  shipmentId: string;
}

// Renovation service line items don't have real parcel dimensions/weight —
// these nominal values only exist to satisfy Shiprocket's required schema
// for the adhoc-order payload.
const NOMINAL_WEIGHT_KG = 0.5;
const NOMINAL_DIMENSION_CM = 10;

function buildAdhocOrderPayload(order: OrderForShipment) {
  return {
    order_id: order.orderNumber,
    order_date: new Date().toISOString().slice(0, 19).replace("T", " "),
    pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION,
    billing_customer_name: order.address.contactName,
    billing_last_name: "",
    billing_address: order.address.line1,
    billing_address_2: order.address.line2 || "",
    billing_city: order.address.city,
    billing_state: order.address.state,
    billing_pincode: order.address.pincode,
    billing_country: "India",
    billing_phone: order.address.phone,
    shipping_is_billing: true,
    order_items: order.items.map((item) => ({
      name: item.name,
      sku: item.serviceId,
      units: item.quantity,
      selling_price: item.price,
    })),
    payment_method: "Prepaid",
    sub_total: order.total,
    length: NOMINAL_DIMENSION_CM,
    breadth: NOMINAL_DIMENSION_CM,
    height: NOMINAL_DIMENSION_CM,
    weight: NOMINAL_WEIGHT_KG,
  };
}

async function postAdhocOrder(order: OrderForShipment, token: string) {
  return axios.post(
    `${SHIPROCKET_BASE_URL}/orders/create/adhoc`,
    buildAdhocOrderPayload(order),
    { headers: { Authorization: `Bearer ${token}` }, timeout: REQUEST_TIMEOUT_MS },
  );
}

export async function createAdhocOrder(
  order: OrderForShipment,
): Promise<ShiprocketShipmentResult> {
  const token = await getToken();

  let response;
  try {
    response = await postAdhocOrder(order, token);
  } catch (error) {
    // A cached token can go stale server-side (revoked/expired early) —
    // retry once with a fresh one before giving up.
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const freshToken = await getToken(true);
      try {
        response = await postAdhocOrder(order, freshToken);
      } catch (retryError) {
        throw toShiprocketApiError(retryError, "order creation");
      }
    } else {
      throw toShiprocketApiError(error, "order creation");
    }
  }

  const data = response.data;
  return {
    shiprocketOrderId: String(data.order_id),
    shipmentId: String(data.shipment_id),
  };
}
