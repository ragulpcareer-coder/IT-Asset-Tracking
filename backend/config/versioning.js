/**
 * API Versioning Strategy
 * 
 * Implements semantic versioning for API endpoints
 * Allows gradual deprecation and backward compatibility
 * 
 * Versioning Approaches:
 * 1. URL path: /api/v1/assets, /api/v2/assets
 * 2. HTTP headers: Accept: application/vnd.api+json;version=2
 * 3. Query parameter: /api/assets?version=2
 * 
 * We implement URL-path versioning as it's most explicit and cacheable
 */

/**
 * Version Manager
 */
class VersionManager {
  static VERSIONS = {
    V1: "1.0.0",
    V2: "2.0.0",
  };

  static CURRENT_VERSION = "1.0.0";

  static VERSION_INFO = {
    "1.0.0": {
      name: "Initial Release",
      releaseDate: "2024-01-01",
      status: "stable",
      deprecated: false,
      features: [
        "Basic CRUD operations",
        "JWT authentication",
        "Role-based access control",
      ],
    },
    "2.0.0": {
      name: "Enhanced API with GraphQL support",
      releaseDate: "2025-02-01",
      status: "beta",
      deprecated: false,
      features: [
        "GraphQL endpoint",
        "Advanced filtering",
        "Batch operations",
        "Webhook support",
      ],
      breaking_changes: [
        "Asset response format changed",
        "Pagination moved to cursor-based",
      ],
    },
  };

  /**
   * Get API version from request
   */
  static getVersionFromRequest(req) {
    // Priority: URL path > Header > Query > Default
    if (req.params.version) {
      return this.validateVersion(req.params.version);
    }

    if (req.get("api-version")) {
      return this.validateVersion(req.get("api-version"));
    }

    if (req.query.version) {
      return this.validateVersion(req.query.version);
    }

    return this.CURRENT_VERSION;
  }

  /**
   * Validate version format
   */
  static validateVersion(version) {
    const versionPattern = /^(?:\d+)\.(?:\d+)\.(?:\d+)$/;

    if (!versionPattern.test(version)) {
      throw new Error(`Invalid API version format: ${version}`);
    }

    // Check if version exists
    if (!this.VERSION_INFO[version]) {
      throw new Error(`API version ${version} not supported`);
    }

    return version;
  }

  /**
   * Check if version is deprecated
   */
  static isDeprecated(version) {
    const info = this.VERSION_INFO[version];
    return info && info.deprecated;
  }

  /**
   * Get deprecation warning message
   */
  static getDeprecationWarning(version) {
    const info = this.VERSION_INFO[version];

    if (!info || !info.deprecated) {
      return null;
    }

    return `API version ${version} is deprecated. Upgrade to v${this.CURRENT_VERSION}`;
  }

  /**
   * List all available versions
   */
  static listVersions() {
    return Object.entries(this.VERSION_INFO).map(([version, info]) => ({
      version,
      ...info,
    }));
  }

  /**
   * Get breaking changes between versions
   */
  static getBreakingChanges(fromVersion, toVersion) {
    const fromInfo = this.VERSION_INFO[fromVersion];
    const toInfo = this.VERSION_INFO[toVersion];

    if (!fromInfo || !toInfo) {
      return [];
    }

    return toInfo.breaking_changes || [];
  }
}

/**
 * API Versioning Middleware
 * Usage: router.use(versionMiddleware);
 */
const versionMiddleware = (req, res, next) => {
  try {
    const version = VersionManager.getVersionFromRequest(req);
    req.apiVersion = version;

    // Add deprecation warning header if needed
    const deprecationWarning = VersionManager.getDeprecationWarning(version);
    if (deprecationWarning) {
      res.setHeader("Deprecation", "true");
      res.setHeader("Warning", deprecationWarning);
    }

    // Add version info to response
    res.setHeader("API-Version", version);

    next();
  } catch (error) {
    res.status(400).json({
      error: "Invalid API version",
      message: error.message,
    });
  }
};

/**
 * Version-specific response transformer
 */
const transformResponse = (data, version) => {
  if (version === "2.0.0") {
    // V2 uses different format
    return {
      data,
      meta: {
        version: "2.0.0",
        timestamp: new Date().toISOString(),
      },
    };
  }

  // V1 format (default)
  return data;
};

/**
 * Request router by version
 * Directs requests to version-specific handlers
 */
const routeByVersion = (handlers) => {
  return (req, res, next) => {
    const version = req.apiVersion || VersionManager.CURRENT_VERSION;
    const handler = handlers[version];

    if (!handler) {
      return res.status(501).json({
        error: "Not Implemented",
        message: `Handler not available for version ${version}`,
      });
    }

    handler(req, res, next);
  };
};

/**
 * Endpoint versioning documentation
 */
const ENDPOINT_VERSIONS = {
  "/api/v1/assets": {
    GET: {
      description: "List assets",
      version: "1.0.0",
      parameters: ["status", "category", "assignedTo"],
      response: {
        format: "array",
        example: [{ _id: "...", name: "Laptop", status: "active" }],
      },
    },
    POST: {
      description: "Create asset",
      version: "1.0.0",
      parameters: ["name", "serialNumber", "category"],
      requires: ["Admin"],
    },
  },

  "/api/v2/assets": {
    GET: {
      description: "List assets with advanced filtering",
      version: "2.0.0",
      parameters: [
        "filter.status",
        "filter.category",
        "sort",
        "cursor",
        "limit",
      ],
      response: {
        format: "paginated",
        example: {
          data: [{ id: "...", name: "Laptop", status: "active" }],
          pagination: { cursor: "...", hasMore: true },
        },
      },
      breaking_changes: ["filter format changed", "pagination is cursor-based"],
    },
  },
};

/**
 * Migration guide for versions
 */
const MIGRATION_GUIDE = {
  "1.0.0 -> 2.0.0": `
## Breaking Changes:
1. Asset ID format changed from ObjectId to UUID
2. Pagination: offset/limit → cursor-based
3. Filter format: query params → nested filter object
4. Response wrapper: flat object → { data, meta }

## Examples:

### V1 Request:
GET /api/v1/assets?status=active&page=1&limit=10

### V2 Request:
GET /api/v2/assets?filter={"status":"active"}&cursor=xxx&limit=10

### V1 Response:
[
  { _id: "...", name: "Laptop" }
]

### V2 Response:
{
  "data": [
    { "id": "...", "name": "Laptop" }
  ],
  "meta": {
    "version": "2.0.0",
    "timestamp": "2025-02-01T..."
  }
}

## Migration Steps:
1. Update client to use /api/v2/ endpoints
2. Replace offset/limit with cursor pagination
3. Update filter format to use nested objects
4. Handle new response format with meta wrapper
5. Update asset ID handling (UUID vs ObjectId)
`,
};

/**
 * Deprecation schedule
 */
const DEPRECATION_SCHEDULE = {
  "1.0.0": {
    deprecated_date: "2025-08-01",
    sunset_date: "2026-02-01",
    status: "scheduled_for_deprecation",
  },
};

/**
 * Version compatibility checker
 */
const isCompatible = (clientVersion, serverVersion) => {
  const [clientMajor] = clientVersion.split(".").map(Number);
  const [serverMajor] = serverVersion.split(".").map(Number);

  return clientMajor === serverMajor;
};

module.exports = {
  VersionManager,
  versionMiddleware,
  transformResponse,
  routeByVersion,
  ENDPOINT_VERSIONS,
  MIGRATION_GUIDE,
  DEPRECATION_SCHEDULE,
  isCompatible,
};
