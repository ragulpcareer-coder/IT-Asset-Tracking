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

const registerSchema = Joi.object({
  name: Joi.string().trim().min(3).max(100).required(),
  email: Joi.string().trim().lowercase().email().required(),
  password: strongPassword,
});

const loginSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required(),
  password: Joi.string().required(),
  fingerprint: Joi.string().allow("", null).optional(),
});

const verify2FASchema = Joi.object({
  userId: mongoId.required(),
  token: Joi.string().trim().pattern(/^[0-9A-Za-z]{6,12}$/).required(),
  fingerprint: Joi.string().allow("", null).optional(),
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

const emailVerificationParamsSchema = Joi.object({
  token: Joi.string().trim().hex().length(64).required(),
});

const profileUpdateSchema = Joi.object({
  name: Joi.string().trim().min(3).max(100).optional(),
  phone: Joi.string().trim().max(20).allow("", null).optional(),
  location: Joi.string().trim().max(120).allow("", null).optional(),
  department: Joi.string().trim().max(120).allow("", null).optional(),
  currentPassword: Joi.string().allow("", null).optional(),
}).min(1);

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: strongPassword,
});

const twoFactorVerifySchema = Joi.object({
  token: Joi.string().trim().pattern(/^[0-9A-Za-z]{6,12}$/).required(),
});

const adminPasswordResetSchema = Joi.object({
  newPassword: strongPassword,
});

const userIdParamsSchema = Joi.object({
  id: mongoId.required(),
});

const approvalLinkParamsSchema = Joi.object({
  id: mongoId.required(),
  token: Joi.string().trim().required(),
});

const suspendUserSchema = Joi.object({
  isActive: Joi.boolean().required(),
});

const paginationQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  search: Joi.string().trim().allow("", null).optional(),
});

module.exports = {
  registerSchema,
  loginSchema,
  verify2FASchema,
  forgotPasswordSchema,
  checkEmailSchema,
  resetPasswordSchema,
  resetTokenParamsSchema,
  emailVerificationParamsSchema,
  profileUpdateSchema,
  changePasswordSchema,
  twoFactorVerifySchema,
  adminPasswordResetSchema,
  userIdParamsSchema,
  approvalLinkParamsSchema,
  suspendUserSchema,
  paginationQuerySchema,
};
