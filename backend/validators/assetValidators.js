"use strict";

const validate = require("../middleware/validateRequest");
const Joi = validate.Joi;

const mongoId = Joi.string().hex().length(24);
const assetTypes = ["Laptop", "Desktop", "Server", "Network", "Mobile", "Printer", "IoT", "Software", "Other", "Computer"];
const classifications = ["Public", "Internal", "Confidential", "Restricted"];
const statuses = ["available", "assigned", "maintenance", "lost", "retired", "pending_recovery"];

const locationSchema = Joi.object({
  building: Joi.string().trim().max(120).allow("", null).optional(),
  floor: Joi.string().trim().max(60).allow("", null).optional(),
  room: Joi.string().trim().max(60).allow("", null).optional(),
  department: Joi.string().trim().max(120).allow("", null).optional(),
}).optional();

const assetBodySchema = Joi.object({
  name: Joi.string().trim().min(2).max(200).required(),
  type: Joi.string().valid(...assetTypes).required(),
  serialNumber: Joi.string().trim().min(2).max(120).required(),
  classification: Joi.string().valid(...classifications).optional(),
  status: Joi.string().valid(...statuses).optional(),
  assignedTo: Joi.string().trim().email().allow("", null).optional(),
  purchasePrice: Joi.number().min(0).optional(),
  usefulLifeYears: Joi.number().integer().min(1).max(15).optional(),
  location: locationSchema,
});

const assetUpdateSchema = Joi.object({
  name: Joi.string().trim().min(2).max(200).optional(),
  type: Joi.string().valid(...assetTypes).optional(),
  serialNumber: Joi.string().trim().min(2).max(120).optional(),
  classification: Joi.string().valid(...classifications).optional(),
  status: Joi.string().valid(...statuses).optional(),
  assignedTo: Joi.string().trim().email().allow("", null).optional(),
  purchasePrice: Joi.number().min(0).optional(),
  usefulLifeYears: Joi.number().integer().min(1).max(15).optional(),
  location: locationSchema,
}).min(1);

const assetIdParamsSchema = Joi.object({
  id: mongoId.required(),
});

const exportQuerySchema = Joi.object({
  status: Joi.string().valid(...statuses).optional(),
  type: Joi.string().valid(...assetTypes).optional(),
  format: Joi.string().valid("json", "csv").optional(),
}).unknown(true);

const assetListQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  search: Joi.string().trim().allow("", null).optional(),
  status: Joi.string().valid(...statuses).optional(),
  type: Joi.string().valid(...assetTypes).optional(),
  classification: Joi.string().valid(...classifications).optional(),
  sort: Joi.string().trim().allow("", null).optional(),
}).unknown(true);

const agentReportSchema = Joi.object({
  serialNumber: Joi.string().trim().required(),
  healthStatus: Joi.object().unknown(true).required(),
  networkStatus: Joi.object().unknown(true).required(),
  osInfo: Joi.object().unknown(true).optional(),
  timestamp: Joi.number().integer().required(),
}).unknown(true);

const bulkAssetUpdateSchema = Joi.object({
  assetIds: Joi.array().items(mongoId).min(1).required(),
  update: Joi.object({
    status: Joi.string().valid(...statuses).optional(),
    assignedTo: Joi.string().trim().email().allow("", null).optional(),
    classification: Joi.string().valid(...classifications).optional(),
    location: locationSchema,
  }).min(1).required(),
});

const publicAssetHealthParamsSchema = Joi.object({
  id: mongoId.required(),
});

const assetCheckInSchema = Joi.object({
  assetId: mongoId.required(),
  latitude: Joi.number().min(-90).max(90).optional(),
  longitude: Joi.number().min(-180).max(180).optional(),
  city: Joi.string().trim().max(120).allow("", null).optional(),
});

module.exports = {
  assetBodySchema,
  assetUpdateSchema,
  assetIdParamsSchema,
  exportQuerySchema,
  assetListQuerySchema,
  agentReportSchema,
  bulkAssetUpdateSchema,
  publicAssetHealthParamsSchema,
  assetCheckInSchema,
};
