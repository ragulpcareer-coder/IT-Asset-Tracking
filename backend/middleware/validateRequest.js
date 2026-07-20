"use strict";

const Joi = require("joi");
const { sendError } = require("../utils/apiResponse");

const validate = (schema, property = "body") => (req, res, next) => {
  const payload = req[property] || {};
  const { error, value } = schema.validate(payload, {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  });

  if (error) {
    const errors = error.details.reduce((acc, detail) => {
      const key = detail.path.join(".") || property;
      acc[key] = detail.message.replace(/\"/g, "");
      return acc;
    }, {});

    return sendError(res, 400, "Validation failed", errors);
  }

  req[property] = value;
  next();
};

validate.Joi = Joi;

module.exports = validate;
