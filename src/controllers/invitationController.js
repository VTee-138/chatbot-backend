const { successResponse, catchAsync } = require("../utils/response");
const prisma = require("../config/database");
const AppError = require("../utils/AppError");
const invitationService = require('../services/invitationService');

/**
 * @controller acceptInvitation
 * @description Người dùng chấp nhận một lời mời tham gia group.
 * Sử dụng Prisma transaction để đảm bảo cả hai thao tác (thêm thành viên và cập nhật lời mời)
 * cùng thành công hoặc cùng thất bại.
 */
const acceptInvitation = catchAsync(async (req, res, next) => {
  // Lấy token mời duy nhất từ URL (ví dụ: /invitations/accept/abc-123)
  const { token } = req.params;
  // Lấy id và email của người dùng đang đăng nhập (đã được middleware `authenticate` xác thực và thêm vào req.user)
  const { id: userId, email: userEmail } = req.user;

  // Bắt đầu một transaction. Tất cả các lệnh query trong này sẽ được thực thi cùng nhau.
  const result = await prisma.$transaction(async (tx) => {
    // 1. Tìm lời mời trong DB bằng token, và phải đảm bảo nó đang ở trạng thái "PENDING"
    const invitation = await tx.invitations.findUnique({
      where: { token: token, status: "PENDING" },
    });

    // Nếu không tìm thấy lời mời, ném ra lỗi 404
    if (!invitation) {
      throw new AppError(
        "Invitation not found or has already been processed.",
        404
      );
    }
    // Kiểm tra xem lời mời có hết hạn không
    if (new Date() > new Date(invitation.expiresAt)) {
      // Nếu hết hạn, cập nhật trạng thái và ném lỗi
      await tx.invitations.update({
        where: { id: invitation.id },
        data: { status: "EXPIRED" },
      });
      throw new AppError("This invitation has expired.", 410); // 410 Gone - tài nguyên đã từng tồn tại nhưng giờ không còn
    }
    // Bảo mật: Đảm bảo email của người đang chấp nhận phải khớp với email được mời
    if (invitation.email !== userEmail) {
      throw new AppError(
        "You are not authorized to accept this invitation.",
        403 // 403 Forbidden - không có quyền
      );
    }

    // 2. Nếu mọi thứ hợp lệ, tạo một bản ghi thành viên mới trong bảng group_members
    const newMember = await tx.group_members.create({
      data: {
        userId: userId,
        groupId: invitation.groupId,
        role: invitation.role, // Vai trò được gán theo những gì đã định sẵn trong lời mời
      },
    });

    // 3. Cập nhật trạng thái của lời mời từ "PENDING" thành "ACCEPTED"
    await tx.invitations.update({
      where: { id: invitation.id },
      data: { status: "ACCEPTED" },
    });

    // Trả về thông tin thành viên mới được tạo để transaction kết thúc
    return newMember;
  });

  // Gửi response thành công về cho client
  return successResponse(res, result, "Successfully joined the group.");
});

/**
 * @controller declineInvitation
 * @description Người dùng từ chối một lời mời tham gia group.
 */
const declineInvitation = catchAsync(async (req, res, next) => {
  // Lấy token mời duy nhất từ URL
  const { token } = req.params;

  // Tìm lời mời trong DB bằng token, và phải đảm bảo nó đang ở trạng thái "PENDING"
  const invitation = await prisma.invitations.findUnique({
    where: { token: token, status: "PENDING" },
  });

  // Nếu không tìm thấy, ném lỗi 404
  if (!invitation) {
    throw new AppError(
      "Invitation not found or has already been processed.",
      404
    );
  }
  // Kiểm tra xem lời mời có hết hạn không
  if (new Date() > new Date(invitation.expiresAt)) {
    // Nếu hết hạn, cập nhật trạng thái và ném lỗi
    await prisma.invitations.update({
      where: { id: invitation.id },
      data: { status: "EXPIRED" },
    });
    throw new AppError("This invitation has expired.", 410);
  }
  // Bảo mật: Đảm bảo email của người đang từ chối phải khớp với email được mời
  if (invitation.email !== req.user.email) {
    throw new AppError(
      "You are not authorized to decline this invitation.",
      403
    );
  }

  // Nếu mọi thứ hợp lệ, chỉ cần cập nhật trạng thái của lời mời thành "DECLINED"
  await prisma.invitations.update({
    where: { id: invitation.id },
    data: { status: "DECLINED" },
  });

  // Gửi response thành công về cho client (không cần data)
  return successResponse(res, null, "Invitation declined successfully.");
});

/**
 * Lấy danh sách các lời mời đang chờ xử lý của người dùng hiện tại
 */
const listPendingInvitations = catchAsync(async (req, res) => {
  const userEmail = req.user?.email;
  
  if (!userEmail) {
    throw new AppError('User email not found', 400);
  }

  const invitations = await prisma.invitations.findMany({
    where: {
      email: userEmail,
      status: "PENDING",
    },
    include: {
      groups: {
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
        },
      },
      users: {
        select: {
          id: true,
          userName: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Check for expired invitations and update them
  const now = new Date();
  const expiredInvitations = invitations.filter(inv => new Date(inv.expiresAt) < now);
  
  if (expiredInvitations.length > 0) {
    await prisma.invitations.updateMany({
      where: {
        id: { in: expiredInvitations.map(inv => inv.id) }
      },
      data: { status: 'EXPIRED' }
    });
    
    // Remove expired from result
    const validInvitations = invitations.filter(inv => new Date(inv.expiresAt) >= now);
    
    return successResponse(
      res,
      validInvitations,
      "Pending invitations retrieved successfully."
    );
  }

  return successResponse(
    res,
    invitations,
    "Pending invitations retrieved successfully."
  );
});

/**
 * Resend invitation email
 */
const resendInvitationEmail = catchAsync(async (req, res) => {
  const { invitationId } = req.params;
  const inviter = req.user;

  const invitation = await invitationService.resendInvitation(invitationId, inviter);

  return successResponse(res, {
    invitation: {
      id: invitation.id,
      email: invitation.email,
      expiresAt: invitation.expiresAt
    }
  }, 'Invitation email resent successfully');
});

module.exports = {
  listPendingInvitations,
  acceptInvitation,
  declineInvitation,
  resendInvitationEmail,
};