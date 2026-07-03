/*
 * Cleric-helper
 * Foundry VTT v13 / dnd5e helper for Life Domain Cleric healing.
 * v0.1.8 uses a direct DamageRoll.build patch because dnd5e 5.3.x HealActivity can bypass/obscure roll hooks.
 */

(() => {
  "use strict";

  const MODULE_ID = "cleric-helper";
  const MODULE_TITLE = "Cleric-helper";
  const MODULE_VERSION = "0.1.8";

  const FEATURE_DISCIPLE = /disciple\s+of\s+life|поборник\s+жизни|ученик\s+жизни|адепт\s+жизни/i;
  const FEATURE_BLESSED = /blessed\s+healer|благословенн(?:ый|ая|ое|ые)\s+целител/i;
  const LIFE_DOMAIN = /life\s+domain|domain\s+of\s+life|домен\s+жизни|жизн(?:и|ь)\s+домен/i;
  const CLERIC = /cleric|жрец/i;
  const LIFE_WORD = /life|жизн/i;

  const info = (...args) => console.info(`${MODULE_TITLE} |`, ...args);
  const warn = (...args) => console.warn(`${MODULE_TITLE} |`, ...args);
  const debug = (...args) => {
    try {
      if (game.settings?.get(MODULE_ID, "debug")) console.log(`${MODULE_TITLE} |`, ...args);
    } catch (_error) {}
  };

  Hooks.once("init", () => {
    game.settings.register(MODULE_ID, "debug", {
      name: "CLERIC_HELPER.Settings.Debug.Name",
      hint: "CLERIC_HELPER.Settings.Debug.Hint",
      scope: "world",
      config: true,
      type: Boolean,
      default: false
    });

    game.settings.register(MODULE_ID, "chatNotice", {
      name: "CLERIC_HELPER.Settings.ChatNotice.Name",
      hint: "CLERIC_HELPER.Settings.ChatNotice.Hint",
      scope: "world",
      config: true,
      type: Boolean,
      default: true
    });

    game.settings.register(MODULE_ID, "requireDiscipleFeature", {
      name: "CLERIC_HELPER.Settings.RequireDiscipleFeature.Name",
      hint: "CLERIC_HELPER.Settings.RequireDiscipleFeature.Hint",
      scope: "world",
      config: true,
      type: Boolean,
      default: true
    });

    game.settings.register(MODULE_ID, "autoRepairInvalidHealingBonus", {
      name: "CLERIC_HELPER.Settings.AutoRepair.Name",
      hint: "CLERIC_HELPER.Settings.AutoRepair.Hint",
      scope: "world",
      config: true,
      type: Boolean,
      default: true
    });
  });

  Hooks.once("ready", async () => {
    if (game.system?.id !== "dnd5e") {
      warn("This module is intended for the dnd5e system. Current system:", game.system?.id);
      return;
    }

    patchDamageRollBuild();

    if (game.user?.isGM && game.settings?.get(MODULE_ID, "autoRepairInvalidHealingBonus")) {
      await repairInvalidHealingBonuses();
    }

    info(`Ready v${MODULE_VERSION}. DamageRoll.build patch is active.`);
  });

  function patchDamageRollBuild() {
    const cls = CONFIG?.Dice?.DamageRoll;
    if (!cls || cls.__clericHelperPatched) return;

    const originalBuild = cls.build;
    cls.build = async function clericHelperBuild(config = {}, dialog = {}, message = {}) {
      try {
        applyDiscipleToDamageRollBuildConfig(config, dialog, message);
      } catch (error) {
        console.error(`${MODULE_TITLE} | Failed before DamageRoll.build`, error);
      }
      return originalBuild.call(this, config, dialog, message);
    };

    cls.__clericHelperPatched = true;
    info("Patched CONFIG.Dice.DamageRoll.build.");
  }

  function applyDiscipleToDamageRollBuildConfig(config = {}, dialog = {}, message = {}) {
    if (foundry.utils.getProperty(config, `flags.${MODULE_ID}.discipleOfLife.applied`)) return;

    const activity = config.subject;
    const item = activity?.item;
    const actor = item?.actor ?? activity?.actor;

    const rollType = String(
      foundry.utils.getProperty(message, "data.flags.dnd5e.roll.type")
      ?? foundry.utils.getProperty(message, "flags.dnd5e.roll.type")
      ?? ""
    ).toLowerCase();

    debug("DamageRoll.build candidate", { rollType, config, dialog, message, activity, item, actor });

    if (!isLifeDomainHealingSpell(activity, item, actor, rollType, config)) return;

    const rollConfig = Array.isArray(config.rolls) ? config.rolls[0] : null;
    if (!rollConfig) {
      debug("Skipped: no config.rolls[0].", { config });
      return;
    }

    rollConfig.parts ??= [];
    if (!Array.isArray(rollConfig.parts)) rollConfig.parts = [String(rollConfig.parts)].filter(Boolean);

    const slotLevel = getSpellSlotLevel(activity, item, config, message);
    const bonus = getLifeDomainBonus(slotLevel);
    if (bonus <= 0) return;

    rollConfig.options ??= {};
    if (foundry.utils.getProperty(rollConfig.options, `flags.${MODULE_ID}.discipleOfLife.applied`)) return;

    rollConfig.parts.push(String(bonus));

    const details = {
      applied: true,
      source: "DamageRoll.build",
      bonus,
      slotLevel,
      itemName: item?.name,
      actorName: actor?.name
    };

    foundry.utils.setProperty(rollConfig.options, `flags.${MODULE_ID}.discipleOfLife`, details);
    foundry.utils.setProperty(config, `flags.${MODULE_ID}.discipleOfLife`, details);

    info(`Added Disciple of Life: +${bonus} to ${item?.name ?? "healing spell"} (${actor?.name ?? "unknown actor"}, slot ${slotLevel}).`);

    if (game.settings?.get(MODULE_ID, "chatNotice")) createDiscipleNotice(actor, item, bonus, slotLevel, false);
  }

  // Fallbacks kept in case another module replaces DamageRoll.build after us.
  Hooks.on("dnd5e.preRollDamage", (config = {}, dialog = {}, message = {}) => {
    try { applyDiscipleToDamageRollBuildConfig(config, dialog, message); }
    catch (error) { console.error(`${MODULE_TITLE} | Failed during dnd5e.preRollDamage`, error); }
  });

  Hooks.on("dnd5e.preRollDamageV2", (config = {}, dialog = {}, message = {}) => {
    try { applyDiscipleToDamageRollBuildConfig(config, dialog, message); }
    catch (error) { console.error(`${MODULE_TITLE} | Failed during dnd5e.preRollDamageV2`, error); }
  });

  Hooks.on("dnd5e.rollDamageV2", (rolls, data = {}) => {
    try { addFallbackToEvaluatedRolls(rolls, data?.subject, data); }
    catch (error) { console.error(`${MODULE_TITLE} | Failed during dnd5e.rollDamageV2`, error); }
  });

  function isLifeDomainHealingSpell(activity, item, actor, rollType, config = {}) {
    const activityType = String(activity?.type ?? activity?.activityType ?? activity?.metadata?.type ?? "").toLowerCase();
    const isHealing = (activityType === "heal") || (rollType === "healing");
    if (!isHealing) return false;

    if (!item || item.type !== "spell") return false;

    const baseLevel = Number(item.system?.level ?? 0);
    if (!Number.isFinite(baseLevel) || baseLevel < 1) return false;

    const hasRoll = Array.isArray(config.rolls) && config.rolls.length > 0;
    const formula = String(activity?.healing?.formula ?? "").trim();
    if (!hasRoll && !formula) return false;

    const requireFeature = game.settings?.get(MODULE_ID, "requireDiscipleFeature");
    if (!requireFeature) return true;

    const detected = actorHasLifeDomain(actor);
    if (!detected) debug("Skipped: Life Domain / Disciple of Life not detected on actor.", { actor, item });
    return detected;
  }

  function actorHasLifeDomain(actor) {
    if (!actor) return false;

    let hasCleric = false;
    let hasLife = false;

    for (const item of actor.items ?? []) {
      const name = String(item?.name ?? "");
      const type = String(item?.type ?? "");
      const identifier = String(item?.system?.identifier ?? item?.flags?.dnd5e?.identifier ?? "");
      const subclass = String(item?.system?.subclass ?? item?.system?.subclassIdentifier ?? item?.system?.subclass?.identifier ?? "");
      const all = `${name} ${identifier} ${subclass}`;

      if (FEATURE_DISCIPLE.test(all)) return true;
      if (LIFE_DOMAIN.test(all)) return true;

      if ((type === "class") && CLERIC.test(all)) hasCleric = true;
      if ((type === "subclass") && LIFE_WORD.test(all)) hasLife = true;
      if (CLERIC.test(name) && LIFE_WORD.test(subclass)) return true;
    }

    return hasCleric && hasLife;
  }

  function getSpellSlotLevel(activity, item, config = {}, message = {}) {
    const baseLevel = Number(item?.system?.level ?? activity?.spell?.level ?? 0);

    const explicitSpellLevel = firstFiniteNumber(
      foundry.utils.getProperty(message, "data.system.spellLevel"),
      foundry.utils.getProperty(message, "system.spellLevel"),
      config?.spellLevel,
      config?.slotLevel,
      foundry.utils.getProperty(config, "spell.level"),
      foundry.utils.getProperty(config, "spell.slotLevel"),
      foundry.utils.getProperty(config, "spell.slot")
    );

    const scalingIncrease = firstFiniteNumber(
      config?.scaling,
      config?.scaling?.increase,
      config?.scalingIncrease,
      foundry.utils.getProperty(message, "data.system.scaling"),
      foundry.utils.getProperty(message, "system.scaling"),
      foundry.utils.getProperty(item, "flags.dnd5e.scaling")
    );

    const calculated = Number.isFinite(baseLevel) ? baseLevel + (Number.isFinite(scalingIncrease) ? scalingIncrease : 0) : 0;

    const level = Math.max(
      Number.isFinite(baseLevel) ? baseLevel : 0,
      Number.isFinite(explicitSpellLevel) ? explicitSpellLevel : 0,
      Number.isFinite(calculated) ? calculated : 0
    );

    debug("Resolved slot level", { baseLevel, explicitSpellLevel, scalingIncrease, calculated, level, config, message });
    return level;
  }

  function firstFiniteNumber(...values) {
    for (const value of values) {
      if (value === null || value === undefined || value === false || value === "") continue;
      if (typeof value === "string") {
        const slot = value.match(/spell(\d+)/i)?.[1];
        if (slot) return Number(slot);
      }
      const number = Number(value);
      if (Number.isFinite(number) && number > 0) return number;
    }
    return NaN;
  }

  function getLifeDomainBonus(slotLevel) {
    if (!Number.isFinite(slotLevel) || slotLevel < 1) return 0;
    return 2 + slotLevel;
  }

  function addFallbackToEvaluatedRolls(rolls, activity, data = {}) {
    if (!Array.isArray(rolls) || !rolls.length) return;

    const firstRoll = rolls[0];
    if (foundry.utils.getProperty(firstRoll, `options.flags.${MODULE_ID}.discipleOfLife.applied`)) return;

    const item = activity?.item;
    const actor = item?.actor ?? activity?.actor;

    const rollType = String(firstRoll?.options?.rollType ?? foundry.utils.getProperty(data, "message.data.flags.dnd5e.roll.type") ?? "").toLowerCase();
    if (!isLifeDomainHealingSpell(activity, item, actor, rollType, data)) return;

    const slotLevel = getSpellSlotLevel(activity, item, data, data?.message);
    const bonus = getLifeDomainBonus(slotLevel);
    if (bonus <= 0) return;

    forceAddBonusToEvaluatedRoll(firstRoll, bonus);
    foundry.utils.setProperty(firstRoll, `options.flags.${MODULE_ID}.discipleOfLife`, {
      applied: true,
      source: "rollDamageV2 fallback",
      bonus,
      slotLevel
    });

    info(`Fallback-applied Disciple of Life: +${bonus}.`);
  }

  function forceAddBonusToEvaluatedRoll(roll, bonus) {
    const originalFormula = roll.formula ?? roll._formula ?? "0";
    const originalTotal = Number(roll.total ?? roll._total ?? 0);

    roll._formula = `(${originalFormula}) + ${bonus}`;
    try { roll.formula = roll._formula; } catch (_error) {}
    if (Number.isFinite(originalTotal)) roll._total = originalTotal + bonus;

    try {
      const { NumericTerm, OperatorTerm } = foundry.dice.terms;
      if (Array.isArray(roll.terms)) {
        roll.terms.push(new OperatorTerm({ operator: "+" }));
        roll.terms.push(new NumericTerm({ number: bonus, options: { flavor: game.i18n.localize("CLERIC_HELPER.RollFlavor.Disciple") } }));
      }
    } catch (error) {
      debug("Could not append visual roll terms.", error);
    }
  }

  async function repairInvalidHealingBonuses() {
    if (!game.user?.isGM) return;

    for (const actor of game.actors ?? []) {
      const sourceItems = actor?._source?.items ?? [];
      const updates = [];

      for (const itemSource of sourceItems) {
        const activities = itemSource?.system?.activities ?? {};
        for (const [activityId, activityData] of Object.entries(activities)) {
          if (activityData?.type !== "heal") continue;
          const bonus = activityData?.healing?.bonus;
          if ((typeof bonus === "string") && /^\s*\d+(?:\.\d+)?\s*$/.test(bonus)) {
            updates.push({
              _id: itemSource._id,
              [`system.activities.${activityId}.healing.bonus`]: ""
            });
          }
        }
      }

      if (!updates.length) continue;

      try {
        await actor.updateEmbeddedDocuments("Item", updates);
        info(`Repaired ${updates.length} invalid healing.bonus value(s) on ${actor.name}.`);
      } catch (error) {
        warn(`Could not repair invalid healing.bonus values on ${actor.name}.`, error);
      }
    }
  }

  function createDiscipleNotice(actor, item, bonus, slotLevel, fallback) {
    if (!Number.isFinite(Number(bonus)) || !Number.isFinite(Number(slotLevel))) return;

    const content = `
      <div class="cleric-helper-chat-card">
        <h3>${game.i18n.localize("CLERIC_HELPER.Chat.Title")}</h3>
        <p><strong>${game.i18n.localize("CLERIC_HELPER.Chat.Disciple")}:</strong> +${bonus}</p>
        <p><strong>${game.i18n.localize("CLERIC_HELPER.Chat.Spell")}:</strong> ${foundry.utils.escapeHTML(item?.name ?? "Unknown")}</p>
        <p><strong>${game.i18n.localize("CLERIC_HELPER.Chat.SlotLevel")}:</strong> ${slotLevel}</p>
        <p><strong>${game.i18n.localize("CLERIC_HELPER.Chat.BonusFormula")}:</strong> 2 + ${slotLevel} = ${bonus}</p>
        <p><em>${game.i18n.localize(fallback ? "CLERIC_HELPER.Chat.AppliedFallback" : "CLERIC_HELPER.Chat.Applied")}</em></p>
      </div>
    `;

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content,
      whisper: game.users.filter(u => u.isGM).map(u => u.id)
    });
  }
})();
