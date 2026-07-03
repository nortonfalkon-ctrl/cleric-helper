# PROJECT_CONTEXT.md — Cleric-helper

## Project identity

**Project name:** Cleric-helper  
**Repository:** `nortonfalkon-ctrl/cleric-helper`  
**Type:** Separate Foundry VTT module  
**Current version:** `0.1.8`  
**Status:** First working public release published on GitHub  
**Foundry target:** Foundry VTT v13  
**Game system target:** D&D 5e system, tested on dnd5e `5.3.3`  
**Main purpose:** Automate Life Domain cleric healing calculations that Foundry/dnd5e does not handle correctly by default.

This addon is separate from Imagine Interface. It may be tested together with Imagine Interface, but it must not depend on Imagine Interface unless explicitly required later.

---

## Current GitHub / release state

The module has been published to GitHub.

**Repository URL:**

```text
https://github.com/nortonfalkon-ctrl/cleric-helper
```

**Manifest URL for Foundry installation:**

```text
https://raw.githubusercontent.com/nortonfalkon-ctrl/cleric-helper/main/module.json
```

**Current release tag:**

```text
v0.1.8
```

**Current release ZIP URL:**

```text
https://github.com/nortonfalkon-ctrl/cleric-helper/releases/download/v0.1.8/cleric-helper-v0.1.8.zip
```

Foundry successfully installs the module using the manifest URL above.

---

## Current module structure

```text
cleric-helper/
├─ module.json
├─ README.md
├─ CHANGELOG.md
├─ scripts/
│  └─ cleric-helper.js
└─ lang/
   ├─ en.json
   └─ ru.json
```

The ZIP release must contain the module folder/files in a valid Foundry module layout. The archive attached to the release is named:

```text
cleric-helper-v0.1.8.zip
```

The `download` field in `module.json` must match the exact release asset filename.

---

## Current `module.json` requirements

The repository `module.json` must contain working metadata and links for install/update support:

```json
{
  "id": "cleric-helper",
  "title": "Cleric-helper",
  "description": "Foundry VTT module for automating Life Domain cleric healing bonuses in D&D 5e.",
  "version": "0.1.8",
  "authors": [
    {
      "name": "Norton Moon"
    }
  ],
  "compatibility": {
    "minimum": "13",
    "verified": "13"
  },
  "relationships": {
    "systems": [
      {
        "id": "dnd5e",
        "type": "system",
        "compatibility": {
          "minimum": "5.3.0",
          "verified": "5.3.3"
        }
      }
    ]
  },
  "scripts": [
    "scripts/cleric-helper.js"
  ],
  "languages": [
    {
      "lang": "en",
      "name": "English",
      "path": "lang/en.json"
    },
    {
      "lang": "ru",
      "name": "Русский",
      "path": "lang/ru.json"
    }
  ],
  "url": "https://github.com/nortonfalkon-ctrl/cleric-helper",
  "manifest": "https://raw.githubusercontent.com/nortonfalkon-ctrl/cleric-helper/main/module.json",
  "download": "https://github.com/nortonfalkon-ctrl/cleric-helper/releases/download/v0.1.8/cleric-helper-v0.1.8.zip",
  "readme": "https://raw.githubusercontent.com/nortonfalkon-ctrl/cleric-helper/main/README.md",
  "changelog": "https://raw.githubusercontent.com/nortonfalkon-ctrl/cleric-helper/main/CHANGELOG.md",
  "bugs": "https://github.com/nortonfalkon-ctrl/cleric-helper/issues"
}
```

If a new version is released, update both:

```json
"version": "0.1.9"
```

and:

```json
"download": "https://github.com/nortonfalkon-ctrl/cleric-helper/releases/download/v0.1.9/cleric-helper-v0.1.9.zip"
```

---

## Functional goal

The addon exists to automate two Life Domain cleric class features:

### 1. Disciple of Life / Поборник жизни

When a Life Domain cleric uses a spell of 1st level or higher to restore hit points to a creature, the creature regains additional hit points equal to:

```text
2 + spell slot level
```

Examples:

```text
1st-level slot → +3 healing
2nd-level slot → +4 healing
3rd-level slot → +5 healing
5th-level slot → +7 healing
```

This feature is implemented and working in `v0.1.8`.

### 2. Blessed Healer / Благословенный целитель

When a Life Domain cleric of 6th level or higher casts a spell of 1st level or higher that restores hit points to another creature, the cleric also regains hit points equal to:

```text
2 + spell slot level
```

This feature is **not implemented yet**.

---

## What currently works in v0.1.8

`v0.1.8` is the first confirmed working version.

Confirmed behavior:

- The module loads in Foundry VTT v13.
- The module works with dnd5e `5.3.3` healing rolls.
- The module successfully adds Disciple of Life to healing spell rolls.
- The module adds the correct value: `2 + spell slot level`.
- If the cleric does not have the required feature, the bonus is not added.
- The module can be installed through the GitHub manifest URL.
- The module has Russian and English localization.

Important test that succeeded:

```text
Healing Word / Исцеляющее слово
Slot level: 3
Expected bonus: +5
Result: bonus was added successfully
```

The console showed:

```text
Cleric-helper | Patched CONFIG.Dice.DamageRoll.build.
Cleric-helper | Ready v0.1.8. DamageRoll.build patch is active.
Cleric-helper | Added Disciple of Life: +5 to Исцеляющее слово / Healing Word (Тестовый жрец, slot 3).
```

---

## Important implementation note

Several earlier attempts using standard dnd5e hooks did not work reliably in this environment:

- `dnd5e.preRollDamage`
- `dnd5e.preRollDamageV2`
- `dnd5e.postDamageRollConfiguration`
- `dnd5e.postUseActivity`
- chat-message post-processing fallback

The working approach in `v0.1.8` is to patch:

```js
CONFIG.Dice.DamageRoll.build
```

This is the point where dnd5e 5.3.3 actually builds the healing `DamageRoll`. The module injects the Disciple of Life bonus into the roll configuration before the final healing roll is created.

This patch is the current known-good approach. Do not replace it casually with earlier hook-based approaches unless testing proves the replacement works.

---

## Current feature detection behavior

The module checks whether the actor should receive the Disciple of Life bonus.

Known valid markers include:

```text
Disciple of Life
Поборник жизни
Life Domain
Домен жизни
Cleric + Life
Жрец + жизнь
```

There is also a module setting that can require the actor to have Disciple of Life / Поборник жизни. During testing this should generally remain enabled, because the desired behavior is:

```text
No Disciple of Life feature → no bonus
```

This behavior was confirmed working.

Note: In one user message the feature was accidentally called “Защитник жизни”, but the intended feature is “Поборник жизни”. Do not rename the mechanic to “Защитник жизни”.

---

## Known issue from early test builds

Earlier experimental versions accidentally wrote an invalid value into some healing activity data:

```text
healing.bonus: "2"
```

dnd5e expects the bonus formula to begin with an operator, such as:

```text
+ 2
```

Because of that, logs from old test actors may contain errors like:

```text
HealActivity validation errors:
healing:
  bonus: Expected [%*/], [+\-], end of input, or whitespace but "2" found.
```

`v0.1.8` includes a repair pass for invalid numeric `healing.bonus` values left by earlier test builds, but old actors may still show this error in some cases.

This old error did not prevent `v0.1.8` from successfully adding Disciple of Life during the confirmed working test.

Possible future improvement:

- Add a visible GM-only repair button or command to scan actors and clean invalid numeric `healing.bonus` values.

---

## Release notes for v0.1.8

English:

```markdown
## Cleric-helper v0.1.8

First working release.

### Added
- Automates Disciple of Life healing bonus for Life Domain clerics.
- Adds `2 + spell slot level` to healing spell rolls.
- Works with Foundry VTT v13 and dnd5e 5.3.3 healing rolls.
- Requires the actor to have Disciple of Life / Поборник жизни, unless this requirement is disabled in module settings.
- Includes Russian and English localization.

### Notes
- Blessed Healer is not implemented yet.
- Some old test actors may still contain invalid `healing.bonus` data left by earlier test builds.
```

Russian:

```markdown
## Cleric-helper v0.1.8

Первый рабочий релиз.

### Добавлено
- Автоматизирует бонус лечения «Поборник жизни» для жрецов Домена жизни.
- Добавляет `2 + уровень ячейки заклинания` к броскам исцеляющих заклинаний.
- Работает с Foundry VTT v13 и бросками лечения dnd5e 5.3.3.
- Требует, чтобы у актёра была особенность Disciple of Life / Поборник жизни, если это требование не отключено в настройках модуля.
- Включает русскую и английскую локализацию.

### Примечания
- «Благословенный целитель» пока не реализован.
- У некоторых старых тестовых актёров могут оставаться некорректные данные `healing.bonus`, оставшиеся после ранних тестовых сборок.
```

---

## GitHub workflow for future updates

When preparing a new version:

1. Update code.
2. Update `README.md` if needed.
3. Update `CHANGELOG.md`.
4. Update `module.json`:
   - `version`
   - `download`
5. Package ZIP with the exact matching release filename.
6. Upload changed files to GitHub.
7. Commit with a clear message.
8. Create a new GitHub release tag.
9. Attach the ZIP file.
10. Publish release.
11. Test update/install through Foundry using the manifest URL.

Example for `v0.1.9`:

```text
Tag: v0.1.9
ZIP: cleric-helper-v0.1.9.zip
Download URL: https://github.com/nortonfalkon-ctrl/cleric-helper/releases/download/v0.1.9/cleric-helper-v0.1.9.zip
Manifest URL: https://raw.githubusercontent.com/nortonfalkon-ctrl/cleric-helper/main/module.json
```

---

## Packaging rules

Use this convention:

```text
cleric-helper-vX.Y.Z.zip
```

Inside the ZIP, the module must be installable by Foundry and contain the correct `module.json` with matching version and download URL.

Before publishing, verify that:

- the ZIP filename matches `module.json.download`;
- the ZIP contains the updated `module.json`;
- the repository root `module.json` also has the same metadata;
- Foundry can install from the manifest URL.

---

## Development style

Use a minimal, safe approach:

- Avoid broad rewrites.
- Keep the module small and focused.
- Prioritize compatibility with Foundry VTT v13 and dnd5e 5.3.x.
- Do not modify actor or item data unless required.
- Avoid persistent data migrations unless they are explicitly needed and tested.
- Prefer readable code and clear settings over hidden behavior.
- Keep Russian and English localization in sync.

---

## Current roadmap

### High priority

1. Continue testing `v0.1.8` with different healing spells:
   - Healing Word / Исцеляющее слово
   - Cure Wounds / Лечение ран
   - Mass Cure Wounds / Массовое лечение ран
   - Prayer of Healing / Молитва лечения
   - Aura of Vitality / Аура живучести, if applicable

2. Confirm multi-target healing behavior.

3. Confirm that non-Life clerics and non-clerics do not get the bonus.

4. Confirm behavior when the Disciple of Life requirement setting is enabled/disabled.

### Next feature

Implement Blessed Healer / Благословенный целитель:

- Detect when the cleric heals another creature.
- Apply self-healing equal to `2 + spell slot level`.
- Avoid triggering when the cleric only heals themselves.
- Avoid double application for multi-target healing.
- Decide whether the self-healing should be automatic HP modification or a chat card/button.

### Possible quality-of-life improvements

- Add GM repair tool for invalid `healing.bonus` values.
- Improve debug logging setting.
- Add clearer chat message when Disciple of Life is applied.
- Add settings for feature-name matching if localization/imported compendiums differ.

---

## Current known-good summary

```text
Project: Cleric-helper
Version: 0.1.8
Status: Working and published
Manifest URL: working
Foundry install: working
Disciple of Life: working
Blessed Healer: not yet implemented
Main technical solution: patch CONFIG.Dice.DamageRoll.build
Primary compatibility target: Foundry VTT v13 + dnd5e 5.3.3
```
