/**
 * Central place for plan capabilities.
 *
 * The portal remains free-first. Premium is deliberately disabled until a
 * server-verified entitlement and billing flow exist. Never trust a plan value
 * supplied only by the browser to protect paid features.
 */
export type PlanId = "free" | "premium";

export type PremiumFeature =
  | "batch_processing"
  | "larger_file_limits"
  | "saved_workspaces"
  | "priority_processing";

export const PREMIUM_ENABLED = false;

const premiumFeatures = new Set<PremiumFeature>([
  "batch_processing",
  "larger_file_limits",
  "saved_workspaces",
  "priority_processing"
]);

export function canUsePremiumFeature(
  plan: PlanId,
  feature: PremiumFeature
): boolean {
  if (!PREMIUM_ENABLED || plan !== "premium") return false;
  return premiumFeatures.has(feature);
}

export function getPlanLabel(plan: PlanId): string {
  return plan === "premium" && PREMIUM_ENABLED ? "Premium" : "Gratuito";
}
