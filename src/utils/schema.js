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
    .pattern(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*?&._\s]{8,}$/)
    .required().invalid(Joi.ref('oldPassword'))
    .messages({
        "string.pattern.base" : "Password phải có ít nhất 8 kí tự, gồm cả chữ và số",
        "any.invalid": "Mật khẩu không được trùng với mật khẩu cũ"
    }),
    newConfirmPassword: Joi.string()
    .valid(Joi.ref('newPassword'))
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
    .valid(Joi.ref('newPassword'))
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
    password: Joi.string()
    .pattern(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*?&._\s]{8,}$/)
    .required()
    .messages({
        "string.pattern.base" : "Password phải có ít nhất 8 kí tự, gồm cả chữ và số"
    }),
    userName: Joi.string()
    .pattern(/^[A-Za-z0-9_-]{5,200}$/)
    .required()
    .messages({
      "string.pattern.base": "Username không được chứa khoảng cách và ký tự đặc biệt",
      "any.required": "Vui lòng nhập username"
    }),
    confirmPassword: Joi.string()
    .valid(Joi.ref('password'))
    .required()
    .messages({
      "any.only": "Mật khẩu xác nhận không khớp",
      "any.required": "Vui lòng nhập mật khẩu xác nhận"
    }),
    captchaToken: Joi.string()
    .trim() // Xóa khoảng trắng
    .min(500)
    .required()
    .pattern(/^[A-Za-z0-9_\-.]+$/) // Chỉ có những token hợp lệ
    .messages({
      "any.required":"Thiếu",
      "string.max": "Token quá dài, có thể bị lỗi.",
      "string.pattern.base": "Token chứa ký tự không hợp lệ.",
    })
})

const RegisterSSOSchema = Joi.object({
    userName: Joi.string()
    .pattern(/^[A-Za-z0-9_-]{5,200}$/)
    .required()
    .messages({
      "string.pattern.base": "Username không được chứa khoảng cách và ký tự đặc biệt",
      "any.required": "Vui lòng nhập username"
    }),
    phoneNumber: Joi.string()
    .pattern(/^\d{10}$/) // đúng 10 số
    .required()
    .messages({
      "string.pattern.base": "Số điện thoại phải gồm đúng 10 chữ số",
    })
}) 
const EmailWithCaptchaSchema = Joi.object({
  email: Joi.string()
  .email()
  .required()
  .messages({
    "string.email": "Email không hợp lệ, Email là thông tin bắt buộc",
    "any.required": "Vui lòng nhập email"
  }),
  captchaToken: Joi.string()
  .trim() // Xóa khoảng trắng
  .min(500)
  .required()
  .pattern(/^[A-Za-z0-9_\-.]+$/) // Chỉ có những token hợp lệ
  .messages({
    "any.required":"Thiếu",
    "string.max": "Token quá dài, có thể bị lỗi.",
    "string.pattern.base": "Token chứa ký tự không hợp lệ.",
  })
})
const LoginSchema = Joi.object({
  userName: Joi.string()
   .required()
   .messages({
    "any.required": "Vui lòng nhập UserName"
  }),
  password: Joi.string()
  .required()
  .messages({
    "any.required": "Vui lòng nhập mật khẩu!"
  }) 
  
})
const twoFactorSchema = Joi.object({
  jwt: Joi.string(), 
  token: Joi.string()
  .required()
  .messages({
    "any.required": "Thiếu token"
  })
})
module.exports = { twoFactorSchema,RegisterSSOSchema, LoginSchema,RegisterNewUserSchema, ResetForgotPasswordSchema, ResetPasswordSchema, EmailWithCaptchaSchema}