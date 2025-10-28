const TextEditor = foundry.applications.ux.TextEditor.implementation;

class StatblockSheet extends dnd5e.applications.actor.NPCActorSheet {

    rulesVersion;

    /** @inheritdoc */
    static DEFAULT_OPTIONS = {
        classes: ["actor", "standard-form", "dnd5e2", "statblock-sheet"]
    };

    /** @inheritdoc */
    static PARTS = {
        ...super.PARTS,
        statblock: {
            container: { classes: ["main-content"], id: "main" },
            template: "systems/dnd5e/templates/actors/embeds/npc-embed.hbs"
        }
    };

    /** @inheritdoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        Object.assign(context, {
            ...await this.actor.system._prepareEmbedContext(this.rulesVersion),
            name: this.actor.name
        });

        // Redo the actions to add enrichers to the names
        context.actionSections = {
            trait: {
                label: game.i18n.localize("DND5E.NPC.SECTIONS.Traits"),
                hideLabel: this.rulesVersion === "2014",
                actions: []
            },
            action: {
                label: game.i18n.localize("DND5E.NPC.SECTIONS.Actions"),
                actions: []
            },
            bonus: {
                label: game.i18n.localize("DND5E.NPC.SECTIONS.BonusActions"),
                actions: []
            },
            reaction: {
                label: game.i18n.localize("DND5E.NPC.SECTIONS.Reactions"),
                actions: []
            },
            legendary: {
                label: game.i18n.localize("DND5E.NPC.SECTIONS.LegendaryActions"),
                description: "",
                actions: []
            }
        };

        for ( const item of this.actor.items ) {
            if ( !["feat", "weapon"].includes(item.type) ) continue;
            const category = item.system.properties.has("trait") ? "trait"
                : (item.system.activities?.contents[0]?.activation?.type ?? "trait");
            if ( category in context.actionSections ) {
                let description = (await TextEditor.enrichHTML(item.system.description.value, {
                    secrets: false, rollData: item.getRollData(), relativeTo: item
                }));
                if ( item.identifier === "legendary-actions" ) {
                    context.actionSections.legendary.description = description;
                } else {
                    const openingTag = description.match(/^\s*(<p(?:\s[^>]+)?>)/gi)?.[0];
                    if ( openingTag ) description = description.replace(openingTag, "");
                    const uses = item.system.uses.label || item.system.activities?.contents[0]?.uses.label;
                    const enrichedName = (await TextEditor.enrichHTML(`[[/item ${item.id}]]`, {
                        secrets: false, rollData: item.getRollData(), relativeTo: item
                    }));
                    context.actionSections[category].actions.push({
                        description,
                        openingTag: openingTag + enrichedName,
                        name: "",
                        sort: item.sort
                    });
                }
            }
        }
        for ( const [key, section] of Object.entries(context.actionSections) ) {
            if ( section.actions.length ) {
                section.actions.sort((lhs, rhs) => lhs.sort - rhs.sort);
                if ( (key === "legendary") && !section.description ) {
                    section.description = `<p>${this.getLegendaryActionsDescription()}</p>`;
                }
            } else delete context.actionSections[key];
        }

        return context;
    }

    /** @inheritdoc */
    _configureRenderParts(options) {
        let parts = super._configureRenderParts(options);
        if (this._mode === this.constructor.MODES.EDIT) {
            delete parts.statblock;
        } else {
            parts = { statblock: parts.statblock };
        }
        return parts;
    }

    /** @inheritdoc */
    async _configureRenderOptions(options) {
        options.isFirstRender = true;
        await super._configureRenderOptions(options);
    }

    /** @inheritDoc */
    async _onRender(context, options) {
        await super._onRender(context, options);

        if (this._mode === this.constructor.MODES.PLAY) {

            // 2024 additions
            if (this.rulesVersion === "2024") {
                // Wire initiative (2024 only)
                [...this.element.querySelectorAll(".statblock-header div dt")]
                    .find(dt => dt.innerText === game.i18n.localize("DND5E.Initiative"))
                    .parentNode.querySelector("dd")
                    .innerHTML = `<span class="rollable" aria-label="Initiative" data-action="roll" data-type="initiative">${context.summary.initiative}</span>`;
                
                // Wire ability tables
                [...this.element.querySelectorAll(".statblock-header .abilities tbody tr")].forEach(tr => {
                    const abbreviationBox = tr.querySelector("th");
                    const abbreviation = abbreviationBox.innerText.toLowerCase();
                    abbreviationBox.innerHTML = `<span class="rollable saving-throw" data-action="roll" data-type="ability" data-ability="${abbreviation}">${abbreviationBox.innerHTML}</span>`;
                    const abilityScoreBox = tr.querySelector(".score");
                    abilityScoreBox.innerHTML = `<span class="rollable" data-action="roll" data-type="ability" data-ability="${abbreviation}">${abilityScoreBox.innerHTML}</span>`;
                    const abilityModBox = tr.querySelector("td:nth-of-type(2)");
                    abilityModBox.innerHTML = `<span class="rollable" data-action="roll" data-type="ability" data-ability="${abbreviation}">${abilityModBox.innerHTML}</span>`;
                    const abilitySaveBox = tr.querySelector("td:nth-of-type(3)");
                    abilitySaveBox.innerHTML = `<span class="rollable saving-throw" data-action="roll" data-type="ability" data-ability="${abbreviation}">${abilitySaveBox.innerHTML}</span>`;
                });
            }

            // 2014 additions
            else {
                // Wire abilities
                [...this.element.querySelectorAll(".statblock-header .ability .name")].forEach(abilityNameSpan => {
                    const ability = abilityNameSpan.innerHTML;
                    abilityNameSpan.innerHTML = `<span class="rollable saving-throw" data-action="roll" data-type="ability" data-ability="${ability}">${abilityNameSpan.innerHTML}</span>`;
                    const scoreSpan = abilityNameSpan.parentNode.querySelector(".score");
                    scoreSpan.innerHTML = `<span class="rollable" data-action="roll" data-type="ability" data-ability="${ability}">${scoreSpan.innerHTML}</span>`;
                });
                
                // Wire saves
                const savesDd = [...this.element.querySelectorAll(".statblock-header div dt")]
                    .find(dt => dt.innerText === game.i18n.localize("DND5E.ClassSaves"))
                    .parentNode.querySelector("dd");
                    savesDd.innerHTML = savesDd.innerHTML.replace(/([\w]+)\s.*?(?=(?:,\s|$))/ig, (abilityText, abilityAbbr) => {
                        return `<span class="rollable saving-throw" data-action="roll" data-type="ability" data-ability="${abilityAbbr.toLowerCase()}">${abilityText}</span>`;
                    });
            }

            // Wire skills
            const skillDd = [...this.element.querySelectorAll(".statblock-header div dt")]
                .find(dt => dt.innerText === game.i18n.localize("DND5E.Skills"))
                .parentNode.querySelector("dd");
                skillDd.innerHTML = skillDd.innerHTML.replace(/([\w]+)\s.*?(?=(?:,\s|$))/ig, (skillText, skillLabel) => {
                    const abbreviation = Object.keys(CONFIG.DND5E.skills).find(key => CONFIG.DND5E.skills[key].label === skillLabel);
                    return `<span class="rollable" data-action="roll" data-type="skill" data-key="${abbreviation}">${skillText}</span>`;
                });
        }
    }

    /** @inheritdoc */
    _renderCreateInventory() { 
        if (this._mode === this.constructor.MODES.EDIT) {
            return super._renderCreateInventory();
        }
    }
    /** @inheritdoc */
    _renderAttunement(context, options) {
        if (this._mode === this.constructor.MODES.EDIT) {
            return super._renderAttunement(context, options);
        }
    }
    /** @inheritdoc */
    _renderSpellbook(context, options) {
        if (this._mode === this.constructor.MODES.EDIT) {
            return super._renderSpellbook(context, options);
        }
    }
}

export class StatblockSheet2014 extends StatblockSheet {
    rulesVersion = "2014";
}

export class StatblockSheet2024 extends StatblockSheet {
    rulesVersion = "2024";
}