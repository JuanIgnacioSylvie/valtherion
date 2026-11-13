import type { CompendiumEntry, RulePackMeta } from "@valtherion/contracts";

export interface AbilityCheckInput {
  modifier: number;
  proficient?: boolean;
  proficiencyBonus?: number;
  advantage?: boolean;
  disadvantage?: boolean;
}

export interface RollResult {
  total: number;
  detail: string;
  natural: number;
}

export interface RuleSystem {
  meta: RulePackMeta;
  rollAbilityCheck(input: AbilityCheckInput): RollResult;
  rollInitiative(dexMod: number): RollResult;
  listCompendium(category?: string): CompendiumEntry[];
  getCompendiumEntry(id: string): CompendiumEntry | undefined;
}
