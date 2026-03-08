"use strict";

const IPV4_PRIVATE_RANGES = [
  /^10\./,
  /^127\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./
];

const IPV6_PRIVATE_PATTERNS = [
  /^::1$/,
  /^fc/i,
  /^fd/i,
  /^fe80:/i
];

const normalizeIp = (value = "") => {
  if (!value || typeof value !== "string") return "";
  let ip = value.trim();

  if (ip.includes(".") && ip.includes(":") && !ip.includes("::")) {
    ip = ip.split(":")[0];
  }

  if (ip.startsWith("::ffff:")) {
    ip = ip.replace("::ffff:", "");
  }

  return ip;
};

const isPrivateIp = (ip = "") => {
  const normalized = normalizeIp(ip);
  if (!normalized) return true;

  if (normalized.includes(".")) {
    return IPV4_PRIVATE_RANGES.some((pattern) => pattern.test(normalized));
  }

  return IPV6_PRIVATE_PATTERNS.some((pattern) => pattern.test(normalized));
};

const extractClientIp = (req) => {
  const forwarded = req?.headers?.["x-forwarded-for"];
  if (forwarded && typeof forwarded === "string") {
    const chain = forwarded
      .split(",")
      .map((entry) => normalizeIp(entry))
      .filter(Boolean);

    const firstPublic = chain.find((candidate) => !isPrivateIp(candidate));
    if (firstPublic) return firstPublic;
    if (chain.length > 0) return chain[0];
  }

  const fallbackCandidates = [
    req?.headers?.["x-real-ip"],
    req?.socket?.remoteAddress,
    req?.connection?.remoteAddress,
    req?.ip
  ]
    .map((entry) => normalizeIp(entry))
    .filter(Boolean);

  const fallbackPublic = fallbackCandidates.find((candidate) => !isPrivateIp(candidate));
  return fallbackPublic || fallbackCandidates[0] || "unknown";
};

module.exports = {
  extractClientIp,
  isPrivateIp,
  normalizeIp
};
