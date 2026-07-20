"use strict";

const validate = require("../middleware/validateRequest");
const Joi = validate.Joi;

const strongPassword = Joi.string()
  .min(8)
  .pattern(/[A-Z]/, "uppercase")
  .pattern(/[a-z]/, "lowercase")
  .pattern(/[0-9]/, "number")
  .pattern(/[^A-Za-z0-9]/, "special character")
  .required();

const mongoId = Joi.string().hex().length(24);
const safeDisplayName = Joi.string()
  .trim()
  .min(3)
  .max(100)
  .pattern(/^[^<>]*$/)
  .messages({
    "string.pattern.base": "Name must not contain HTML markup",
  });

const registerSchema = Joi.object({
  name: safeDisplayName.required(),
  email: Joi.string().trim().lowercase().email().required(),
  password: strongPassword,
});

const loginSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required(),
  password: Joi.string().required(),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required(),
});

const checkEmailSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required(),
});

const resetPasswordSchema = Joi.object({
  password: strongPassword,
});

const resetTokenParamsSchema = Joi.object({
  token: Joi.string().trim().hex().length(64).required(),
});

const preferencesSchema = Joi.object({
  emailNotifications: Joi.boolean().optional(),
  pushNotifications: Joi.boolean().optional(),
  activityNotifications: Joi.boolean().optional(),
  securityAlerts: Joi.boolean().optional(),
  trackLocation: Joi.boolean().optional(),
  trackIP: Joi.boolean().optional(),
  theme: Joi.string().valid("dark", "light", "system").optional(),
  sessionTimeout: Joi.number().integer().min(5).max(240).optional(),
}).min(1);

const profileUpdateSchema = Joi.object({
  name: safeDisplayName.optional(),
  phone: Joi.string().trim().max(20).allow("", null).optional(),
  location: Joi.string().trim().max(120).allow("", null).optional(),
  department: Joi.string().trim().max(120).allow("", null).optional(),
  preferences: preferencesSchema.optional(),
  currentPassword: Joi.string().allow("", null).optional(),
}).min(1);

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: strongPassword,
});

const adminPasswordResetSchema = Joi.object({
  newPassword: strongPassword,
});

const userIdParamsSchema = Joi.object({
  id: mongoId.required(),
});

const suspendUserSchema = Joi.object({
  isActive: Joi.boolean().required(),
});

const offboardUserSchema = Joi.object({
  reason: Joi.string().trim().max(500).allow("", null).optional(),
});

const paginationQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  search: Joi.string().trim().allow("", null).optional(),
});

module.exports = {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  checkEmailSchema,
  resetPasswordSchema,
  resetTokenParamsSchema,
  profileUpdateSchema,
  changePasswordSchema,
  adminPasswordResetSchema,
  userIdParamsSchema,
  suspendUserSchema,
  offboardUserSchema,
  paginationQuerySchema,
};
