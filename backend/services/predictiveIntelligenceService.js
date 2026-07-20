/**
 * Predictive Risk & Lifecycle Intelligence Service
 *
 * This is deliberately a deterministic, explainable heuristic engine, not
 * a machine-learning model — there is no training data of actual failure
 * events to train one on. Every score here is traceable to a specific,
 * named signal (age vs. useful life, health telemetry, warranty status,
 * license expiry/utilization, historical retirement age), which is more
 * useful in practice than an opaque prediction anyway: a fleet manager
 * can see exactly why an asset was flagged and decide whether to act.
 *
 * Four capabilities, matching the four asks this was built against:
 *  1. computeFailureRisk       — which assets are likely to need attention soon
 *  2. computeLicenseCompliance — license risk before the audit window, not during it
 *  3. computeRefreshGuidance   — per-type refresh timing from actual fleet history
 *  4. computeUnderutilized     — assets/licenses sitting idle that could be reallocated
 */

const DEFAULT_LICENSE_WINDOW_DAYS = 90;
const MIN_RETIRED_SAMPLE_FOR_DATA_DRIVEN_GUIDANCE = 3;
const IDLE_ASSET_THRESHOLD_DAYS = 30;

function daysBetween(a, b) {
  return (new Date(a).getTime() - new Date(b).getTime()) / (1000 * 60 * 60 * 24);
}

function computeFailureRisk(asset) {
  let score = 0;
  const reasons = [];

  const ageYears = daysBetween(Date.now(), asset.purchaseDate) / 365.25;
  const usefulLifeYears = asset.usefulLifeYears || 5;
  const lifeRatio = usefulLifeYears ? ageYears / usefulLifeYears : 0;

  if (lifeRatio >= 1) {
    score += 40;
    reasons.push(
      `Past its expected ${usefulLifeYears}-year useful life (currently ${ageYears.toFixed(1)} years old).`,
    );
  } else if (lifeRatio >= 0.8) {
    score += 22;
    reasons.push(
      `Approaching end of useful life — ${Math.round(lifeRatio * 100)}% through its expected ${usefulLifeYears}-year lifespan.`,
    );
  }

  const ramPercent = parseFloat(asset.healthStatus?.ramUsagePercent);
  if (Number.isFinite(ramPercent) && ramPercent >= 90) {
    score += 20;
    reasons.push(`Sustained high memory usage (${ramPercent}%).`);
  }

  if (asset.status === "maintenance") {
    score += 15;
    reasons.push("Currently flagged for maintenance.");
  }

  const lastSeen = asset.networkStatus?.lastSeen;
  if (lastSeen) {
    const daysSince = daysBetween(Date.now(), lastSeen);
    if (daysSince > 30) {
      score += 15;
      reasons.push(`Has not been seen on the network in ${Math.round(daysSince)} days.`);
    }
  }

  if (asset.warrantyExpiry && new Date(asset.warrantyExpiry).getTime() < Date.now()) {
    score += 10;
    reasons.push("Warranty has already expired.");
  }

  return {
    assetId: asset._id,
    name: asset.name,
    type: asset.type,
    status: asset.status,
    ageYears: Math.round(ageYears * 10) / 10,
    score: Math.min(100, score),
    reasons,
  };
}

function computeLicenseCompliance(license, windowDays = DEFAULT_LICENSE_WINDOW_DAYS) {
  const daysToExpiry = Math.ceil(daysBetween(license.expiryDate, Date.now()));
  const seatCount = Array.isArray(license.assignedUsers) ? license.assignedUsers.length : 0;
  const utilizationPercent = license.totalSeats ? Math.round((seatCount / license.totalSeats) * 100) : 0;

  const flags = [];
  let score = 0;

  if (daysToExpiry <= 0) {
    score += 50;
    flags.push("This license has already expired.");
  } else if (daysToExpiry <= windowDays) {
    score += 30;
    flags.push(`Expires in ${daysToExpiry} day${daysToExpiry === 1 ? "" : "s"} — renew before the audit window closes.`);
  }

  if (utilizationPercent >= 100) {
    score += 30;
    flags.push("All seats are allocated — the next assignment will over-provision without a renewal.");
  } else if (utilizationPercent <= 20 && license.totalSeats > 1) {
    score += 10;
    flags.push(`Only ${utilizationPercent}% of seats are in use — consider reallocating before renewing at the same size.`);
  }

  return {
    licenseId: license._id,
    name: license.name,
    vendor: license.vendor,
    daysToExpiry,
    utilizationPercent,
    seatsUsed: seatCount,
    totalSeats: license.totalSeats,
    score: Math.min(100, score),
    flags,
  };
}

function computeRefreshGuidance(assetsOfType, type) {
  const retired = assetsOfType.filter((a) => a.status === "retired");
  const declaredYears = assetsOfType[0]?.usefulLifeYears || 5;

  if (retired.length < MIN_RETIRED_SAMPLE_FOR_DATA_DRIVEN_GUIDANCE) {
    return {
      type,
      fleetSize: assetsOfType.length,
      retiredSampleSize: retired.length,
      declaredUsefulLifeYears: declaredYears,
      dataDrivenRecommendedYears: null,
      note: `Not enough retirement history yet for a data-driven recommendation (${retired.length} retired so far, need ${MIN_RETIRED_SAMPLE_FOR_DATA_DRIVEN_GUIDANCE}+) — using the declared ${declaredYears}-year policy for now.`,
    };
  }

  const ages = retired.map((a) => daysBetween(a.updatedAt, a.purchaseDate) / 365.25);
  const avgYears = ages.reduce((sum, age) => sum + age, 0) / ages.length;
  const roundedAvg = Math.round(avgYears * 10) / 10;
  const meaningfullyDifferent = Math.abs(avgYears - declaredYears) >= 0.5;

  let note;
  if (!meaningfullyDifferent) {
    note = `Actual retirement age (avg ${roundedAvg} yrs) matches the declared ${declaredYears}-year policy — no change recommended.`;
  } else if (avgYears < declaredYears) {
    note = `Assets of this type are typically retired earlier than planned (avg ${roundedAvg} yrs vs. the declared ${declaredYears}-year policy) — consider shortening the refresh cycle to reduce failure risk.`;
  } else {
    note = `Assets of this type have historically lasted longer than planned (avg ${roundedAvg} yrs vs. the declared ${declaredYears}-year policy) — the refresh cycle may be more conservative than necessary.`;
  }

  return {
    type,
    fleetSize: assetsOfType.length,
    retiredSampleSize: retired.length,
    declaredUsefulLifeYears: declaredYears,
    dataDrivenRecommendedYears: roundedAvg,
    note,
  };
}

function computeUnderutilizedAssets(assets) {
  return assets
    .filter((a) => a.status === "available")
    .map((a) => ({
      assetId: a._id,
      name: a.name,
      type: a.type,
      idleDays: Math.round(daysBetween(Date.now(), a.updatedAt)),
    }))
    .filter((a) => a.idleDays >= IDLE_ASSET_THRESHOLD_DAYS)
    .sort((a, b) => b.idleDays - a.idleDays);
}

function buildIntelligenceReport({ assets, licenses, licenseWindowDays }) {
  const failureRisks = assets
    .map(computeFailureRisk)
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  const licenseRisks = licenses
    .map((license) => computeLicenseCompliance(license, licenseWindowDays))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  const byType = assets.reduce((acc, asset) => {
    acc[asset.type] = acc[asset.type] || [];
    acc[asset.type].push(asset);
    return acc;
  }, {});
  const refreshGuidance = Object.entries(byType).map(([type, group]) => computeRefreshGuidance(group, type));

  const underutilized = computeUnderutilizedAssets(assets);

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      assetsAtRisk: failureRisks.length,
      licensesNeedingAttention: licenseRisks.length,
      underutilizedAssets: underutilized.length,
      assetTypesTracked: refreshGuidance.length,
    },
    failureRisks: failureRisks.slice(0, 25),
    licenseRisks,
    refreshGuidance,
    underutilized: underutilized.slice(0, 25),
  };
}

module.exports = {
  computeFailureRisk,
  computeLicenseCompliance,
  computeRefreshGuidance,
  computeUnderutilizedAssets,
  buildIntelligenceReport,
};
