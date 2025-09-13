const isError = (error, next) => {
    if (error) {
        return next(error);
    }
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
        if (type === 'params') {
            //abortEarly false to collect all validation errors
            //instead of stopping at the first error
            const { error } = schema.validate(req.params, { abortEarly: false });
            isError(error, next);
        }
        else {
            const { error, value } = schema.validate(req.body);
            isError(error, next);
        }
        
        next();
    };
}

module.exports = schemaValidate