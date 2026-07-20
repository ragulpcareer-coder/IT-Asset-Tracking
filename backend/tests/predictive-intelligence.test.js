const test = require("node:test");
const assert = require("node:assert/strict");
const {
  computeFailureRisk,
  computeLicenseCompliance,
  computeRefreshGuidance,
  computeUnderutilizedAssets,
  buildIntelligenceReport,
} = require("../services/predictiveIntelligenceService");

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

test("computeFailureRisk flags an asset past its useful life with a specific, named reason", () => {
  const asset = {
    _id: "a1",
    name: "Old Laptop",
    type: "Laptop",
    status: "active",
    purchaseDate: daysAgo(6 * 365),
    usefulLifeYears: 5,
    warrantyExpiry: daysAgo(400),
    healthStatus: {},
    networkStatus: { lastSeen: daysAgo(1) },
  };
  const result = computeFailureRisk(asset);
  assert.ok(result.score >= 40, "should score meaningfully high");
  assert.ok(
    result.reasons.some((r) => r.includes("useful life")),
    "should explain the useful-life reason",
  );
  assert.ok(
    result.reasons.some((r) => r.includes("Warranty")),
    "should also flag the expired warranty",
  );
});

test("computeFailureRisk gives a healthy, recent asset a zero or near-zero score", () => {
  const asset = {
    _id: "a2",
    name: "New Desktop",
    type: "Desktop",
    status: "active",
    purchaseDate: daysAgo(60),
    usefulLifeYears: 5,
    warrantyExpiry: daysAgo(-700),
    healthStatus: { ramUsagePercent: "40" },
    networkStatus: { lastSeen: daysAgo(0) },
  };
  const result = computeFailureRisk(asset);
  assert.equal(result.score, 0);
  assert.deepEqual(result.reasons, []);
});

test("computeLicenseCompliance flags expiring-soon and fully-utilized licenses", () => {
  const expiringSoon = computeLicenseCompliance(
    { _id: "l1", name: "Design Suite", vendor: "Acme", totalSeats: 10, assignedUsers: new Array(10).fill("u"), expiryDate: daysAgo(-20) },
    90,
  );
  assert.ok(expiringSoon.score > 0);
  assert.ok(expiringSoon.flags.some((f) => f.includes("Expires in")));
  assert.ok(expiringSoon.flags.some((f) => f.includes("over-provision")));

  const healthy = computeLicenseCompliance(
    { _id: "l2", name: "Email", vendor: "Acme", totalSeats: 10, assignedUsers: new Array(5).fill("u"), expiryDate: daysAgo(-400) },
    90,
  );
  assert.equal(healthy.score, 0);
});

test("computeLicenseCompliance flags already-expired licenses and low utilization separately", () => {
  const expired = computeLicenseCompliance(
    { _id: "l3", name: "Old Tool", vendor: "Acme", totalSeats: 5, assignedUsers: [], expiryDate: daysAgo(5) },
    90,
  );
  assert.ok(expired.flags.some((f) => f.includes("already expired")));

  const underused = computeLicenseCompliance(
    { _id: "l4", name: "Rarely Used", vendor: "Acme", totalSeats: 20, assignedUsers: new Array(2).fill("u"), expiryDate: daysAgo(-400) },
    90,
  );
  assert.ok(underused.flags.some((f) => f.includes("reallocating")));
});

test("computeRefreshGuidance requires a minimum retired sample before recommending a data-driven change", () => {
  const fleet = [
    { status: "active", usefulLifeYears: 5, purchaseDate: daysAgo(365), updatedAt: daysAgo(0) },
    { status: "retired", usefulLifeYears: 5, purchaseDate: daysAgo(3 * 365), updatedAt: daysAgo(0) },
  ];
  const guidance = computeRefreshGuidance(fleet, "Laptop");
  assert.equal(guidance.dataDrivenRecommendedYears, null);
  assert.match(guidance.note, /Not enough retirement history/);
});

test("computeRefreshGuidance recommends a shorter cycle when assets retire earlier than the declared policy", () => {
  const fleet = [
    { status: "retired", usefulLifeYears: 5, purchaseDate: daysAgo(3 * 365), updatedAt: daysAgo(0) },
    { status: "retired", usefulLifeYears: 5, purchaseDate: daysAgo(3 * 365 + 30), updatedAt: daysAgo(0) },
    { status: "retired", usefulLifeYears: 5, purchaseDate: daysAgo(3 * 365 - 30), updatedAt: daysAgo(0) },
  ];
  const guidance = computeRefreshGuidance(fleet, "Printer");
  assert.equal(guidance.retiredSampleSize, 3);
  assert.ok(guidance.dataDrivenRecommendedYears < 5);
  assert.match(guidance.note, /retired earlier than planned/);
});

test("computeUnderutilizedAssets only flags available assets idle 30+ days, sorted by idle time", () => {
  const assets = [
    { _id: "u1", name: "Spare A", type: "Laptop", status: "available", updatedAt: daysAgo(45) },
    { _id: "u2", name: "Spare B", type: "Laptop", status: "available", updatedAt: daysAgo(10) },
    { _id: "u3", name: "In use", type: "Laptop", status: "assigned", updatedAt: daysAgo(400) },
    { _id: "u4", name: "Spare C", type: "Laptop", status: "available", updatedAt: daysAgo(90) },
  ];
  const result = computeUnderutilizedAssets(assets);
  assert.equal(result.length, 2);
  assert.equal(result[0].assetId, "u4");
  assert.equal(result[1].assetId, "u1");
});

test("buildIntelligenceReport assembles a consistent summary across all four signals", () => {
  const assets = [
    {
      _id: "a1", name: "Old Server", type: "Server", status: "active",
      purchaseDate: daysAgo(7 * 365), usefulLifeYears: 5, warrantyExpiry: daysAgo(100),
      healthStatus: {}, networkStatus: { lastSeen: daysAgo(1) }, updatedAt: daysAgo(1),
    },
    {
      _id: "a2", name: "Spare Laptop", type: "Laptop", status: "available",
      purchaseDate: daysAgo(200), usefulLifeYears: 5, warrantyExpiry: daysAgo(-500),
      healthStatus: {}, networkStatus: { lastSeen: daysAgo(60) }, updatedAt: daysAgo(60),
    },
  ];
  const licenses = [
    { _id: "l1", name: "Suite", vendor: "Acme", totalSeats: 5, assignedUsers: new Array(5).fill("u"), expiryDate: daysAgo(-10) },
  ];

  const report = buildIntelligenceReport({ assets, licenses, licenseWindowDays: 90 });
  // Both assets legitimately trip a risk signal here: the old server on
  // useful-life/warranty grounds, and the spare laptop on stale
  // network-checkin grounds (60 days since last seen) — that's correct,
  // not a bug, since "hasn't network-checked-in in 60 days" is itself a
  // real signal worth surfacing for an "available" spare.
  assert.equal(report.summary.assetsAtRisk, 2);
  assert.equal(report.summary.licensesNeedingAttention, 1);
  assert.equal(report.summary.underutilizedAssets, 1);
  assert.equal(report.summary.assetTypesTracked, 2);
  assert.ok(report.generatedAt);
});
