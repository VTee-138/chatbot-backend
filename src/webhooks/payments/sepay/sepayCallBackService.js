const { DurationUnit } = require("@prisma/client");
const prisma = require("../../../config/database")
const Constants = require("../../../utils/constant");
/**
 * Service xử lý callback Sepay.
 *  * - Thực hiện các bước tiếp theo trong transaction:
 *   + Insert payment 
 *   + update order -> status = paid
 *   + nếu order.type === 'group_creation' -> tạo group + groupMember + subscription
 *   + nếu order.type === 'plan_purchase' || 'plan_renewal' -> tạo subscription phù hợp (xem expireAt hiện tại)
 *
 */

const handleSepayCallback = async (payload) => {
    const { orderCode, amount, transactionId, createdAt, status } = payload;

    // 1. Lấy order theo orderCode
    const order = await prisma.order.findUnique({
        where: { orderCode },
    });

    if (!order) {
        throw new Constants.ErrorResponse("Không tìm thấy order với orderCode này", 400);
    }

    // 2. Kiểm tra amount khớp
    const orderAmount =
        typeof order.amount === "object" && typeof order.amount.toNumber === "function"
            ? order.amount.toNumber()
            : Number(order.amount);

    const incomingAmount = Number(amount);

    if (Number.isNaN(incomingAmount) || incomingAmount !== Number(orderAmount)) {
        throw new Constants.ErrorResponse("Số tiền không khớp với order", 400);
    }


    // 4. Phần còn lại nằm trong transaction
    const orderData = order.data || {};
    const orderType = order.type;
    const planData = await prisma.plan.findUnique({
        where: {
            planId: orderData.planId,
        },
        select: {
            durationValue: true,
            durationUnit: true
        }
    })

    try {
        const txResult = await prisma.$transaction(async (tx) => {
            const payment = await tx.payment.create({
                data: {
                    orderId: order.id,
                    userId: order.userId,
                    amount: incomingAmount,
                    paymentProvider: "sepay",
                    status: status,
                    transactionId: transactionId,
                    createdAt: createdAt ? new Date(createdAt) : new Date(),
                },
            });
            // a) Cập nhật order.status = paid
            const updatedOrder = await tx.order.update({
                where: { id: order.id },
                data: {
                    status: "paid",
                    updatedAt: new Date(),
                },
            });

            // b) Nếu group_creation -> tạo group, groupMember, subscription
            if (orderType === "group_creation") {
                let groupName = orderData.name;
                const planId = orderData.planId;
                const durationValue = planData.durationValue;
                const durationUnit = planData.durationUnit;
                const existing = await tx.group
                    .findUnique({
                        where: {
                            name_ownerId: {
                                name: groupName,
                                ownerId: order.userId,
                            },
                        },
                    })

                if (existing) {
                    groupName = `${groupName}-${Date.now()}`;
                }

                const newGroup = await tx.group.create({
                    data: {
                        name: groupName,
                        ownerId: order.userId,
                        createdAt: new Date(),
                        isActive: true,
                    },
                });

                await tx.groupMember.create({
                    data: {
                        userId: order.userId,
                        groupId: newGroup.id,
                        role: "owner",
                        status: "accepted",
                        assignmentWeight: 0,
                        createdAt: new Date(),
                    },
                });

                const now = new Date();
                const expireAt = addDuration(now, durationValue, durationUnit);

                const newSubscription = await tx.subscription.create({
                    data: {
                        groupId: newGroup.id,
                        planId,
                        createdAt: now,
                        startedAt: now,
                        expireAt,
                    },
                });

                return {
                    updatedOrder,
                    payment,
                    group: newGroup,
                    subscription: newSubscription,
                };
            }

            // c) Nếu plan_purchase hoặc plan_renewal -> xử lý subscription cho group
            if (orderType === "plan_purchase" || orderType === "plan_renewal") {
                const groupId = orderData.groupId;
                const planId = orderData.planId;
                const durationValue = planData.durationValue;
                const durationUnit = planData.durationUnit;

                if (!groupId) {
                    throw new Constants.ErrorResponse("Thiếu groupId trong order.data", 400);
                }

                const latestSub = await tx.subscription.findFirst({
                    where: { groupId },
                    orderBy: { expireAt: "desc" },
                });

                const now = new Date();
                let startedAt = now;
                if (latestSub && latestSub.expireAt && new Date(latestSub.expireAt) > now) {
                    startedAt = new Date(latestSub.expireAt);
                }

                const expireAt = addDuration(startedAt, durationValue, durationUnit);

                const newSubscription = await tx.subscription.create({
                    data: {
                        groupId,
                        planId,
                        createdAt: new Date(),
                        startedAt,
                        expireAt,
                    },
                });

                return {
                    updatedOrder,
                    payment,
                    subscription: newSubscription,
                };
            }

            // d) Loại khác -> chỉ mark order paid
            return { updatedOrder, payment };
        });

        return txResult;
    } catch (err) {
        prisma.payment.create({
            data: {
                orderId: order.id,
                userId: order.userId,
                amount: incomingAmount,
                paymentProvider: "sepay",
                status: 'failed',
                transactionId: transactionId,
                createdAt: createdAt ? new Date(createdAt) : new Date(),
            },
        }).catch((e) => {
            console.log("ve sau lai log o day ra file or ...", e);
        });        // payment vẫn giữ nguyên nếu transaction fail
        throw err;
    }
};
// Helper: thêm duration vào 1 ngày
const addDuration = (date, value, unit) => {
    const d = new Date(date);
    const v = Number(value) || 0;
    switch ((unit || "").toLowerCase()) {
        case "day":
        case "days":
        case "d":
            d.setUTCDate(d.getUTCDate() + v);
            break;
        case "month":
        case "months":
        case "m":
            d.setUTCMonth(d.getUTCMonth() + v);
            break;
        case "year":
        case "years":
        case "y":
            d.setUTCFullYear(d.getUTCFullYear() + v);
            break;
        case "hour":
        case "hours":
        case "h":
            d.setUTCHours(d.getUTCHours() + v);
            break;
        default:
            // mặc định: thêm ngày
            d.setUTCDate(d.getUTCDate() + v);
    }
    return d;
};

module.exports = {
    handleSepayCallback,
};
