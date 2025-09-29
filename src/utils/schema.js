const Joi = require('joi')

/**
 * @summary: Validate password changes
 * 
 * @description: Validate thông tin request gửi đến cho việc thay đổi mật khẩu, khi **NOT AVAILABLE** trong session
 * @type Joi Object
 */
const ResetForgotPasswordSchema = Joi.object({
    // Support both 'token' and 'jwt' for compatibility
    token: Joi.string().optional(),
    jwt: Joi.string().optional(),
    newPassword: Joi.string()
    .pattern(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*?&._\s]{8,}$/)
    .required()
    .messages({
        "string.pattern.base" : "Password phải có ít nhất 8 kí tự, gồm cả chữ và số",
        "any.required": "Vui lòng nhập mật khẩu mới"
    }),
    // Support both naming conventions
    confirmPassword: Joi.string().optional(),
    newConfirmPassword: Joi.string().optional()
}).custom((value, helpers) => {
    // Validate that either 'token' or 'jwt' is provided
    if (!value.token && !value.jwt) {
        return helpers.error('any.custom', { message: 'Token is required' });
    }
    
    // If confirmPassword is provided, validate it matches newPassword
    const confirmField = value.confirmPassword || value.newConfirmPassword;
    if (confirmField && confirmField !== value.newPassword) {
        return helpers.error('any.custom', { message: 'Passwords do not match' });
    }
    
    return value;
}).messages({
    'any.custom': '{{#message}}'
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
 * @summary: Validate user registering information (Legacy - with cookie)
 * 
 * @description: Validate thông tin request gửi đến với mục đích đăng ký tài khoản mới (sử dụng email từ cookie)
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
    phoneNumber: Joi.string()
    .pattern(/^\d{10}$/) // đúng 10 số
    .messages({
      "string.pattern.base": "Số điện thoại phải gồm đúng 10 chữ số",
    }),
    confirmPassword: Joi.string()
    .valid(Joi.ref('password'))
    .required()
    .messages({
      "any.only": "Mật khẩu xác nhận không khớp",
      "any.required": "Vui lòng nhập mật khẩu xác nhận"
    }),
})

/**
 * @summary: Validate user registering information with email and CAPTCHA
 * 
 * @description: Validate thông tin request gửi đến với mục đích đăng ký tài khoản mới (bao gồm email và captchaToken)
 * @type Joi Object
 */
const RegisterWithEmailSchema = Joi.object({
    email: Joi.string()
    .email()
    .required()
    .messages({
      "string.email": "Email không hợp lệ",
      "any.required": "Email là thông tin bắt buộc"
    }),
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
    phoneNumber: Joi.string()
    .pattern(/^\d{10}$/) // đúng 10 số
    .allow('', null)
    .messages({
      "string.pattern.base": "Số điện thoại phải gồm đúng 10 chữ số",
    }),
    confirmPassword: Joi.string()
    .valid(Joi.ref('password'))
    .required()
    .messages({
      "any.only": "Mật khẩu xác nhận không khớp",
      "any.required": "Vui lòng nhập mật khẩu xác nhận"
    }),
    captchaToken: Joi.string()
    .required()
    .messages({
      "any.required": "CAPTCHA token là bắt buộc"
    })
})

const RegisterSSOSchema = Joi.object({
    userName: Joi.string()
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
const EmailSchema = Joi.object({
  email: Joi.string()
  .email()
  .required()
  .messages({
    "string.email": "Email không hợp lệ, Email là thông tin bắt buộc"
  })
})

const EmailWithCaptchaSchema = Joi.object({
  email: Joi.string()
  .email()
  .required()
  .messages({
    "string.email": "Email không hợp lệ, Email là thông tin bắt buộc"
  }),
  captchaToken: Joi.string()
  .required()
  .messages({
    "any.required": "CAPTCHA token là bắt buộc"
  })
})
const LoginSchema = Joi.object({
  email: Joi.string()
  .email()
  .required()
  .messages({
    "string.email": "Email không hợp lệ",
    "any.required": "Vui lòng nhập email"
  }),
  password: Joi.string()
  .required()
  .messages({
    "any.required": "Vui lòng nhập mật khẩu!"
  }) 
  
})

const LoginWithCaptchaSchema = Joi.object({
  email: Joi.string()
  .email()
  .required()
  .messages({
    "string.email": "Email không hợp lệ",
    "any.required": "Vui lòng nhập email"
  }),
  password: Joi.string()
  .required()
  .messages({
    "any.required": "Vui lòng nhập mật khẩu!"
  }),
  captchaToken: Joi.string()
  .required()
  .messages({
    "any.required": "CAPTCHA token là bắt buộc"
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

/**
 * SSO Login Schema - không cần CAPTCHA
 * Support both accessToken and idToken for Google
 */
const SSOLoginSchema = Joi.object({
  accessToken: Joi.string().optional(),
  idToken: Joi.string().optional()
}).custom((value, helpers) => {
  // At least one token must be provided
  if (!value.accessToken && !value.idToken) {
    return helpers.error('any.custom', { message: 'Either accessToken or idToken is required' });
  }
  return value;
}).messages({
  'any.custom': '{{#message}}'
})

module.exports = { 
  twoFactorSchema,
  RegisterSSOSchema, 
  LoginSchema, 
  LoginWithCaptchaSchema, 
  RegisterNewUserSchema, 
  RegisterWithEmailSchema, 
  ResetForgotPasswordSchema, 
  ResetPasswordSchema, 
  EmailSchema, 
  EmailWithCaptchaSchema,
  SSOLoginSchema
}