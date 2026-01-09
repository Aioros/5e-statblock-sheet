const TextEditor = foundry.applications.ux.TextEditor.implementation;

class StatblockSheet extends dnd5e.applications.actor.NPCActorSheet {

    rulesVersion;
    doubleColumn = false;
    
    constructor(options={}) {
        const newOptions = foundry.utils.deepClone(options);
        const key = `${StatblockSheet.sheetPrefsTypeKey}${options.document?.limited ? ":limited" : ""}`;
        const { width, height } = game.user.getFlag("dnd5e", `sheetPrefs.${key}`) ?? {};
        newOptions.position = options.position ?? {};
        if ( width && !("width" in newOptions.position) ) newOptions.position.width = width;
        if ( height && !("height" in newOptions.position) ) newOptions.position.height = height;
        super(newOptions);
    }

    static sheetPrefsTypeKey = "npc-statblock";

    /** @inheritdoc */
    static DEFAULT_OPTIONS = {
        classes: ["actor", "standard-form", "dnd5e2", "statblock-sheet"],
        actions: {
            use: StatblockSheet._onUseItem
        }
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
        await super._configureRenderOptions(options);
    }

    /** @inheritDoc */
    _replaceHTML(result, content, options) {
        content.innerHTML = "";
        super._replaceHTML(result, content, options);
    }

    /** @inheritDoc */
    async _onRender(context, options) {
        await super._onRender(context, options);
        super._onFirstRender(context, options);

        if (this._mode === this.constructor.MODES.PLAY) {

            for (const action of this.element.querySelectorAll(".statblock-action")) {
                const item = this.actor.items.find(i => i.id === action.dataset.id);
                // Wire action names
                const name = action.querySelector(".name");
                const enrichedName = document.createElement("span");
                enrichedName.classList.add("name", "statblock-roll-link-group");
                enrichedName.dataset.rollItemUuid = item.uuid;
                const uses = item.system.uses.label || (item.system.activities?.size === 1 ? item.system.activities?.contents[0]?.uses.label : undefined);
                const finalName = uses ? `${item.name} (${uses})` : item.name;
                enrichedName.innerHTML = `<span class="roll-link" data-action="use" data-item-id="${item.id}">${finalName}</span>`;
                name.remove();
                // Replace @UUID embeds with [[/item]] embeds
                const originalDescription = item.system.description.value;
                let description = originalDescription.replace(/@UUID\[(?<uuid>[^\]]+)\](?:\{(?<name>[^\}]+)\})?/g, (match, uuid, name) => {
                    const { id } = foundry.utils.parseUuid(uuid);
                    const itemOnActor = this.actor.items.get(id) ?? this.actor.items.getName(name);
                    if (itemOnActor) return `[[/item .${itemOnActor.id}]]`;
                    return match;
                });
                description = (await TextEditor.enrichHTML(description, {
                    secrets: false, rollData: item.getRollData(), relativeTo: item
                }));
                action.innerHTML = description;
                // Unwrap containing divs
                let isWrapped;
                do {
                    isWrapped = action.children.length === 1 && action.children[0].tagName === "DIV";
                    if (isWrapped) {
                        action.children[0].outerHTML = action.children[0].innerHTML;
                    }
                } while (isWrapped);
                // Insert the enriched name
                const firstParagraph = action.firstElementChild;
                if (firstParagraph) {
                    firstParagraph.prepend(enrichedName);
                }
            }

            // 2024 additions
            if (this.rulesVersion === "2024") {
                // Wire initiative (2024 only)
                [...this.element.querySelectorAll(".statblock-header div dt")]
                    .find(dt => dt.innerText === game.i18n.localize("DND5E.Initiative"))
                    .parentNode.querySelector("dd")
                    .innerHTML = `<span class="rollable" aria-label="Initiative" data-action="roll" data-type="initiative">${context.summary.initiative}</span>`;
                
                // Wire Gear
                //const gear = this.actor.system.getGear();
                const formatter = game.i18n.getListFormatter({ type: "unit" });
                const gear = formatter.format(
                    this.actor.system.getGear().map(i => {
                        let enrichedGear = `<span class="roll-link" data-action="use" data-item-id="${i.id}">${i.name}</span>`;
                        if (i.system.quantity > 1) enrichedGear += " " + formatNumber(i.system.quantity);
                        return enrichedGear;
                    })
                );
                const gearDd = [...this.element.querySelectorAll(".statblock-header div dt")]
                    .find(dt => dt.innerText === game.i18n.localize("DND5E.Gear"))
                    ?.parentNode.querySelector("dd");
                if (gearDd) {
                    gearDd.innerHTML = gear;
                }
                
                // Wire ability tables
                this.element.querySelectorAll(".statblock-header .abilities tbody tr").forEach(tr => {
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
                this.element.querySelectorAll(".statblock-header .ability .name").forEach(abilityNameSpan => {
                    const ability = abilityNameSpan.innerHTML;
                    abilityNameSpan.innerHTML = `<span class="rollable saving-throw" data-action="roll" data-type="ability" data-ability="${ability}">${abilityNameSpan.innerHTML}</span>`;
                    const scoreSpan = abilityNameSpan.parentNode.querySelector(".score");
                    scoreSpan.innerHTML = `<span class="rollable" data-action="roll" data-type="ability" data-ability="${ability}">${scoreSpan.innerHTML}</span>`;
                });
                
                // Wire saves
                const savesDd = [...this.element.querySelectorAll(".statblock-header div dt")]
                    .find(dt => dt.innerText === game.i18n.localize("DND5E.ClassSaves"))
                    ?.parentNode.querySelector("dd");
                    if (savesDd) {
                        savesDd.innerHTML = savesDd.innerHTML.replace(/([\w]+)\s.*?(?=(?:,\s|$))/ig, (abilityText, abilityAbbr) => {
                            return `<span class="rollable saving-throw" data-action="roll" data-type="ability" data-ability="${abilityAbbr.toLowerCase()}">${abilityText}</span>`;
                        });
                    }
            }

            // Wire skills
            const skillDd = [...this.element.querySelectorAll(".statblock-header div dt")]
                .find(dt => dt.innerText === game.i18n.localize("DND5E.Skills"))
                ?.parentNode.querySelector("dd");
                if (skillDd) {
                    skillDd.innerHTML = skillDd.innerHTML.replace(/([\w]+)\s.*?(?=(?:,\s|$))/ig, (skillText, skillLabel) => {
                        const abbreviation = Object.keys(CONFIG.DND5E.skills).find(key => CONFIG.DND5E.skills[key].label === skillLabel);
                        return `<span class="rollable" data-action="roll" data-type="skill" data-key="${abbreviation}">${skillText}</span>`;
                    });
                }

            // Add tooltips
            for (const link of this.element.querySelectorAll(".roll-link-group[data-type=item], .statblock-roll-link-group")) {
                let uuid = link.dataset.rollItemUuid;
                if (!uuid) {
                    const actor = await fromUuid(link.dataset.rollItemActor);
                    const item = actor?.items.getName(link.dataset.rollItemName);
                    uuid = item?.uuid;
                }
                link.dataset.tooltip = `<section class="loading" data-uuid="${uuid}"><i class="fas fa-spinner fa-spin-pulse"></i></section>`;
            }
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

    /** @inheritdoc */
    _onPosition(position) {
        if (this._mode === this.constructor.MODES.PLAY) {
            this.doubleColumn = position.width > position.height * 1.15;
            this.element.querySelector(".window-content").classList.toggle("double-column", this.doubleColumn);
            this.element.querySelector(".window-content").style.setProperty("--statblock-sheet-window-size", position.width + "px");
        }
        this._saveSheetPosition ??= foundry.utils.debounce(this.#saveSheetSize, 250);
        this._saveSheetPosition(position);
    }

    /**
     * Save the sheet's current size to preferences.
     * @param {ApplicationPosition} position
     */
    #saveSheetSize(position) {
        const { width, height } = position;
        const prefs = {};
        if ( width !== "auto" ) prefs.width = width;
        if ( height !== "auto" ) prefs.height = height;
        if ( foundry.utils.isEmpty(prefs) ) return;
        const key = `${StatblockSheet.sheetPrefsTypeKey}${this.actor.limited ? ":limited" : ""}`;
        game.user.setFlag("dnd5e", `sheetPrefs.${key}`, prefs);
    }

    static _onUseItem(event, target) {
        const { itemId } = target.closest("[data-item-id]")?.dataset ?? {};
        const item = this.actor.items.get(itemId);
        if ( !item || (target.ariaDisabled === "true") ) return;
        return item.use({ event });
    }
}

export class StatblockSheet2014 extends StatblockSheet {
    rulesVersion = "2014";
}

export class StatblockSheet2024 extends StatblockSheet {
    rulesVersion = "2024";
}