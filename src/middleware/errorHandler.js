const { Constants, ErrorResponse } = require("../utils/constant.js");

const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    if (err instanceof ErrorResponse) {
        return res.status(err.status).json({
            status: err.status,
            message: err.message
        });
    }

    // Joi validation errors
    if (err.isJoi) {
        return res.status(Constants.BAD_REQUEST).json({
            message: err.details[0].message
        });
    }

    // Prisma errors
    if (err.code === 'P2002') {
        return res.status(Constants.BAD_REQUEST).json({
            message: 'Dữ liệu đã tồn tại'
        });
    }

    if (err.code === 'P2025') {
        return res.status(Constants.NOT_FOUND).json({
            message: 'Không tìm thấy dữ liệu'
        });
    }

    if (err.code === 'P2003') {
        return res.status(Constants.BAD_REQUEST).json({
            message: 'Lỗi tham chiếu dữ liệu'
        });
    }
    return res.status(Constants.INTERNAL_SERVER_ERROR).json({
        message: 'Lỗi server'
    });
};

module.exports = errorHandler; 
