require("dotenv").config();
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");

const { DB_USER, DB_PASS, DB_HOST, DB_NAME } = process.env;

const ProductSchema = new mongoose.Schema({
  _id: Number,
  description: String,
  actualPrice: Number,
  discountPrice: Number,
  rating: Number,
  imageUrl: [String],
});
const Products = mongoose.model("productData", ProductSchema);

const ServiceOptionSchema = new mongoose.Schema(
  {
    id: String,
    name: String,
    description: String,
    price: Number,
    unit: String,
    materialTag: String,
    estimatedDays: Number,
    popular: Boolean,
    imageUrl: String,
    includes: [String],
  },
  { _id: false },
);

const ServiceCategorySchema = new mongoose.Schema(
  {
    id: String,
    label: String,
    icon: String,
    services: [ServiceOptionSchema],
  },
  { _id: false },
);

const VendorDetailSchema = new mongoose.Schema({
  id: String,
  name: String,
  tagline: String,
  rating: Number,
  reviewCount: Number,
  completedProjects: Number,
  yearsActive: Number,
  location: String,
  responseTime: String,
  verified: Boolean,
  badges: [String],
  categories: [ServiceCategorySchema],
});
const VendorDetails = mongoose.model(
  "vendorDetails",
  VendorDetailSchema,
  "vendorDetails",
);

const UserSchema = new mongoose.Schema({
  userName: String,
  userEmail: String,
  userPassword: String,
  userId: Number,
  connections: [{ userId: Number, status: String }],
  address: {
    contactName: String,
    phone: String,
    line1: String,
    line2: String,
    city: String,
    state: String,
    pincode: String,
  },
});
const Users = mongoose.model("users", UserSchema, "users");

const OrderItemSchema = new mongoose.Schema(
  {
    serviceId: String,
    name: String,
    description: String,
    price: Number,
    unit: String,
    quantity: Number,
    categoryLabel: String,
    imageUrl: String,
  },
  { _id: false },
);
const OrderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    userId: Number,
    userEmail: { type: String, required: true },
    userName: String,
    vendorId: { type: String, required: true },
    vendorName: String,
    items: [OrderItemSchema],
    subtotal: Number,
    total: Number,
    address: {
      contactName: String,
      phone: String,
      line1: String,
      line2: String,
      city: String,
      state: String,
      pincode: String,
    },
    status: { type: String, required: true, default: "PLACED" },
    statusHistory: [
      { status: String, note: String, changedAt: Date },
    ],
    shiprocket: {
      orderId: String,
      shipmentId: String,
      awbCode: String,
      courierName: String,
      trackingUrl: String,
      status: String,
    },
  },
  { timestamps: true },
);
const Orders = mongoose.model("orders", OrderSchema, "orders");

const DEMO_USER_EMAIL = "mdaseem459@gmail.com";
const DEMO_ADDRESS = {
  contactName: "Mohammed Aseem",
  phone: "9876543210",
  line1: "221B Koramangala 5th Block",
  line2: "Near Sony World Signal",
  city: "Bengaluru",
  state: "Karnataka",
  pincode: "560095",
};

function hoursAgo(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function toOrderItem(service, categoryLabel, quantity) {
  return {
    serviceId: service.id,
    name: service.name,
    description: service.description,
    price: service.price,
    unit: service.unit,
    quantity,
    categoryLabel,
    imageUrl: service.imageUrl,
  };
}

function buildDemoOrders(user, vendorDetails) {
  const [vendorA, vendorB] = vendorDetails;
  if (!vendorA) return [];

  const vendorAItems = [
    toOrderItem(
      vendorA.categories[0].services[0],
      vendorA.categories[0].label,
      2,
    ),
  ];
  const vendorATotal = vendorAItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  const vendorBItems = vendorB
    ? [
        toOrderItem(
          vendorB.categories[0].services[0],
          vendorB.categories[0].label,
          1,
        ),
      ]
    : vendorAItems;
  const vendorBTotal = vendorBItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  const baseOrder = {
    userId: user.userId,
    userEmail: user.userEmail,
    userName: user.userName,
    address: DEMO_ADDRESS,
  };

  return [
    {
      ...baseOrder,
      orderNumber: "GR-DEMO0001",
      vendorId: vendorA.id,
      vendorName: vendorA.name,
      items: vendorAItems,
      subtotal: vendorATotal,
      total: vendorATotal,
      status: "PLACED",
      statusHistory: [
        { status: "PLACED", changedAt: hoursAgo(2) },
      ],
      shiprocket: null,
    },
    {
      ...baseOrder,
      orderNumber: "GR-DEMO0002",
      vendorId: vendorA.id,
      vendorName: vendorA.name,
      items: vendorAItems,
      subtotal: vendorATotal,
      total: vendorATotal,
      status: "SHIPMENT_CREATED",
      statusHistory: [
        { status: "PLACED", changedAt: hoursAgo(48) },
        { status: "APPROVED", changedAt: hoursAgo(40) },
        {
          status: "SHIPMENT_CREATED",
          note: "Shiprocket shipment created automatically on approval",
          changedAt: hoursAgo(39),
        },
      ],
      shiprocket: {
        orderId: "SR-DEMO-1002",
        shipmentId: "SH-DEMO-1002",
        courierName: "Delhivery",
        trackingUrl: "https://shiprocket.co/tracking/SR-DEMO-1002",
        status: "created",
      },
    },
    {
      ...baseOrder,
      orderNumber: "GR-DEMO0003",
      vendorId: vendorB ? vendorB.id : vendorA.id,
      vendorName: vendorB ? vendorB.name : vendorA.name,
      items: vendorBItems,
      subtotal: vendorBTotal,
      total: vendorBTotal,
      status: "IN_TRANSIT",
      statusHistory: [
        { status: "PLACED", changedAt: hoursAgo(96) },
        { status: "APPROVED", changedAt: hoursAgo(90) },
        { status: "SHIPMENT_CREATED", changedAt: hoursAgo(89) },
        { status: "PICKUP_SCHEDULED", changedAt: hoursAgo(72) },
        { status: "IN_TRANSIT", changedAt: hoursAgo(24) },
      ],
      shiprocket: {
        orderId: "SR-DEMO-1003",
        shipmentId: "SH-DEMO-1003",
        awbCode: "AWB-DEMO-1003",
        courierName: "Bluedart",
        trackingUrl: "https://shiprocket.co/tracking/SR-DEMO-1003",
        status: "in transit",
      },
    },
    {
      ...baseOrder,
      orderNumber: "GR-DEMO0004",
      vendorId: vendorA.id,
      vendorName: vendorA.name,
      items: vendorAItems,
      subtotal: vendorATotal,
      total: vendorATotal,
      status: "DELIVERED",
      statusHistory: [
        { status: "PLACED", changedAt: hoursAgo(240) },
        { status: "APPROVED", changedAt: hoursAgo(230) },
        { status: "SHIPMENT_CREATED", changedAt: hoursAgo(229) },
        { status: "PICKUP_SCHEDULED", changedAt: hoursAgo(200) },
        { status: "IN_TRANSIT", changedAt: hoursAgo(150) },
        { status: "DELIVERED", changedAt: hoursAgo(100) },
      ],
      shiprocket: {
        orderId: "SR-DEMO-1004",
        shipmentId: "SH-DEMO-1004",
        awbCode: "AWB-DEMO-1004",
        courierName: "Delhivery",
        trackingUrl: "https://shiprocket.co/tracking/SR-DEMO-1004",
        status: "delivered",
      },
    },
    {
      ...baseOrder,
      orderNumber: "GR-DEMO0005",
      vendorId: vendorB ? vendorB.id : vendorA.id,
      vendorName: vendorB ? vendorB.name : vendorA.name,
      items: vendorBItems,
      subtotal: vendorBTotal,
      total: vendorBTotal,
      status: "REJECTED",
      statusHistory: [
        { status: "PLACED", changedAt: hoursAgo(72) },
        {
          status: "REJECTED",
          note: "Vendor is fully booked for the requested timeline",
          changedAt: hoursAgo(60),
        },
      ],
      shiprocket: null,
    },
  ];
}

async function seedOrders(vendorDetails) {
  const user = await Users.findOne({ userEmail: DEMO_USER_EMAIL });
  if (!user) {
    console.log(
      `Skipping order seeding — no user found with email ${DEMO_USER_EMAIL}. Sign up with that email first.`,
    );
    return;
  }

  const demoOrders = buildDemoOrders(user, vendorDetails);
  for (const order of demoOrders) {
    await Orders.updateOne(
      { orderNumber: order.orderNumber },
      { $set: order },
      { upsert: true },
    );
  }
  console.log(`Seeded ${demoOrders.length} demo orders for ${DEMO_USER_EMAIL}`);
}

async function seed() {
  await mongoose.connect(
    `mongodb+srv://${DB_USER}:${DB_PASS}@${DB_HOST}/${DB_NAME}`,
  );
  console.log("Connected to MongoDB Atlas");

  const vendors = JSON.parse(
    fs.readFileSync(path.join(__dirname, "vendors.seed.json"), "utf-8"),
  );
  const vendorDetails = JSON.parse(
    fs.readFileSync(path.join(__dirname, "vendorDetails.seed.json"), "utf-8"),
  );

  for (const vendor of vendors) {
    await Products.updateOne(
      { _id: vendor._id },
      { $set: vendor },
      { upsert: true },
    );
  }
  console.log(`Seeded ${vendors.length} products into "productdatas"`);

  for (const detail of vendorDetails) {
    await VendorDetails.updateOne(
      { id: detail.id },
      { $set: detail },
      { upsert: true },
    );
  }
  console.log(`Seeded ${vendorDetails.length} vendor details into "vendorDetails"`);

  await seedOrders(vendorDetails);

  await mongoose.disconnect();
  console.log("Done.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
