/**
 * roleMiddleware.js
 * Thin re-export of authorizeRoles from rbacMiddleware.
 * Kept for backward compatibility with existing route imports.
 */
const { authorizeRoles } = require("./rbacMiddleware");
module.exports = authorizeRoles;
