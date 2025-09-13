const Joi = require('joi')

/**
 * @summary: Validate password changes
 * 
 * @description: Validate thông tin request gửi đến cho việc thay đổi mật khẩu, khi **NOT AVAILABLE** trong session
 * @type Joi Object
 */
const ResetForgotPasswordSchema = Joi.object({
    jwt: Joi.string().required().messages({"any.required": "Vui lòng gửi kèm mã code có trong mail"}),
    newPassword: Joi.string()
    .pattern(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/)
    .required().invalid(Joi.ref('oldPassword'))
    .messages({
        "string.pattern.base" : "Password phải có ít nhất 8 kí tự, gồm cả chữ và số",
        "any.invalid": "Mật khẩu không được trùng với mật khẩu cũ"
    }),
    newConfirmPassword: Joi.string()
    .valid(Joi.ref('password'))
    .required().invalid(Joi.ref('oldPassword'))
    .messages({
      "any.only": "Mật khẩu xác nhận không khớp",
      "any.required": "Vui lòng nhập mật khẩu xác nhận",
    }),
})
/**
 * @summary: Validate password changes
 * 
 * @description: Validate thông tin request gửi đến cho việc thay đổi mật khẩu, khi **AVAILABLE*** trong session
 * @type Joi Object
 */
const ResetPasswordSchema = Joi.object({
    oldPassword: Joi.string()
    .min(1).required(),
    newPassword: Joi.string()
    .pattern(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/)
    .required().invalid(Joi.ref('oldPassword'))
    .messages({
        "string.pattern.base" : "Password phải có ít nhất 8 kí tự, gồm cả chữ và số",
        "any.invalid": "Mật khẩu không được trùng với mật khẩu cũ"
    }),
    newConfirmPassword: Joi.string()
    .valid(Joi.ref('password'))
    .required().invalid(Joi.ref('oldPassword'))
    .messages({
      "any.only": "Mật khẩu xác nhận không khớp",
      "any.required": "Vui lòng nhập mật khẩu xác nhận",
    }),
})
/**
 * @summary: Validate user registering information
 * 
 * @description: Validate thông tin request gửi đến với mục đích đăng ký tài khoản mới
 * @type Joi Object
 */
const RegisterNewUserSchema = Joi.object({
    email: Joi.string()
    .email()
    .required()
    .messages({
      "string.email": "Email không hợp lệ, Email là thông tin bắt buộc",
    }),
    password: Joi.string()
    .pattern(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/)
    .required()
    .messages({
        "string.pattern.base" : "Password phải có ít nhất 8 kí tự, gồm cả chữ và số"
    }),
    phoneNumber: Joi.string()
    .pattern(/^\d{10}$/) // đúng 10 số
    .messages({
      "string.pattern.base": "Số điện thoại phải gồm đúng 10 chữ số",
    })
    ,
    confirmPassword: Joi.string()
    .valid(Joi.ref('password'))
    .required()
    .messages({
      "any.only": "Mật khẩu xác nhận không khớp",
      "any.required": "Vui lòng nhập mật khẩu xác nhận"
    }),
})
const EmailSchema = Joi.object({
  email: Joi.string()
  .email()
  .required()
  .messages({
    "string.email": "Email không hợp lệ, Email là thông tin bắt buộc"
  })
})
const LoginSchema = Joi.object({
  email: Joi.string()
   .email()
   .required()
   .messages({
    "string.email": "Email không hợp lệ, Email là thông tin bắt buộc",
    "any.required": "Vui lòng nhập email"
  }),
  password: Joi.string()
  .required()
  .messages({
    "any.required": "Vui lòng nhập mật khẩu!"
  }) 
  
})
module.exports = { LoginSchema,RegisterNewUserSchema, ResetForgotPasswordSchema, ResetPasswordSchema, EmailSchema}