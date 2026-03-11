const mongoose = require("mongoose");

const parseSubdomain = (hostHeader = "") => {
  const host = hostHeader.split(":")[0].toLowerCase();
  if (!host || host === "localhost") return null;

  const parts = host.split(".");
  if (parts.length < 3) return null;

  const sub = parts[0];
  if (["www", "api"].includes(sub)) return null;
  return sub;
};

const resolveVendorContext = (req, res, next) => {
  const headerVendorId = req.headers["x-vendor-id"];
  const vendorFromHeader = typeof headerVendorId === "string" ? headerVendorId.trim() : "";
  const subdomainVendor = parseSubdomain(req.headers.host || "");

  if (vendorFromHeader && !mongoose.Types.ObjectId.isValid(vendorFromHeader)) {
    return res.status(400).json({ message: "Invalid x-vendor-id header" });
  }

  const userVendorId = req.user?.vendorId ? String(req.user.vendorId) : null;
  const userRole = req.user?.role;

  if (userRole !== "super_admin" && vendorFromHeader && userVendorId && vendorFromHeader !== userVendorId) {
    return res.status(403).json({ message: "Forbidden: vendor mismatch" });
  }

  const effectiveVendorId = vendorFromHeader || userVendorId || null;

  if (userRole !== "super_admin" && !effectiveVendorId) {
    return res.status(400).json({ message: "Vendor context is required" });
  }

  req.vendorId = effectiveVendorId;
  req.vendorSlug = subdomainVendor;
  return next();
};

const vendorFilter = (req, baseFilter = {}) => {
  // Super admin can query cross-vendor unless they explicitly set x-vendor-id.
  if (req.user?.role === "super_admin" && !req.vendorId) {
    return { ...baseFilter };
  }

  return {
    ...baseFilter,
    vendorId: req.vendorId
  };
};

module.exports = { resolveVendorContext, vendorFilter };
