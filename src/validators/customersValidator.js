const Joi = require("joi");

const vnPhoneRegex = /^(0|\+84)[0-9]{9}$/;
class customersValidator {
  static createCustomerSchema = Joi.object({
  fullName: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .required()
    .messages({
      "string.base": "Name must be a string",
      "string.empty": "Name is required",
      "string.min": "Name must be at least 2 characters long",
      "string.max": "Name must be at most 100 characters long",
      "any.required": "Name is required",
    }),

  groupId: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .required()
    .messages({
      "string.empty": "groupId is required",
      "any.required": "groupId is required",
    }),

  phoneNumber: Joi.string()
    .pattern(vnPhoneRegex)
    .required()
    .messages({
      "string.pattern.base":
        "Phone number must be a valid Vietnamese number (start with 0 or +84, followed by 9 digits)",
      "any.required": "Phone number is required",
    }),

  email: Joi.string()
    .trim()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      "string.email": "Invalid email format",
      "any.required": "Email is required",
    }),

  gender: Joi.string()
    .valid("male", "female", "other", "prefer_not_to_say")
    .required()
    .messages({
      "any.only":
        "Gender must be one of: male, female, other, prefer_not_to_say",
      "any.required": "Gender is required",
    }),
});

static getCustomerByIdOrUpdateSchema = Joi.object({
  id: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .required()
    .messages({
      "string.base": "id must be a string",
      "string.empty": "id is required",
      "string.min": "id must be at least 2 characters long",
      "string.max": "id must be at most 100 characters long",
      "any.required": "id is required",
    })
});
}
module.exports = customersValidator;