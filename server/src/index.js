const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

// Load env files at startup (priority: server/.env.local -> server/.env -> root/.env)
const envCandidates = [
  path.resolve(__dirname, "../.env.local"),
  path.resolve(__dirname, "../.env"),
  path.resolve(__dirname, "../../.env")
];

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
}

const maskedEmailPass = process.env.EMAIL_PASS
  ? `${"*".repeat(Math.max(process.env.EMAIL_PASS.length - 2, 0))}${process.env.EMAIL_PASS.slice(-2)}`
  : "MISSING";
console.log(`[env] EMAIL_USER: ${process.env.EMAIL_USER || "MISSING"}`);
console.log(`[env] EMAIL_PASS: ${process.env.EMAIL_PASS ? `SET (${maskedEmailPass})` : "MISSING"}`);

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const connectDB = require("./config/db");

const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/products");
const customerRoutes = require("./routes/customers");
const invoiceRoutes = require("./routes/invoices");
const statsRoutes = require("./routes/stats");
const categoryRoutes = require("./routes/categories");
const userRoutes = require("./routes/users");
const settingsRoutes = require("./routes/settings");
const expenseRoutes = require("./routes/expenses");
const activityRoutes = require("./routes/activities");
const uploadRoutes = require("./routes/upload");
const reportsRoutes = require("./routes/reports");
const adminVendorsRoutes = require("./routes/adminVendors");

const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    credentials: true
  })
);
app.use(morgan("dev"));

// Serve static files (uploads)
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/users", userRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/activities", activityRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/admin/vendors", adminVendorsRoutes);

app.get("/", (req, res) => {
  res.json({ message: "Sohel Gadgets API is running" });
});

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB(process.env.MONGODB_URI);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });
};

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

