import { StatblockSheet2014, StatblockSheet2024 } from "./StatblockSheet.js";

Hooks.once("init", () => {
    const documentSheetConfig = foundry.applications.apps.DocumentSheetConfig;

    documentSheetConfig.registerSheet(
        Actor,
        game.system.id,
        StatblockSheet2014,
        {
            types: ["npc"],
            label: "5eStatblockSheet.SheetNames.2014",
        }
    );

    documentSheetConfig.registerSheet(
        Actor,
        game.system.id,
        StatblockSheet2024,
        {
            types: ["npc"],
            label: "5eStatblockSheet.SheetNames.2024",
        }
    );

    game.settings.register("5e-statblock-sheet", "minFontSize", {
        name: "5eStatblockSheet.Settings.MinFontSize.Name",
        scope: "client",
        config: true,
        type: Number,
        range: {
            min: 7,
            step: 1,
            max: 24
        },
        default: 11,
        onChange: (minFontSize) => {
            document.querySelector(":root").style.setProperty("--statblock-sheet-min-zoom", minFontSize / 13);
        }
    });

    game.settings.register("5e-statblock-sheet", "maxFontSize", {
        name: "5eStatblockSheet.Settings.MaxFontSize.Name",
        scope: "client",
        config: true,
        type: Number,
        range: {
            min: 7,
            step: 1,
            max: 22
        },
        default: 16,
        onChange: (maxFontSize) => {
            document.querySelector(":root").style.setProperty("--statblock-sheet-max-zoom", maxFontSize / 13);
        }
    });

});

Hooks.on("ready", () => {
    document.querySelector(":root").style.setProperty("--statblock-sheet-min-zoom", game.settings.get("5e-statblock-sheet", "minFontSize") / 13);
    document.querySelector(":root").style.setProperty("--statblock-sheet-max-zoom", game.settings.get("5e-statblock-sheet", "maxFontSize") / 13);
});