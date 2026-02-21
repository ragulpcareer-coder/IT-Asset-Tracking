const Ticket = require("../models/Ticket");
const Asset = require("../models/Asset");
const AuditLog = require("../models/AuditLog");

// @desc    Get all tickets
// @route   GET /api/tickets
// @access  Private
const getTickets = async (req, res) => {
    try {
        const filters = {};
        if (req.user.role !== "Admin") {
            filters.reportedBy = req.user._id;
        }
        const tickets = await Ticket.find(filters).populate("assetId", "name serialNumber").populate("reportedBy", "name email").sort({ createdAt: -1 });
        res.json(tickets);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch tickets" });
    }
};

// @desc    Create a ticket
// @route   POST /api/tickets
// @access  Private
const createTicket = async (req, res) => {
    try {
        const { assetId, title, description, priority } = req.body;

        const asset = await Asset.findById(assetId);
        if (!asset) return res.status(404).json({ message: "Asset not found" });

        const ticket = await Ticket.create({
            assetId,
            reportedBy: req.user._id,
            title,
            description,
            priority,
            status: "Open"
        });

        // Automatically set asset to maintenance
        asset.status = "maintenance";
        await asset.save();

        await AuditLog.create({
            action: "Ticket Created",
            performedBy: req.user.email,
            details: `Reported issue: ${title} for asset ${asset.serialNumber}`,
            ip: req.ip || req.connection.remoteAddress,
        });

        res.status(201).json(ticket);
    } catch (error) {
        res.status(500).json({ message: "Failed to create ticket" });
    }
};

// @desc    Update ticket status (Admin)
// @route   PUT /api/tickets/:id
// @access  Private/Admin
const updateTicket = async (req, res) => {
    try {
        const { status, repairCost } = req.body;
        const ticket = await Ticket.findById(req.params.id);
        if (!ticket) return res.status(404).json({ message: "Ticket not found" });

        ticket.status = status || ticket.status;
        if (repairCost !== undefined) ticket.repairCost = repairCost;

        await ticket.save();

        if (ticket.status === "Resolved" || ticket.status === "Closed") {
            const asset = await Asset.findById(ticket.assetId);
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

        res.json(ticket);
    } catch (error) {
        res.status(500).json({ message: "Failed to update ticket" });
    }
};

module.exports = {
    getTickets,
    createTicket,
    updateTicket,
};
