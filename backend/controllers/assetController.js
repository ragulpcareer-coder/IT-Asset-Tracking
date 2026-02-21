const Asset = require("../models/Asset");
const AuditLog = require("../models/AuditLog");
const QRCode = require('qrcode');

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
    const assetData = req.body;
    // Generate QR Code containing the Serial Number (or a link to the asset)
    const qrData = JSON.stringify({
      id: "NEW", // Will be replaced by actual ID if we do it after save, but let's just use serialNumber
      serialNumber: assetData.serialNumber,
      name: assetData.name
    });
    const qrCodeDataUrl = await QRCode.toDataURL(qrData);
    assetData.qrCode = qrCodeDataUrl;

    const asset = await Asset.create(assetData);

    // Re-generate QR with actual ID
    const updatedQrData = JSON.stringify({
      id: asset._id,
      serialNumber: asset.serialNumber,
      name: asset.name
    });
    asset.qrCode = await QRCode.toDataURL(updatedQrData);
    await asset.save();

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
    const assetData = req.body;

    // Regenerate QR code just in case name or serial changed
    const qrData = JSON.stringify({
      id: req.params.id,
      serialNumber: assetData.serialNumber || "unknown",
      name: assetData.name || "unknown" // Might be undefined if partial update, but we assume full object
    });
    assetData.qrCode = await QRCode.toDataURL(qrData);

    const updatedAsset = await Asset.findByIdAndUpdate(
      req.params.id,
      assetData,
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

// EXPORT assets to CSV
const exportAssets = async (req, res) => {
  try {
    const { status, type } = req.query;
    const query = {};
    if (status && status !== "All") query.status = status;
    if (type && type !== "All") query.type = type;

    const assets = await Asset.find(query).sort({ createdAt: -1 }).lean();

    const fields = ['_id', 'name', 'type', 'serialNumber', 'status', 'assignedTo', 'purchaseDate', 'warrantyExpiry'];

    const escape = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v).replace(/"/g, '""');
      if (s.search(/[,"\n]/) >= 0) return `"${s}"`;
      return s;
    };

    const header = fields.join(',');
    const prepared = assets.map(a => ({
      _id: a._id.toString(),
      name: a.name,
      type: a.type,
      serialNumber: a.serialNumber,
      status: a.status,
      assignedTo: a.assignedTo || '',
      purchaseDate: a.purchaseDate ? new Date(a.purchaseDate).toISOString().split('T')[0] : '',
      warrantyExpiry: a.warrantyExpiry ? new Date(a.warrantyExpiry).toISOString().split('T')[0] : ''
    }));

    const body = prepared.map(r => fields.map(f => escape(r[f])).join(',')).join('\\n');
    const csv = header + '\\n' + body;

    res.header('Content-Type', 'text/csv');
    res.attachment(`assets-export-${Date.now()}.csv`);
    return res.send(csv);
  } catch (error) {
    res.status(500).json({ message: "Export failed" });
  }
};

const fs = require("fs");
const csv = require("csv-parser");

// BULK UPLOAD assets from CSV
const bulkUploadAssets = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const results = [];
    const errors = [];
    let successCount = 0;

    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", async () => {
        for (const row of results) {
          try {
            // validate required
            if (!row.name || !row.type || !row.serialNumber) {
              errors.push(`Row missing required fields: ${JSON.stringify(row)}`);
              continue;
            }

            // Check duplicate
            const exists = await Asset.findOne({ serialNumber: row.serialNumber });
            if (exists) {
              errors.push(`Duplicate Serial Number skipped: ${row.serialNumber}`);
              continue;
            }

            const qrData = JSON.stringify({
              id: "NEW",
              serialNumber: row.serialNumber,
              name: row.name
            });
            const qrCodeDataUrl = await QRCode.toDataURL(qrData);

            const newAsset = new Asset({
              name: row.name,
              type: row.type,
              serialNumber: row.serialNumber,
              status: row.status || "available",
              assignedTo: row.assignedTo || null,
              purchaseDate: row.purchaseDate ? new Date(row.purchaseDate) : Date.now(),
              purchasePrice: row.purchasePrice ? parseFloat(row.purchasePrice) : 0,
              salvageValue: row.salvageValue ? parseFloat(row.salvageValue) : 0,
              usefulLifeYears: row.usefulLifeYears ? parseInt(row.usefulLifeYears) : 5,
              qrCode: qrCodeDataUrl
            });

            await newAsset.save();

            // update qr id
            newAsset.qrCode = await QRCode.toDataURL(JSON.stringify({
              id: newAsset._id,
              serialNumber: newAsset.serialNumber,
              name: newAsset.name
            }));
            await newAsset.save();

            successCount++;
          } catch (err) {
            errors.push(`Failed on row ${row.serialNumber}: ${err.message}`);
          }
        }

        // Clean up temp file
        fs.unlinkSync(req.file.path);

        await AuditLog.create({
          action: "Bulk Uploaded Assets",
          performedBy: req.user?.email || "Unknown",
          details: `Uploaded ${successCount} assets. Errors: ${errors.length}`,
        });

        // Broadcast to clients
        const io = req.app.get("io");
        io.emit("bulkAssetsUploaded");

        res.json({
          message: `Successfully processed ${successCount} assets`,
          errors
        });
      });
  } catch (error) {
    res.status(500).json({ message: "Bulk upload failed" });
  }
};

module.exports = {
  getAssets,
  createAsset,
  updateAsset,
  deleteAsset,
  exportAssets,
  bulkUploadAssets,
};
