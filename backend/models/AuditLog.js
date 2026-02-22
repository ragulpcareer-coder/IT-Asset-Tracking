const mongoose = require("mongoose");
const crypto = require("crypto");

const auditLogSchema = new mongoose.Schema(
    {
        action: {
            type: String,
            required: true,
        },
        performedBy: {
            type: String,
            required: true,
        },
        details: { type: String },
        ip: { type: String },
        resourceId: { type: mongoose.Schema.Types.Mixed },
        meta: { type: mongoose.Schema.Types.Mixed },
        hash: { type: String },
        previousHash: { type: String },
    },
    { timestamps: true }
);

// index to speed up queries by date
auditLogSchema.index({ createdAt: -1 });

// Cryptographic tamper-proofing sequence hash
auditLogSchema.pre("save", async function (next) {
    if (this.isNew) {
        try {
            const lastLog = await this.constructor.findOne().sort({ createdAt: -1 });
            this.previousHash = lastLog && lastLog.hash ? lastLog.hash : "GENESIS_HASH";

            const payload = `${this.action}|${this.performedBy}|${this.previousHash}|${new Date().getTime()}`;
            this.hash = crypto.createHash("sha256").update(payload).digest("hex");
        } catch (error) {
            return next(error);
        }
    }
    next();
});
// Immutable Log Policy (Enterprise Write-Once Logic)
auditLogSchema.pre(['update', 'updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'remove', 'deleteOne', 'deleteMany', 'findOneAndDelete', 'findOneAndRemove'], function (next) {
    throw new Error("SECURITY VIOLATION: Audit Logs are immutable and cannot be modified or deleted once written.");
});

module.exports = mongoose.model("AuditLog", auditLogSchema);
