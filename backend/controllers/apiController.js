const ApiKey = require("../models/ApiKey");
const AuditLog = require("../models/AuditLog");
const crypto = require("crypto");

// @desc    Get all API keys
// @route   GET /api/keys
// @access  Private/Admin
const getKeys = async (req, res) => {
    try {
        const keys = await ApiKey.find({ createdBy: req.user._id }).sort({ createdAt: -1 });
        res.json(keys);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch API keys" });
    }
};

// @desc    Create an API key
// @route   POST /api/keys
// @access  Private/Admin
const createKey = async (req, res) => {
    try {
        const { name } = req.body;

        // Generate a secure payload key string
        const rawKey = `at_${crypto.randomBytes(32).toString('hex')}`;

        // Store raw key directly or hash it (since users only see it once). 
        // In production you hash the key and show it one time. Here we just store it raw for simplicity.
        const apiKey = await ApiKey.create({
            name,
            key: rawKey,
            createdBy: req.user._id,
        });

        await AuditLog.create({
            action: "API Key Created",
            performedBy: req.user.email,
            details: `Generated API Key: ${name}`,
            ip: req.ip || req.connection.remoteAddress,
        });

        res.status(201).json({ _id: apiKey._id, name: apiKey.name, key: apiKey.key, createdAt: apiKey.createdAt });
    } catch (error) {
        res.status(500).json({ message: "Failed to create API key" });
    }
};

// @desc    Revoke an API key
// @route   POST /api/keys/:id/revoke
// @access  Private/Admin
const revokeKey = async (req, res) => {
    try {
        const apiKey = await ApiKey.findById(req.params.id);
        if (!apiKey) return res.status(404).json({ message: "API key not found" });

        apiKey.revoked = true;
        await apiKey.save();

        await AuditLog.create({
            action: "API Key Revoked",
            performedBy: req.user.email,
            details: `Revoked API Key: ${apiKey.name}`,
            ip: req.ip || req.connection.remoteAddress,
        });

        res.json(apiKey);
    } catch (error) {
        res.status(500).json({ message: "Failed to revoke API key" });
    }
};

module.exports = {
    getKeys,
    createKey,
    revokeKey
};
