const OrderService = require("../services/orderService");

class OrderController {
    static async createPlanRenewalOrder(req, res, next) {
        try {
            const result = await OrderService.createPlanRenewalOrder(req);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }

    static async createPlanPurchaseOrder(req, res, next) {
        try {
            const result = await OrderService.createPlanPurchaseOrder(req);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }

    static async createGroupCreationOrder(req, res, next) {
        try {
            const result = await OrderService.createGroupCreationOrder(req);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
}

module.exports = OrderController;
