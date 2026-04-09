"use strict";

const sendError = (res, status, message, errors = {}) =>
  res.status(status).json({ success: false, message, errors });

const sendSuccess = (res, status, message, data = {}) =>
  res.status(status).json({ success: true, message, ...data });

module.exports = {
  sendError,
  sendSuccess,
};
