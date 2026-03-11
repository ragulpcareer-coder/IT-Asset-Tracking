"use strict";

const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/rbacMiddleware");
const { autoAssignOldestLaptop } = require("../controllers/onboardingController");

router.post("/auto-assign", protect, authorizeRoles("Super Admin", "Admin", "Asset Manager"), autoAssignOldestLaptop);

module.exports = router;
