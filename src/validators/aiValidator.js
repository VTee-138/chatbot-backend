const Joi = require("joi") 

class AIRequestSchemas{
    static settingChatSchema = Joi.object({
    conversationId: Joi.string().required(),
    groupId: Joi.string().required(),
    history: Joi.array().items(Joi.string()).required()
    }).messages({
        'any.required': 'Thiếu thông tin {{#label}}',
        'string.empty': 'Thông tin {{#label}} không được để trống'
    })

    static sendMessageSchema = Joi.object({
        channel: Joi.string().valid('facebook','zalo','website').required(),
        message: Joi.string().required(),
        conversationId: Joi.string().required(),
        groupId: Joi.string().required(),
        history: Joi.string().required()
    }).messages({
        'any.required': 'Thiếu thông tin {{#label}}',
        'string.empty': 'Thông tin {{#label}} không được để trống',
        'any.only': '{{#label}} không hợp lệ (chỉ chấp nhận: {{#valids}})'
    })

    static aiSetting = Joi.object({
        groupId: Joi.string().required(),
        prompt: Joi.string().required(),
        model: Joi.string().required()
    }).messages({
        'any.required': 'Thiếu thông tin {{#label}}',
        'string.empty': 'Thông tin {{#label}} không được để trống'
    })
}
module.exports = AIRequestSchemas