import type { CompendiumEntry, RulePackMeta } from "@valtherion/contracts";
import { Dice } from "@valtherion/domain";
import type { AbilityCheckInput, RollResult, RuleSystem } from "@valtherion/domain";
import { COMPENDIUM } from "./compendium";

const meta: RulePackMeta = {
  id: "dnd-2024",
  name: "Dungeons & Dragons 2024 (5.5)",
  version: "0.1.0",
  description:
    "Pack inicial orientado a D&D 2024. Compendium mínimo + dados. Ampliar con SRD y contenido de campaña.",
};

function rollD20(advantage?: boolean, disadvantage?: boolean): { natural: number; detail: string } {
  if (advantage && !disadvantage) {
    const a = Dice.d(20);
    const b = Dice.d(20);
    return { natural: Math.max(a, b), detail: `ventaja(${a},${b})` };
  }
  if (disadvantage && !advantage) {
    const a = Dice.d(20);
    const b = Dice.d(20);
    return { natural: Math.min(a, b), detail: `desventaja(${a},${b})` };
  }
  const n = Dice.d(20);
  return { natural: n, detail: `${n}` };
}

export const dnd2024: RuleSystem = {
  meta,
  rollAbilityCheck(input: AbilityCheckInput): RollResult {
    const { natural, detail } = rollD20(input.advantage, input.disadvantage);
    const prof =
      input.proficient && input.proficiencyBonus != null ? input.proficiencyBonus : 0;
    const total = natural + input.modifier + prof;
    return {
      natural,
      total,
      detail: `d20 ${detail} + ${input.modifier}${prof ? ` + comp ${prof}` : ""} = ${total}`,
    };
  },
  rollInitiative(dexMod: number): RollResult {
    const { natural, detail } = rollD20();
    const total = natural + dexMod;
    return {
      natural,
      total,
      detail: `iniciativa d20 ${detail} + ${dexMod} = ${total}`,
    };
  },
  listCompendium(category?: string): CompendiumEntry[] {
    if (!category) return COMPENDIUM;
    return COMPENDIUM.filter((e) => e.category === category);
  },
  getCompendiumEntry(id: string) {
    return COMPENDIUM.find((e) => e.id === id);
  },
};

export { COMPENDIUM };
export default dnd2024;
