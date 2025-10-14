const validate = (schema, type) => {
    return (req, res, next) => {
        let error;
        let value;
        if (type === "params") {
            ({ error, value } = schema.validate(req.params, { abortEarly: false }));
            if (!error) {
                req.params = value;
            }
        } else if (type === "query") {
            ({ error, value } = schema.validate(req.query, { abortEarly: false }));
            if (!error) {
                req.query = value;
            }
        }
        else if (type === "body") {
            ({ error, value } = schema.validate(req.body, { abortEarly: false }));
            if (!error) {
                req.body = value;
            }
        }
        else {
            throw new Error("Invalid validation type");
        }
        if (error) {
            return next(error); // return ở đây để chặn controller
        }

        next(); // chỉ chạy khi không có lỗi
    };
};

module.exports = validate;
