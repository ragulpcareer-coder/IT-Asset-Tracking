const Ticket = require("../models/Ticket");
const Asset = require("../models/Asset");
const AuditLog = require("../models/AuditLog");
const { sendError, sendSuccess } = require("../utils/apiResponse");

const privilegedRoles = ["Super Admin", "Admin", "Manager", "Security Auditor"];

const getTickets = async (req, res) => {
    try {
        const filters = {};
        if (!privilegedRoles.includes(req.user.role)) {
            filters.reportedBy = req.user._id;
        }

        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

        const [tickets, total] = await Promise.all([
            Ticket.find(filters)
                .populate("assetId", "name serialNumber")
                .populate("reportedBy", "name email")
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            Ticket.countDocuments(filters),
        ]);

        return sendSuccess(res, 200, "Tickets fetched successfully", {
            tickets,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
        });
    } catch (error) {
        return sendError(res, 500, "Failed to fetch tickets");
    }
};

const createTicket = async (req, res) => {
    try {
        const { assetId, title, description, priority } = req.body;

        const asset = await Asset.findById(assetId).select("serialNumber status");
        if (!asset) return sendError(res, 404, "Asset not found", { assetId: "invalid_asset" });

        const ticket = await Ticket.create({
            assetId,
            reportedBy: req.user._id,
            title,
            description,
            priority,
            status: "Open"
        });

        asset.status = "maintenance";
        await asset.save();

        await AuditLog.create({
            action: "Ticket Created",
            performedBy: req.user.email,
            details: `Reported issue: ${title} for asset ${asset.serialNumber}`,
            ip: req.ip || req.connection.remoteAddress,
        });

        return sendSuccess(res, 201, "Ticket created successfully.", { ticket });
    } catch (error) {
        return sendError(res, 500, "Failed to create ticket");
    }
};

const updateTicket = async (req, res) => {
    try {
        const { status, repairCost } = req.body;
        const ticket = await Ticket.findById(req.params.id);
        if (!ticket) return sendError(res, 404, "Ticket not found", { id: "invalid_ticket" });

        ticket.status = status || ticket.status;
        if (repairCost !== undefined) ticket.repairCost = repairCost;
        await ticket.save();

        if (ticket.status === "Resolved" || ticket.status === "Closed") {
            const asset = await Asset.findById(ticket.assetId).select("status");
            if (asset && asset.status === "maintenance") {
                asset.status = "available";
                await asset.save();
            }
        }

        await AuditLog.create({
            action: "Ticket Updated",
            performedBy: req.user.email,
            details: `Ticket ${ticket._id} updated to ${ticket.status}`,
            ip: req.ip || req.connection.remoteAddress,
        });

        return sendSuccess(res, 200, "Ticket updated successfully.", { ticket });
    } catch (error) {
        return sendError(res, 500, "Failed to update ticket");
    }
};

module.exports = {
    getTickets,
    createTicket,
    updateTicket,
};
