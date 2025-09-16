// utils/asyncHandler.js

/**
 * Một hàm "wrapper" để bắt các lỗi trong các hàm controller bất đồng bộ (async).
 * Nó nhận vào một hàm controller, thực thi nó, và bắt (catch) bất kỳ lỗi nào
 * xảy ra rồi chuyển cho middleware xử lý lỗi chung của Express thông qua `next()`.
 * @param {Function} fn - Hàm controller bất đồng bộ (async)
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

module.exports = {
  catchAsync,
};
