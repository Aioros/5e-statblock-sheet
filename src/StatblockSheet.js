const TextEditor = foundry.applications.ux.TextEditor.implementation;

class StatblockSheet extends dnd5e.applications.actor.NPCActorSheet {

    rulesVersion;
    baseActor;
    
    constructor(options={}) {
        super(options);
        this.baseActor = this.actor.isToken ? this.actor.parent.baseActor : this.actor;
    }

    /** @inheritdoc */
    static DEFAULT_OPTIONS = {
        classes: ["actor", "standard-form", "dnd5e2", "statblock-sheet"],
        actions: {
            use: StatblockSheet._onUseItem,
            toggleDoubleColumn: StatblockSheet._toggleDoubleColumn,
            toggleBiography: StatblockSheet._toggleBiography,
            zoomIn: StatblockSheet._zoomIn,
            zoomOut: StatblockSheet._zoomOut,
            zoomReset: StatblockSheet._zoomReset
        }
    };

    /** @inheritdoc */
    static PARTS = {
        ...super.PARTS,
        statblock: {
            container: { classes: ["main-content"], id: "main" },
            template: "systems/dnd5e/templates/actors/embeds/npc-embed.hbs"
        },
        biographyView: {
            container: { classes: ["main-content"], id: "main" },
            template: "modules/5e-statblock-sheet/templates/biography.hbs"
        }
    };

    /** @inheritdoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        Object.assign(context, {
            ...await this.actor.system._prepareEmbedContext(this.rulesVersion),
            name: this.actor.name
        });
        context.biography = await this._prepareBiographyContext(context, { rollData: context.rollData });
        const defaultSettings = {
            doubleColumn: game.settings.get("5e-statblock-sheet", "defaultLayout") === "doubleColumn",
            visibleBiography: game.settings.get("5e-statblock-sheet", "defaultVisibleBiography"),
            zoom: game.settings.get("5e-statblock-sheet", "defaultZoom") / 100
        };
        context.sheetPrefs = foundry.utils.duplicate(defaultSettings);
        context.sheetPrefs = foundry.utils.mergeObject(context.sheetPrefs, this.baseActor.getFlag("5e-statblock-sheet", "sheetPrefs") ?? {});
        //console.log(context);
        return context;
    }

      /** @inheritDoc */
    _configureRenderOptions(options) {
        super._configureRenderOptions(options);
        const { width, height } = this.baseActor.getFlag("5e-statblock-sheet", "sheetPrefs") ?? {};
        options.position = options.position ?? {};
        if ( width ) options.position.width = width;
        if ( height ) options.position.height = height;
    }

    /** @inheritdoc */
    _configureRenderParts(options) {
        let parts = super._configureRenderParts(options);
        if (this._mode === this.constructor.MODES.EDIT) {
            if (parts.statblock) {
                parts.statblock.classes ??= [];
                parts.statblock.classes.push("hidden");
            }
            if (parts.biographyView) {
                parts.biographyView.classes ??= [];
                parts.biographyView.classes.push("hidden");
            }
        } else {
            Object.keys(parts).filter(p => !["statblock", "biographyView"].includes(p)).forEach(p => {
                parts[p].classes ??= [];
                parts[p].classes.push("hidden");
            });
        }
        return parts;
    }

    /** @inheritDoc */
    async _onRender(context, options) {
        await super._onRender(context, options);
        this._renderSpellbook({...context, editable: false }, options);

        if (this._mode === this.constructor.MODES.PLAY) {
            // Move bio after statblock
            this.element.querySelector(`[data-application-part="statblock"]`).after(this.element.querySelector(`[data-application-part="biographyView"]`));

            // Inject bio toggle
            const bioToggle = document.createElement("i");
            bioToggle.classList.add("statblock-control", "toggle-biography", "fa-solid", "fa-feather");
            bioToggle.dataset.action = "toggleBiography";
            bioToggle.dataset.tooltip = "5eStatblockSheet.Buttons.ToggleBiography";
            this.element.querySelector(".statblock-title").appendChild(bioToggle);
            // Set bio visibility
            this.element.classList.toggle("visible-bio", !!context.sheetPrefs.visibleBiography);

            // Add double-column toggle
            const doubleColumnToggle = document.createElement("i");
            doubleColumnToggle.classList.add("statblock-control", "toggle-doublecolumn", "fa-solid", "fa-table-columns");
            doubleColumnToggle.dataset.action = "toggleDoubleColumn";
            doubleColumnToggle.dataset.tooltip = "5eStatblockSheet.Buttons.ToggleDoubleColumn";
            this.element.querySelector(".statblock-title").appendChild(doubleColumnToggle);
            // Set double column
            this.element.querySelector(".window-content").classList.toggle("double-column", !!context.sheetPrefs.doubleColumn);

            // Zoom buttons
            const zoomContainer = document.createElement("span");
            zoomContainer.classList.add("zoom-container", "statblock-control");
            this.element.querySelector(".statblock-title").appendChild(zoomContainer);

            const zoomInButton = document.createElement("i");
            zoomInButton.classList.add("zoom-in", "fa-solid", "fa-magnifying-glass-plus");
            zoomInButton.dataset.action = "zoomIn";
            zoomInButton.dataset.tooltip = "5eStatblockSheet.Buttons.ZoomIn";
            zoomContainer.appendChild(zoomInButton);
            
            const zoomLabel = document.createElement("span");
            zoomLabel.classList.add("zoom-label");
            zoomLabel.dataset.action = "zoomReset";
            zoomLabel.dataset.tooltip = "5eStatblockSheet.Buttons.ZoomReset";
            zoomContainer.appendChild(zoomLabel);
            zoomLabel.innerText = Math.round((context.sheetPrefs.zoom || 1) * 100) + "%";

            const zoomOutButton = document.createElement("i");
            zoomOutButton.classList.add("zoom-out", "fa-solid", "fa-magnifying-glass-minus");
            zoomOutButton.dataset.action = "zoomOut";
            zoomOutButton.dataset.tooltip = "5eStatblockSheet.Buttons.ZoomOut";
            zoomContainer.appendChild(zoomOutButton);

            // Set zoom
            this.element.querySelector(".statblock-content").style.zoom = context.sheetPrefs.zoom || 1;

            for (const action of this.element.querySelectorAll(".statblock-action")) {
                const name = action.querySelector(".name");
                let item = this.actor.items.find(i => i.id === action.dataset.id);
                item ??= this.actor.items.find(i => i.name === name);
                if (item) {
                    // Wire action names
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
            }

            // 2024 additions
            if (this.rulesVersion === "2024") {
                // Wire initiative (2024 only)
                [...this.element.querySelectorAll(".statblock-header div dt")]
                    .find(dt => dt.innerText === game.i18n.localize("DND5E.Initiative"))
                    .parentNode.querySelector("dd")
                    .innerHTML = `<span class="rollable" aria-label="Initiative" data-action="roll" data-type="initiative">${context.summary.initiative}</span>`;
                
                // Wire Gear
                const formatter = game.i18n.getListFormatter({ type: "unit" });
                const gear = formatter.format(
                    this.actor.items.filter(item => item.system.quantity && item.system.properties?.has("gear")).map(i => {
                        let itemOnActor = this.actor.items.get(i.id);
                        if (!itemOnActor) {
                            itemOnActor = this.actor.items.find(actorItem => foundry.utils.parseUuid(actorItem._stats.compendiumSource)?.uuid === foundry.utils.parseUuid(i.uuid)?.uuid);
                        }
                        if (!itemOnActor) return "";
                        let enrichedGear = `<span class="roll-link" data-action="use" data-item-id="${itemOnActor.id ?? i.id}">${itemOnActor.name ?? i.name}</span>`;
                        if (i.system.quantity > 1) enrichedGear += ` (${dnd5e.utils.formatNumber(i.system.quantity)})`;
                        return enrichedGear;
                    })
                );
                const gearDd = [...this.element.querySelectorAll(".statblock-header div dt")]
                    .find(dt => [game.i18n.localize("DND5E.Gear"), game.i18n.localize("DND5E.Gear.Label")].includes(dt.innerText))
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

            // HP editing
            const hpDd = [...this.element.querySelectorAll(".statblock-header div dt")]
                .find(dt => [game.i18n.localize("DND5E.HP"), game.i18n.localize("DND5E.HitPoints")].includes(dt.innerText))
                ?.parentNode.querySelector("dd");
            if (hpDd) {
                const hpInput = this.element.querySelector(`input[name="system.attributes.hp.value"]`);
                const statblockHpInput = hpInput.cloneNode(false);
                hpInput.setAttribute("name", "");
                statblockHpInput.removeAttribute("hidden");
                statblockHpInput.addEventListener("change", this._onChangeInputDelta.bind(this));
                statblockHpInput.addEventListener("focus", () => statblockHpInput.select());
                statblockHpInput.addEventListener("blur", () => {
                    statblockHpText.classList.remove("hidden");
                    statblockHpInput.classList.add("hidden");
                });
                statblockHpInput.classList.add("statblock-hp-input", "hidden");
                const statblockHpText = document.createElement("span");
                statblockHpText.classList.add("statblock-hp-text")
                statblockHpText.innerText = this.actor.system.attributes.hp.value;
                statblockHpText.addEventListener("click", () => {
                    statblockHpText.classList.add("hidden");
                    statblockHpInput.classList.remove("hidden");
                    statblockHpInput.focus();
                });
                hpDd.innerHTML = " / " + hpDd.innerHTML;
                hpDd.prepend(statblockHpText);
                hpDd.prepend(statblockHpInput);
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
            // Optimize height the first time
            if (!this.baseActor.flags["5e-statblock-sheet"]?.sheetPrefs?.height && !this.baseActor.flags["5e-statblock-sheet"]?.sheetPrefs?.visibleBiography) {
                const headerHeight = this.element.querySelector("header").offsetHeight;
                const statblockHeight = this.element.querySelector(".statblock.npc").offsetHeight;
                const newHeight = headerHeight + statblockHeight + 30;
                this.element.style.height = newHeight + "px";
                position.height = newHeight;
            }
            this._saveStatblockSheetPosition ??= foundry.utils.debounce(this.#saveStatblockSheetSize, 250);
            this._saveStatblockSheetPosition(position);
        } else {
            return super._onPosition(position);
        }
    }

    /**
     * Save the sheet's current size to preferences.
     * @param {ApplicationPosition} position
     */
    #saveStatblockSheetSize(position) {
        const { width, height } = position;
        const prefs = {};
        if ( width !== "auto" ) prefs.width = width;
        if ( height !== "auto" ) prefs.height = height;
        if ( foundry.utils.isEmpty(prefs) ) return;
        this.baseActor.setFlag("5e-statblock-sheet", "sheetPrefs", prefs);
    }

    static _onUseItem(event, target) {
        const { itemId } = target.closest("[data-item-id]")?.dataset ?? {};
        const item = this.actor.items.get(itemId);
        if ( !item || (target.ariaDisabled === "true") ) return;
        return item.use({ event });
    }

    static async _toggleDoubleColumn(event, target) {
        const isDoubleColumn = this.element.querySelector(".window-content").classList.contains("double-column");
        this.element.querySelector(".window-content").classList.toggle("double-column", !isDoubleColumn);
        this.baseActor.setFlag("5e-statblock-sheet", "sheetPrefs.doubleColumn", !isDoubleColumn);
    }

    static _toggleBiography(event, target) {
        const isVisibleBio = this.element.classList.contains("visible-bio");
        this.element.classList.toggle("visible-bio", !isVisibleBio);
        this.baseActor.setFlag("5e-statblock-sheet", "sheetPrefs.visibleBiography", !isVisibleBio);
        this.baseActor.unsetFlag("5e-statblock-sheet", "sheetPrefs.visibleBiography");
    }

    static _zoomIn(event, target) {
        const statblockContentEl = this.element.querySelector(".statblock-content");
        const newZoom = Math.round((parseFloat(statblockContentEl.style.zoom || 1) + 0.15) * 100) / 100;
        statblockContentEl.style.zoom = newZoom;
        this.element.querySelector(".zoom-label").innerText = Math.round(newZoom * 100) + "%";
        this.baseActor.setFlag("5e-statblock-sheet", "sheetPrefs.zoom", newZoom);
    }
    
    static _zoomOut(event, target) {
        const statblockContentEl = this.element.querySelector(".statblock-content");
        const newZoom = Math.round((parseFloat(statblockContentEl.style.zoom || 1) - 0.15) * 100) / 100;
        statblockContentEl.style.zoom = newZoom;
        this.element.querySelector(".zoom-label").innerText = Math.round(newZoom * 100) + "%";
        this.baseActor.setFlag("5e-statblock-sheet", "sheetPrefs.zoom", newZoom);
    }

    static _zoomReset(event, target) {
        const newZoom100 = game.settings.get("5e-statblock-sheet", "defaultZoom");
        this.element.querySelector(".statblock-content").style.removeProperty("zoom");
        this.element.querySelector(".zoom-label").innerText = newZoom100 + "%";
        this.baseActor.unsetFlag("5e-statblock-sheet", "sheetPrefs.zoom");
    }
}

export class StatblockSheet2014 extends StatblockSheet {
    rulesVersion = "2014";
}

export class StatblockSheet2024 extends StatblockSheet {
    rulesVersion = "2024";
}
