/**
 * Lớp Error tùy chỉnh để tạo ra các lỗi có chủ đích (operational errors).
 * Nó kế thừa lớp Error có sẵn của JavaScript và thêm vào các thuộc tính hữu ích.
 */
class AppError extends Error {
  /**
   * @param {string} message - Nội dung của thông báo lỗi.
   * @param {number} statusCode - Mã trạng thái HTTP (ví dụ: 400, 404, 500).
   */
  constructor(message, statusCode) {
    // Gọi constructor của lớp cha (Error) với message
    super(message);

    // Gán mã trạng thái và status tương ứng
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";

    // Đánh dấu đây là lỗi có chủ đích, không phải lỗi lập trình
    this.isOperational = true;

    // Ghi lại stack trace để debug
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
