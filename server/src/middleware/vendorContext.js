const SINGLE_SYSTEM_VENDOR_ID = "000000000000000000000001";

const resolveVendorContext = (req, res, next) => {
  // Single-system mode: keep a stable vendorId for compatibility with legacy schemas,
  // but do not treat requests as tenant-scoped.
  req.vendorId = SINGLE_SYSTEM_VENDOR_ID;
  req.vendorSlug = null;
  return next();
};

const vendorFilter = (req, baseFilter = {}) => {
  // Single-system mode: tenant filtering is disabled globally.
  return { ...baseFilter };
};

module.exports = { resolveVendorContext, vendorFilter };
