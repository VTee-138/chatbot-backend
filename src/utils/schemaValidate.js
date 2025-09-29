const { ErrorResponse, Constants } = require("./constant");

const isError = (error, next) => {
    if (error) {
        console.log('hi')
        if (error.message.contains("Cannot destructure property")) return next(new ErrorResponse("Check your property!", Constants.BAD_REQUEST))
        return next(error);
    }
    return next()
}
/**
 * Middleware dùng các schema để validate dữ liệu request băng Schema (Joi)
 * 
 * @param schema Là những validate schema dùng đễ validate dữ liệu được request đến
 * @param type Là loại dữ liệu cần validate
 *   - 'params': validate dữ liệu trong req.params
 *   - các giá trị khác: mặc định validate dữ liệu trong req.body
 * 
 * @returns {Function} Middleware function (req, res, next)
 * 
 * @example
 * // Validate params
 * router.get('/register', schemaValidate(registerNewUserSchema, 'params'), register )
 * // Validate body
 * router.get('/register', schemaValidate(registerNewUserSchema, 'body'), register )
*/
const schemaValidate = (schema, type) => {
    return (req, res, next) => {
      let validationResult;
      if (type === 'params') {
        validationResult = schema.validate(req.params, { abortEarly: false });
      } else if (type === 'query') {
        validationResult = schema.validate(req.query, { abortEarly: false });
      } else {
        validationResult = schema.validate(req.body, { abortEarly: false });
      }

      const { error, value } = validationResult;
    //   if (!value) return next(new ErrorResponse('Lack of set-up property', Constants.BAD_REQUEST))
      if (error) {
        const errors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
        }));
        return next(new ErrorResponse(
                `Lack of property: Some required fields are missing in your request [${errors.map(e => e.field).join(', ')}]`,
                Constants.BAD_REQUEST,
                errors
            ));
      }

      // Assign validated value back to the request object
      if (type === 'params') {
        req.params = value;
      } else if (type === 'query') {
        req.query = value;
      } else {
        req.body = value;
      }
      next();
    };
}

module.exports = schemaValidate