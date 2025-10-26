const PlanService = require("../services/planService");
const { ErrorResponse } = require("../utils/constant");
class PlanController {
    async getAllPlans(req, res, next) {
        try {
            const plans = await PlanService.getAllPlans();
            res.status(200).json({
                success: true,
                data: plans,
            });
        } catch (error) {
            next(error);
        }
    }
};
module.exports = new PlanController();
