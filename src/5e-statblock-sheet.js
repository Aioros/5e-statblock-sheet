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

    game.settings.register("5e-statblock-sheet", "defaultLayout", {
        name: "5eStatblockSheet.Settings.DefaultLayout.Name",
        scope: "world",
        config: true,
        default: "auto",
        type: String,
        choices: {
            auto: "5eStatblockSheet.Settings.DefaultLayout.Auto",
            doubleColumn: "5eStatblockSheet.Settings.DefaultLayout.DoubleColumn"
        }
    });

    game.settings.register("5e-statblock-sheet", "defaultZoom", {
        name: "5eStatblockSheet.Settings.DefaultZoom.Name",
        scope: "world",
        config: true,
        default: 100,
        type: Number,
        range: {
            min: 40,
            step: 15,
            max: 160
        },
    });

    game.settings.register("5e-statblock-sheet", "defaultVisibleBiography", {
        name: "5eStatblockSheet.Settings.DefaultVisibleBiography.Name",
        scope: "world",
        config: true,
        default: false,
        type: Boolean
    });
});

Hooks.on("setup", () => {
    // Remove old flags
    if (game.user.flags.dnd5e?.sheetPrefs?.["npc-statblock"]) {
        game.user.unsetFlag("dnd5e", "sheetPrefs.npc-statblock");
    }
    if (game.user.flags.dnd5e?.sheetPrefs?.["npc-statblock:limited"]) {
		game.user.unsetFlag("dnd5e", "sheetPrefs.npc-statblock:limited");
    }
});
