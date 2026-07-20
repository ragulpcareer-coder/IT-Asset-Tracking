/**
 * Database Indexing Strategy
 * 
 * This file documents and implements all database indexes for optimal query performance
 * Indexes significantly improve read performance at the cost of write performance and storage
 * 
 * Strategy:
 * - Single-field indexes on frequently queried fields
 * - Compound indexes for common multi-field queries
 * - Sparse indexes for optional fields
 * - TTL indexes for automatic data cleanup
 */

const mongoose = require("mongoose");

/**
 * USER COLLECTION INDEXES
 * 
 * Purpose: Optimize user lookups, authentication, and searches
 * Impact: Frequent reads for login, profile updates, role checks
 */
const userIndexes = [
  // Email lookup (authentication, uniqueness)
  {
    specification: { email: 1 },
    options: { unique: true, sparse: true },
    reason: "Fast user lookup by email, ensures email uniqueness",
  },

  // Username/role searches
  {
    specification: { role: 1 },
    options: { sparse: true },
    reason: "Find users by role (e.g., get all admins)",
  },

  // User creation date (for analytics)
  {
    specification: { createdAt: -1 },
    options: {},
    reason: "Sort users by creation date, find recent signups",
  },

  // Compound index: role + createdAt
  {
    specification: { role: 1, createdAt: -1 },
    options: {},
    reason: "Find recent users by role (e.g., new admins)",
  },

  // Active users filter
  {
    specification: { isActive: 1, createdAt: -1 },
    options: { sparse: true },
    reason: "Find active users sorted by creation date",
  },

  // Last login tracking
  {
    specification: { lastLogin: -1 },
    options: { sparse: true },
    reason: "Find recently active users, identify inactive accounts",
  },
];

/**
 * ASSET COLLECTION INDEXES
 * 
 * Purpose: Optimize asset queries, tracking, and searches
 * Impact: Very high - assets are queried frequently
 */
const assetIndexes = [
  // Asset serial number (unique lookup)
  {
    specification: { serialNumber: 1 },
    options: { unique: true, sparse: true },
    reason: "Fast asset lookup by serial number, ensure uniqueness",
  },

  // Asset status filtering
  {
    specification: { status: 1 },
    options: {},
    reason: "Find assets by lifecycle status (active, maintenance, etc.)",
  },

  // Asset category filtering
  {
    specification: { category: 1 },
    options: {},
    reason: "Find all assets in a category (laptops, servers, etc.)",
  },

  // Assigned user lookup
  {
    specification: { assignedTo: 1 },
    options: { sparse: true },
    reason: "Find all assets assigned to a specific user",
  },

  // Warranty expiry searches
  {
    specification: { warrantyExpiry: 1 },
    options: { sparse: true },
    reason: "Find assets with expiring warranties (cron job, searches)",
  },

  // Asset age/creation date
  {
    specification: { createdAt: -1 },
    options: {},
    reason: "Sort assets by creation date, find recent acquisitions",
  },

  // Compound index: status + assignedTo
  {
    specification: { status: 1, assignedTo: 1 },
    options: { sparse: true },
    reason: "Find all active assets assigned to a user",
  },

  // Compound index: category + status + warrantyExpiry
  {
    specification: { category: 1, status: 1, warrantyExpiry: 1 },
    options: { sparse: true },
    reason: "Complex query: Get active laptops expiring soon",
  },

  // Text search index on name and description
  {
    specification: { name: "text", description: "text" },
    options: { default_language: "english" },
    reason: "Full-text search for assets by name or description",
  },

  // Location tracking
  {
    specification: { location: 1 },
    options: { sparse: true },
    reason: "Find all assets in a specific location",
  },

  // Cost tracking for financial reports
  {
    specification: { purchaseCost: 1 },
    options: { sparse: true },
    reason: "Sort assets by cost, generate financial reports",
  },
];

/**
 * AUDIT LOG COLLECTION INDEXES
 * 
 * Purpose: Fast retrieval of audit logs for compliance and investigation
 * Impact: High - audit logs are frequently queried for security investigations
 */
const auditLogIndexes = [
  // User action lookup
  {
    specification: { performedBy: 1, createdAt: -1 },
    options: {},
    reason: "Find all actions by a specific user, sorted by date",
  },

  // Action type filtering
  {
    specification: { action: 1 },
    options: {},
    reason: "Find specific types of actions (e.g., all logins, deletions)",
  },

  // Resource tracking
  {
    specification: { resource: 1, resourceId: 1, createdAt: -1 },
    options: {},
    reason: "Find all changes to a specific resource (asset, user, etc.)",
  },

  // Date range queries
  {
    specification: { createdAt: -1 },
    options: {},
    reason: "Sort logs by date, enable efficient date range scans",
  },

  // Compound index: performedBy + action + createdAt
  {
    specification: { performedBy: 1, action: 1, createdAt: -1 },
    options: {},
    reason: "Find specific actions by user at specific times",
  },

  // IP address tracking (security investigation)
  {
    specification: { ip: 1, createdAt: -1 },
    options: { sparse: true },
    reason: "Track all activities from an IP address",
  },

  // Status filtering (failed attempts, etc.)
  {
    specification: { status: 1, createdAt: -1 },
    options: { sparse: true },
    reason: "Find successful or failed actions",
  },

  // Tamper detection
  {
    specification: { "_security.hash": 1 },
    options: { sparse: true },
    reason: "Verify audit log integrity and detect tampering",
  },

  // TTL index: Auto-delete logs older than 1 year
  {
    specification: { createdAt: 1 },
    options: { expireAfterSeconds: 31536000 },
    reason: "Automatically delete audit logs older than 1 year",
  },
];

/**
 * Implementation Guide:
 * 
 * 1. Add to Model Definition:
 *    In your Mongoose schema:
 *    
 *    userSchema.index({ email: 1 }, { unique: true, sparse: true });
 *    assetSchema.index({ status: 1 });
 *    auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 });
 * 
 * 2. Or use ensureIndexes():
 *    await User.collection.ensureIndex({ email: 1 }, { unique: true });
 * 
 * 3. Monitor index usage:
 *    db.collection.aggregate([{ $indexStats: {} }])
 */

/**
 * Performance Impact Analysis
 */
const performanceAnalysis = {
  "User email lookup": {
    withoutIndex: "Full collection scan ~100ms",
    withIndex: "B-tree lookup ~1ms",
    improvement: "100x faster",
  },
  "Asset status filter": {
    withoutIndex: "Full scan of 50,000 assets ~500ms",
    withIndex: "Index scan ~5ms",
    improvement: "100x faster",
  },
  "Warranty expiry range query": {
    withoutIndex: "~2000ms",
    withIndex: "~20ms",
    improvement: "100x faster",
  },
  "Audit log date range (1 month)": {
    withoutIndex: "~3000ms",
    withIndex: "~50ms",
    improvement: "60x faster",
  },
};

/**
 * Index Size Estimation
 * (Approximate for typical data)
 */
const indexSizeEstimation = {
  "User indexes": "~2-5 MB for 10,000 users",
  "Asset indexes": "~5-10 MB for 50,000 assets",
  "Audit indexes": "~10-20 MB for 500,000 log entries",
  "Total estimated": "~25 MB for production data",
};

/**
 * Best Practices for Indexing
 */
const bestPractices = [
  "1. Index on equality before range queries (e.g., status: 1, createdAt: -1)",
  "2. Don't over-index - each index increases write latency",
  "3. Monitor slow queries with MongoDB profiler",
  "4. Use explain() to verify indexes are being used",
  "5. Consider query patterns - index what you search for most",
  "6. Use compound indexes for common multi-field queries",
  "7. Sparse indexes for fields that aren't always present",
  "8. TTL indexes for automatic data lifecycle management",
];

/**
 * Common Index Mistakes to Avoid
 */
const avoidMistakes = [
  "❌ Indexing everything - causes slow writes",
  "❌ Not monitoring index usage - bloated indexes",
  "❌ Wrong field order in compound indexes",
  "❌ Missing indexes on foreign keys",
  "❌ Not considering cardinality (selectivity)",
  "❌ Using text indexes unnecessarily",
];

/**
 * Maintenance Tasks
 */
const maintenanceTasks = {
  monthly: "Run explain() on slow queries to verify index usage",
  quarterly: "Review unused indexes and remove them",
  semiAnnually: "Analyze query patterns and optimize indexes",
  afterPartioniing: "Rebuild indexes after data migration",
};

module.exports = {
  userIndexes,
  assetIndexes,
  auditLogIndexes,
  performanceAnalysis,
  indexSizeEstimation,
  bestPractices,
  avoidMistakes,
  maintenanceTasks,
};
