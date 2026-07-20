"use strict";

const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/rbacMiddleware");
const { autoAssignOldestLaptop } = require("../controllers/onboardingController");
const validate = require("../middleware/validateRequest");
const { onboardingAutoAssignSchema } = require("../validators/routeValidators");

router.post("/auto-assign", protect, authorizeRoles("Super Admin", "Admin", "Asset Manager"), validate(onboardingAutoAssignSchema), autoAssignOldestLaptop);

module.exports = router;
