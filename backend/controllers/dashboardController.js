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
 * Security Posture Score (0–100, or null if no data)
 *
 * Weighted components:
 *  - MFA Adoption        30% — (mfaUsers / totalUsers) * 30
 *  - Patch Compliance    40% — (lastSeen ≤24h assets / totalAssets) * 40
 *  - Auth Compliance     30% — (authorizedAssets / totalAssets) * 30
 *
 * Edge cases:
 *  - 0 assets AND 0 users  → null  (fresh install — no data, show N/A)
 *  - 0 assets, users exist → MFA score only, rescaled to 100
 *    (patch + encryption excluded — cannot measure what doesn't exist)
 *  - assets exist, 0 users → patch + encryption only, rescaled to 100
 *    (MFA excluded — no applicable users)
 */
function computeSecurityPosture({ totalAssets, recentlySeenAssets, authorizedAssets, totalUsers, mfaUsers }) {
    // No data at all — return null so frontend can display "N/A" instead of a misleading number
    if (totalAssets === 0 && totalUsers === 0) return null;

    const hasAssets = totalAssets > 0;
    const hasUsers = totalUsers > 0;

    const mfaScore = hasUsers ? (mfaUsers / totalUsers) * 30 : 0;
    const patchScore = hasAssets ? (recentlySeenAssets / totalAssets) * 40 : 0;
    const encryptionScore = hasAssets ? (authorizedAssets / totalAssets) * 30 : 0;

    // Scale to 100 based on which components actually have data
    const maxPossible = (hasUsers ? 30 : 0) + (hasAssets ? 70 : 0);
    const rawScore = mfaScore + patchScore + encryptionScore;

    // Avoid division by zero (should never happen given the null check above)
    if (maxPossible === 0) return null;

    return Math.round((rawScore / maxPossible) * 100);
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
                    mfaRate: totalActiveUsers > 0 ? Math.round((mfaUsers / totalActiveUsers) * 100) : null,
                    authRate: totalAssets > 0 ? Math.round((authorizedAssets / totalAssets) * 100) : null,
                    patchRate: totalAssets > 0 ? Math.round((recentlySeenAssets / totalAssets) * 100) : null,
                }
            }
        });

    } catch (error) {
        console.error('[Dashboard] Metrics fetch error:', error.message);
        // Return safe zeros — never crash the dashboard
        return res.status(200).json({
            activeAssets: { online: 0, total: 0 },
            securityPostureScore: null,
            activeIncidents: 0,
            auditEvents24h: 0,
            _meta: { error: 'metrics_unavailable', generatedAt: new Date().toISOString() }
        });
    }
};

module.exports = { getDashboardMetrics };
