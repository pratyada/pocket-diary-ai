import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import YAML from "yaml";

interface CategoryRule {
  category: string;
  subcategory: string;
}

let rulesCache: Map<string, CategoryRule> | null = null;

function getDomainRoot(): string {
  const thisFile = fileURLToPath(import.meta.url);
  // src/categorizer.ts → domains/finance/
  return path.resolve(path.dirname(thisFile), "..");
}

function loadRules(): Map<string, CategoryRule> {
  if (rulesCache) return rulesCache;

  const rulesPath = path.join(getDomainRoot(), "rules", "merchants.yaml");

  if (!fs.existsSync(rulesPath)) {
    rulesCache = new Map();
    return rulesCache;
  }

  const raw = fs.readFileSync(rulesPath, "utf-8");
  const parsed = YAML.parse(raw) as Record<string, CategoryRule>;

  rulesCache = new Map();
  for (const [merchant, rule] of Object.entries(parsed)) {
    rulesCache.set(merchant.toLowerCase(), rule);
  }
  return rulesCache;
}

export function normalizeMerchant(raw: string): string {
  let normalized = raw
    .toLowerCase()
    .replace(/^(pos|pur|pre-auth|preauth|wwww?|pay)\s+/i, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "_")
    .replace(/^_+|_+$/g, "")
    .trim();
  return normalized;
}

export interface CategorizeResult {
  merchant_normalized: string;
  category: string;
  subcategory: string;
  confidence: number;
  source: "rules" | "llm" | "unknown";
}

export function categorize(merchantRaw: string): CategorizeResult {
  const normalized = normalizeMerchant(merchantRaw);
  const rules = loadRules();

  // Exact match
  const exact = rules.get(normalized);
  if (exact) {
    return {
      merchant_normalized: normalized,
      category: exact.category,
      subcategory: exact.subcategory,
      confidence: 1.0,
      source: "rules",
    };
  }

  // Partial match — check if any rule key is contained in the normalized name
  for (const [ruleKey, rule] of rules) {
    if (normalized.includes(ruleKey) || ruleKey.includes(normalized)) {
      return {
        merchant_normalized: normalized,
        category: rule.category,
        subcategory: rule.subcategory,
        confidence: 0.85,
        source: "rules",
      };
    }
  }

  // No match — return unknown, will need LLM or manual categorization
  return {
    merchant_normalized: normalized,
    category: "uncategorized",
    subcategory: "unknown",
    confidence: 0.0,
    source: "unknown",
  };
}

/** Reload rules from disk (call after editing merchants.yaml). */
export function reloadRules(): void {
  rulesCache = null;
}

/** Categorize with LLM fallback — placeholder for now. */
export async function categorizeWithLLM(
  merchantRaw: string,
  _transactionDescription?: string
): Promise<CategorizeResult> {
  // First try rules
  const result = categorize(merchantRaw);
  if (result.confidence > 0) return result;

  // TODO: LLM fallback via model router (privacy class: local-preferred)
  // For now, return unknown with low confidence
  return {
    ...result,
    confidence: 0.3,
    source: "unknown",
  };
}
