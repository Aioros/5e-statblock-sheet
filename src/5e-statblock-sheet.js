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
