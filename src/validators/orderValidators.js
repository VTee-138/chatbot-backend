const Joi = require("joi");

// Common fields
const name = Joi.string().min(1).required().messages({
    "string.empty": "Thiếu name",
    "any.required": "Thiếu name"
});

const planId = Joi.string().uuid().required().messages({
    "string.guid": "planId không hợp lệ",
    "any.required": "Thiếu planId"
});

const groupId = Joi.string().uuid().required().messages({
    "string.guid": "groupId không hợp lệ",
    "any.required": "Thiếu groupId"
});

class OrderValidators {
    static PlanRenewalSchema = Joi.object({
        name,
        planId,
        groupId
    });

    static PlanPurchaseSchema = Joi.object({
        name,
        planId,
        groupId
    });

    static GroupCreationSchema = Joi.object({
        name,
        planId
    });
}

module.exports = OrderValidators;
