const { successResponse, catchAsync } = require("../utils/response");
const prisma = require("../config/database");

/**
 * Lấy danh sách các lời mời đang chờ xử lý của người dùng hiện tại
 */
const listPendingInvitations = catchAsync(async (req, res) => {
  // Middleware xác thực đã đặt thông tin user (bao gồm email) vào req.user
  const userEmail = req.user.email;

  const invitations = await prisma.invitations.findMany({
    where: {
      email: userEmail,
      status: "PENDING", // Chỉ lấy các lời mời đang chờ
    },
    include: {
      // Lấy thêm thông tin của group (tổ chức) được mời vào
      groups: {
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
        },
      },
      // Lấy thêm thông tin của người đã gửi lời mời
      users: {
        // 'users' là tên quan hệ bạn đặt trong schema
        select: {
          id: true,
          fullName: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return successResponse(
    res,
    invitations,
    "Pending invitations retrieved successfully."
  );
});

module.exports = {
  listPendingInvitations,
};
