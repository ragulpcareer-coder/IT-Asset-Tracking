"use strict";

const validate = require("../middleware/validateRequest");
const Joi = validate.Joi;

const mongoId = Joi.string().hex().length(24);
const paginationQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
}).unknown(false);

const dateRangeQuerySchema = paginationQuerySchema.keys({
  from: Joi.date().iso().optional(),
  to: Joi.date().iso().optional(),
  action: Joi.string().trim().max(120).optional(),
});

const idParamsSchema = Joi.object({
  id: mongoId.required(),
});

const filenameParamsSchema = Joi.object({
  filename: Joi.string().trim().pattern(/^[A-Za-z0-9._-]+$/).required(),
});

const apiKeyCreateSchema = Joi.object({
  name: Joi.string().trim().min(2).max(150).required(),
});

const softwareCreateSchema = Joi.object({
  name: Joi.string().trim().min(2).max(200).required(),
  vendor: Joi.string().trim().min(2).max(200).required(),
  key: Joi.string().trim().min(4).required(),
  totalSeats: Joi.number().integer().min(1).max(100000).optional(),
  assignedUsers: Joi.array().items(mongoId).optional(),
  purchaseDate: Joi.date().iso().optional(),
  expiryDate: Joi.date().iso().required(),
  costPerSeat: Joi.number().min(0).optional(),
});

const softwareAssignSchema = Joi.object({
  userId: mongoId.required(),
});

const ticketCreateSchema = Joi.object({
  assetId: mongoId.required(),
  title: Joi.string().trim().min(3).max(200).required(),
  description: Joi.string().trim().min(5).max(4000).required(),
  priority: Joi.string().valid("Low", "Medium", "High", "Critical").optional(),
});

const ticketUpdateSchema = Joi.object({
  status: Joi.string().valid("Open", "In Progress", "Resolved", "Closed").optional(),
  repairCost: Joi.number().min(0).optional(),
}).min(1);

const simulationBruteForceSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required(),
  ip: Joi.string().ip({ version: ["ipv4", "ipv6"] }).optional(),
});

const simulationUserSchema = Joi.object({
  userId: mongoId.optional(),
  ip: Joi.string().ip({ version: ["ipv4", "ipv6"] }).optional(),
});

const alertIdParamsSchema = Joi.object({
  alertId: mongoId.required(),
});

const auditCreateSchema = Joi.object({
  action: Joi.string().trim().min(2).max(120).required(),
  details: Joi.string().trim().max(5000).allow("", null).optional(),
  resourceId: Joi.alternatives().try(Joi.string().trim().max(120), Joi.object()).optional(),
  resourceType: Joi.string().trim().max(120).allow("", null).optional(),
  meta: Joi.object().unknown(true).optional(),
});

const integrityQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(1000).optional(),
}).unknown(false);

const diagnosticEmailQuerySchema = Joi.object({
  to: Joi.string().trim().lowercase().email().optional(),
}).unknown(false);

module.exports = {
  paginationQuerySchema,
  dateRangeQuerySchema,
  idParamsSchema,
  filenameParamsSchema,
  apiKeyCreateSchema,
  softwareCreateSchema,
  softwareAssignSchema,
  ticketCreateSchema,
  ticketUpdateSchema,
  simulationBruteForceSchema,
  simulationUserSchema,
  alertIdParamsSchema,
  auditCreateSchema,
  integrityQuerySchema,
  diagnosticEmailQuerySchema,
};
