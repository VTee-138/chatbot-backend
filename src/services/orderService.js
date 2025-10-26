const prisma = require("../config/database");
const Constants = require("../utils/constant");
const { createUniqueId } = require("../utils/idGeneratorUtils");
const { ErrorResponse } = Constants;
class OrderService {
    static bankId = "VCB"
    static accountNo = "0987654321"
    static async createPlanRenewalOrder(req) {
        const { name, planId, groupId } = req.body;
        const userId = req.user.id;

        const plan = await prisma.plan.findUnique({ where: { id: planId } });
        if (!plan) throw new ErrorResponse("Không tìm thấy plan", Constants.NOT_FOUND);
        const orderCode = createUniqueId();

        const order = await prisma.order.create({
            data: {
                data: {
                    name,
                    planId,
                    groupId,
                    userId,
                },
                userId,
                orderCode,
                type: "plan_renewal",
                status: "unpaid",
                amount: plan.price
            }
        });

        return {
            bankId: this.bankId,
            accountNo: this.accountNo,
            amount: order.amount,
            content: `Ord_${order.orderCode}`
        };
    }

    static async createPlanPurchaseOrder(req) {
        const { name, planId, groupId } = req.body;
        const userId = req.user.id;

        const plan = await prisma.plan.findUnique({ where: { id: planId } });
        if (!plan) throw new ErrorResponse("Không tìm thấy plan", Constants.NOT_FOUND);
        const orderCode = createUniqueId();
        const order = await prisma.order.create({
            data: {
                data: {
                    name,
                    planId,
                    groupId,
                    userId,
                },
                userId,
                orderCode,
                type: "plan_purchase",
                status: "unpaid",
                amount: plan.price
            }
        });

        return {
            bankId: this.bankId,
            accountNo: this.accountNo,
            amount: order.amount,
            content: `Ord_${order.orderCode}`
        };
    }

    static async createGroupCreationOrder(req) {
        const { name, planId } = req.body;
        const userId = req.user.id;

        const plan = await prisma.plan.findUnique({ where: { id: planId } });
        if (!plan) throw new ErrorResponse("Không tìm thấy plan", Constants.NOT_FOUND);
        const orderCode = createUniqueId();
        const order = await prisma.order.create({
            data: {
                data: {
                    name,
                    planId,
                    userId,
                },
                userId,
                orderCode,
                type: "group_creation",
                status: "unpaid",
                amount: plan.price
            }
        });

        return {
            bankId: this.bankId,
            accountNo: this.accountNo,
            amount: order.amount,
            content: `Ord_${order.orderCode}`
        };
    }
}

module.exports = OrderService;
