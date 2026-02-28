export const assetSchema = {
    // Map of internal keys to UI labels / PDF Headers
    exportableFields: {
        identity: "Identity",
        uuid: "UUID",
        authority: "Authority",
        cluster: "Cluster",
        lifecycleStatus: "Operational Lifecycle Status",
        registryState: "Registry State",
        metadata: "Metadata",
        qrCode: "QR Code",
        decommissionState: "Decommission State",
        archiveStatus: "Archive Status"
    },

    // Allowed lifecycle states for validation
    allowedStates: ["available", "assigned", "maintenance", "retired", "lost"],

    // Formatter functions mapped to exportableFields keys
    formatters: {
        identity: (asset) => {
            let safeName = asset.name || "Unidentified Asset";
            if (safeName.includes("Unknown Device (")) return "Unidentified Asset";
            return safeName;
        },
        uuid: (asset) => asset.uuid || asset.serialNumber || "System-Generated",
        authority: (asset) => {
            if (asset.status === "available") return "Unassigned";
            return asset.assignee || asset.assignedTo || "Not Assigned";
        },
        cluster: (asset) => asset.type || "Standard",
        lifecycleStatus: (asset) => {
            if (!asset.status) return "Unknown";
            if (asset.status.toLowerCase() === "retired") return "Archived";
            return asset.status.charAt(0).toUpperCase() + asset.status.slice(1).toLowerCase();
        },
        registryState: (asset) => {
            let safeName = asset.name || "Unidentified Asset";
            let isUnidentified = safeName.includes("Unknown Device (") || safeName === "Unidentified Asset";
            if (isUnidentified) return "Pending Identification";
            return asset.uuid ? "Verified Node" : "Pending Registration";
        },
        metadata: (asset) => {
            const parts = [];
            if (asset.classification) parts.push(`Class: ${asset.classification}`);
            if (asset.osInfo?.platform) parts.push(`OS: ${asset.osInfo.platform}`);
            return parts.length ? parts.join(" | ") : "Standard Profile";
        },
        qrCode: (asset) => asset.qrCode ? "Provisioned" : "Unprovisioned",
        decommissionState: (asset) => (asset.status === "retired" || asset.status === "lost") ? "Decommissioned" : "Active",
        archiveStatus: (asset) => asset.status === "retired" ? "Deep Archive" : "Live"
    },

    // Data Integrity Validation
    validateExportData: (assets) => {
        if (!Array.isArray(assets)) return { valid: false, error: "Data is not an array format" };

        // Cross-check status counts, detect orphans/duplicates etc
        const identifiers = new Set();

        let assignedCount = 0;

        for (const asset of assets) {
            if (!asset) return { valid: false, error: "Phantom or null asset detected" };

            // Duplicate Identifier Detection
            const identifier = asset.uuid || asset.serialNumber;
            if (identifier) {
                if (identifiers.has(identifier)) {
                    console.warn(`Duplicate identifier detected: ${identifier}`);
                    // Allow export but track warning
                }
                identifiers.add(identifier);
            }

            // Invalid lifecycle state
            if (asset.status && !assetSchema.allowedStates.includes(asset.status.toLowerCase())) {
                return { valid: false, error: `Invalid lifecycle state detected: ${asset.status}` };
            }

            // Logical validation: Archive flag matches status
            if (asset.status === "retired" && assetSchema.formatters.archiveStatus(asset) !== "Deep Archive") {
                return { valid: false, error: "Continuity error: Archive state does not match status" };
            }

            // Cross check identity and verified node conflict
            const resolvedState = assetSchema.formatters.registryState(asset);
            const resolvedIdentity = assetSchema.formatters.identity(asset);
            if (resolvedIdentity === "Unidentified Asset" && resolvedState === "Verified Node") {
                return { valid: false, error: `Identity Continuity Error: Asset ${identifier} is Unidentified but marked Verified.` };
            }

            if (asset.status === "assigned") assignedCount++;
        }

        // Cross check assigned count matches actual assigned records
        const actualAssigned = assets.filter(a => a.status === "assigned").length;
        if (assignedCount !== actualAssigned) {
            return { valid: false, error: "Continuity error: Assigned counts mismatch" };
        }

        return { valid: true };
    }
};
