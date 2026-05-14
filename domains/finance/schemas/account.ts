import { z } from "zod";
import { Currency, Owner, Region } from "./common.js";

export const AccountType = z.enum([
  // Canada
  "chequing",
  "savings",
  "tfsa",
  "rrsp",
  "resp",
  "fhsa",
  // India
  "savings_in",
  "demat",
  "ppf",
  "fd",
  // US
  "checking",
  "savings_us",
  "brokerage",
  // Generic
  "credit_card",
  "line_of_credit",
  "mortgage",
  "loan",
]);
export type AccountType = z.infer<typeof AccountType>;

export const Account = z.object({
  id: z.string(), // "account:rbc-chequing"
  bank: z.string(),
  type: AccountType,
  currency: Currency,
  region: Region,
  owner: Owner,
  label: z.string(),
  account_number_last4: z.string().length(4).optional(),
  is_investment: z.boolean().default(false),
  contribution_room: z.number().optional(), // for TFSA/RRSP/RESP/FHSA
  opened_at: z.string().optional(),
});
export type Account = z.infer<typeof Account>;

export const InvestmentAccountType = z.enum([
  "tfsa",
  "rrsp",
  "resp",
  "fhsa",
  "demat",
  "brokerage",
]);
export type InvestmentAccountType = z.infer<typeof InvestmentAccountType>;
