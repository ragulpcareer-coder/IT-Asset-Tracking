const Asset = require("../models/Asset");
const AuditLog = require("../models/AuditLog");


// GET all assets with pagination, sorting, and filtering
const getAssets = async (req, res) => {
  try {
    const { search, status, type, sort } = req.query;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const query = {};

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    if (status && status !== "All") {
      query.status = status;
    }

    if (type && type !== "All") {
      query.type = type;
    }

    const sortOption = sort ? { [sort]: -1 } : { createdAt: -1 };

    const assets = await Asset.find(query)
      .sort(sortOption)
      .limit(limit)
      .skip((page - 1) * limit);

    const count = await Asset.countDocuments(query);

    res.json({
      assets,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      totalAssets: count,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch assets" });
  }
};

// CREATE asset
const createAsset = async (req, res) => {
  try {
    const asset = await Asset.create(req.body);

    await AuditLog.create({
      action: `Created asset: ${asset.name}`,
      performedBy: req.user?.email || "Unknown",
    });

    // Real-time update
    const io = req.app.get("io");
    io.emit("assetCreated", asset);

    res.status(201).json(asset);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE asset
const updateAsset = async (req, res) => {
  try {
    const updatedAsset = await Asset.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!updatedAsset) {
      return res.status(404).json({ message: "Asset not found" });
    }

    await AuditLog.create({
      action: `Updated asset: ${updatedAsset.name}`,
      performedBy: req.user?.email || "Unknown",
    });

    // Real-time update
    const io = req.app.get("io");
    io.emit("assetUpdated", updatedAsset);

    res.json(updatedAsset);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE asset
const deleteAsset = async (req, res) => {
  try {
    const asset = await Asset.findByIdAndDelete(req.params.id);

    if (!asset) {
      return res.status(404).json({ message: "Asset not found" });
    }

    await AuditLog.create({
      action: `Deleted asset: ${asset?.name}`,
      performedBy: req.user?.email || "Unknown",
    });

    // Real-time update
    const io = req.app.get("io");
    io.emit("assetDeleted", req.params.id);

    res.json({ message: "Asset deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAssets,
  createAsset,
  updateAsset,
  deleteAsset,
};
