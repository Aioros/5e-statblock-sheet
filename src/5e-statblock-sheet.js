import { StatblockSheet2014, StatblockSheet2024 } from "./StatblockSheet.js";

Hooks.once("init", () => {
  const documentSheetConfig = foundry.applications.apps.DocumentSheetConfig;

  documentSheetConfig.registerSheet(
    Actor,
    game.system.id,
    StatblockSheet2014,
    {
      types: ["npc"],
      label: "5eStatblockSheet.5eStatblockSheet2014",
    }
  );

  documentSheetConfig.registerSheet(
    Actor,
    game.system.id,
    StatblockSheet2024,
    {
      types: ["npc"],
      label: "5eStatblockSheet.5eStatblockSheet2024",
    }
  );

});