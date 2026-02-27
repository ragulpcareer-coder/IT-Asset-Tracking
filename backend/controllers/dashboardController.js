/**
 * Dashboard Metrics Controller
 * Provides consolidated operational KPI data for the Command Dashboard.
 *
 * Metrics:
 *  1. Active Assets       — Online (heartbeat ≤5 min) / Total
 *  2. Security Posture    — Weighted score: patch(40%) + MFA(30%) + encryption(30%)
 *  3. Active Incidents    — Open/In-Progress tickets (not Resolved/Closed)
 *  4. Audit Events (24h)  — Log entries in the last 24 hours
 *
 * Single endpoint: GET /api/dashboard/metrics
 * All queries run in parallel via Promise.all — no N+1, no blocking.
 */

const Asset = require('../models/Asset');
const Ticket = require('../models/Ticket');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');

/**
 * Security Posture Score (0–100)
 *
 * Component 1 — Patch Compliance (40%)
 *   Assets where networkStatus.lastSeen < 24h ago = "patched/active"
 *   Score = (patchedAssets / totalAssets) * 40
 *
 * Component 2 — MFA Adoption (30%)
 *   Score = (usersWithMFA / totalActiveUsers) * 30
 *
 * Component 3 — Encryption / Authorization (30%)
 *   Assets where securityStatus.isAuthorized = true = "compliant"
 *   Score = (authorizedAssets / totalAssets) * 30
 *
 * Returns 100 if no data (avoids alarming a fresh install).
 */
function computeSecurityPosture({ totalAssets, recentlySeenAssets, authorizedAssets, totalUsers, mfaUsers }) {
    if (totalAssets === 0 && totalUsers === 0) return 100; // fresh install

    const patchScore = totalAssets > 0
        ? (recentlySeenAssets / totalAssets) * 40
        : 40; // full marks if no assets yet

    const mfaScore = totalUsers > 0
        ? (mfaUsers / totalUsers) * 30
        : 30;

    const encryptionScore = totalAssets > 0
        ? (authorizedAssets / totalAssets) * 30
        : 30;

    return Math.round(patchScore + mfaScore + encryptionScore);
}

/**
 * GET /api/dashboard/metrics
 * Access: Private (all authenticated roles)
 */
const getDashboardMetrics = async (req, res) => {
    try {
        const now = new Date();
        const fiveMinAgo = new Date(now - 5 * 60 * 1000);       // online threshold
        const twentyFourHAgo = new Date(now - 24 * 60 * 60 * 1000); // patch / audit threshold

        // Run all DB queries in parallel — single round-trip cost
        const [
            totalAssets,
            onlineAssets,
            recentlySeenAssets,
            authorizedAssets,
            activeIncidents,
            auditEvents24h,
            totalActiveUsers,
            mfaUsers,
        ] = await Promise.all([

            // 1a. Total asset count
            Asset.countDocuments(),

            // 1b. Online = last heartbeat within 5 minutes
            Asset.countDocuments({
                'networkStatus.isOnline': true,
                'networkStatus.lastSeen': { $gte: fiveMinAgo }
            }),

            // 2a. Patch compliance proxy = lastSeen within 24h (agent reported recently)
            Asset.countDocuments({
                'networkStatus.lastSeen': { $gte: twentyFourHAgo }
            }),

            // 2b. Authorized assets (encryption/compliance component)
            Asset.countDocuments({
                'securityStatus.isAuthorized': true
            }),

            // 3. Active Incidents = tickets not yet resolved or closed
            Ticket.countDocuments({
                status: { $in: ['Open', 'In Progress'] }
            }),

            // 4. Audit events in last 24h — createdAt is already indexed
            AuditLog.countDocuments({
                createdAt: { $gte: twentyFourHAgo }
            }),

            // 5a. Total active (approved) users for MFA calculation
            User.countDocuments({ isActive: true, isApproved: true }),

            // 5b. Users with MFA enabled
            User.countDocuments({ isActive: true, isApproved: true, isTwoFactorEnabled: true }),
        ]);

        const securityPostureScore = computeSecurityPosture({
            totalAssets,
            recentlySeenAssets,
            authorizedAssets,
            totalUsers: totalActiveUsers,
            mfaUsers,
        });

        return res.status(200).json({
            activeAssets: {
                online: onlineAssets,
                total: totalAssets,
            },
            securityPostureScore,
            activeIncidents: activeIncidents,
            auditEvents24h: auditEvents24h,
            // Metadata for client-side display hints
            _meta: {
                generatedAt: now.toISOString(),
                posture: {
                    mfaRate: totalActiveUsers > 0 ? Math.round((mfaUsers / totalActiveUsers) * 100) : 100,
                    authRate: totalAssets > 0 ? Math.round((authorizedAssets / totalAssets) * 100) : 100,
                    patchRate: totalAssets > 0 ? Math.round((recentlySeenAssets / totalAssets) * 100) : 100,
                }
            }
        });

    } catch (error) {
        console.error('[Dashboard] Metrics fetch error:', error.message);
        // Return safe zeros — never crash the dashboard
        return res.status(200).json({
            activeAssets: { online: 0, total: 0 },
            securityPostureScore: 0,
            activeIncidents: 0,
            auditEvents24h: 0,
            _meta: { error: error.message, generatedAt: new Date().toISOString() }
        });
    }
};

module.exports = { getDashboardMetrics };
