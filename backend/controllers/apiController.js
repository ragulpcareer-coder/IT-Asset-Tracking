const ApiKey = require("../models/ApiKey");
const AuditLog = require("../models/AuditLog");
const crypto = require("crypto");
const { sendError, sendSuccess } = require("../utils/apiResponse");

const getKeys = async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
        const filter = { createdBy: req.user._id };

        const [keys, total] = await Promise.all([
            ApiKey.find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            ApiKey.countDocuments(filter),
        ]);

        return sendSuccess(res, 200, "API keys fetched successfully", {
            keys,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
        });
    } catch (error) {
        return sendError(res, 500, "Failed to fetch API keys");
    }
};

const createKey = async (req, res) => {
    try {
        const { name } = req.body;
        const rawKey = `at_${crypto.randomBytes(32).toString("hex")}`;

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

        return sendSuccess(res, 201, "API key generated successfully", {
            key: { _id: apiKey._id, name: apiKey.name, key: apiKey.key, createdAt: apiKey.createdAt },
        });
    } catch (error) {
        return sendError(res, 500, "Failed to create API key");
    }
};

const revokeKey = async (req, res) => {
    try {
        const apiKey = await ApiKey.findById(req.params.id);
        if (!apiKey) return sendError(res, 404, "API key not found", { id: "invalid_api_key" });

        apiKey.revoked = true;
        await apiKey.save();

        await AuditLog.create({
            action: "API Key Revoked",
            performedBy: req.user.email,
            details: `Revoked API Key: ${apiKey.name}`,
            ip: req.ip || req.connection.remoteAddress,
        });

        return sendSuccess(res, 200, "API key revoked", { key: apiKey });
    } catch (error) {
        return sendError(res, 500, "Failed to revoke API key");
    }
};

module.exports = {
    getKeys,
    createKey,
    revokeKey
};
