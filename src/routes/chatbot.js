const express = require("express");
const {sendMessage, enableChat, sendMessageOnPlatform, disableChat, getAISetting, updateAISetting} = require("../controllers/chatbotController");
const { schemaValidate } = require("../middleware/validate");
const botRouter = express.Router();
const AIRequestSchemas = require("../validators/aiValidator");

botRouter.post("/sendMessage", sendMessage);


botRouter.post("/enable/:id", schemaValidate(AIRequestSchemas.settingChatSchema, "body"), enableChat)
botRouter.post("/disable/:id", schemaValidate(AIRequestSchemas.settingChatSchema, "body"), disableChat)
botRouter.post("/ai_setting", schemaValidate(AIRequestSchemas.aiSetting, "body"), updateAISetting)
botRouter.get("/ai_setting/:id", getAISetting)
botRouter.post("/sendMessage/:channel", schemaValidate(AIRequestSchemas.sendMessageSchema, "body"), sendMessageOnPlatform)
// botRouter.post("/suggest", schemaValidate(AIRequestSchemas.sendMessageSchema), enableChat)
// botRouter.post("/help")
module.exports = botRouter;