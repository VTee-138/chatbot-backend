const prisma = require("../config/database");
const Constants = require("../utils/constant");
const { ErrorResponse } = Constants;
class PlanService {
    async getAllPlans() {
        return await prisma.plan.findMany({
            orderBy: {
                createdAt: "desc",
            },
            select: {
                id: true,
                name: true,
                price: true,
                limits: true,
                type: true,
                durationUnit: true,
                durationValue: true,
                createdAt: true,
            },
        });
    }
};

module.exports = new PlanService();
