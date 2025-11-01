const customersService = require("../services/customersService.js");

class customersController {
    async createCustomer(req, res, next) {
        try {
            const { fullName, phoneNumber, email, gender, groupId } = req.body;
            const newCustomer = await customersService.createNewCustomer(fullName, phoneNumber, email, gender, groupId);
            return res.status(201).json({ message: 'created newCustomer', newCustomer });
        }
        catch (err) {
            next(err);
        }
    }

    async getAllCustomers(req, res, next) {
        try {
            const { groupId, page } = req.query;
            const data = await customersService.getAllCustomers(groupId, page);
            return res.status(201).json({ message: "get all customers", data });
        }
        catch (err) {
            next(err);
        }
    }
    async getCustomerById(req, res, next) {
        try {
            const customer = await customersService.getCustomerById(req.params);
            return res.status(201).json({ message: "get customer", customer })
        }
        catch (err) {
            next(err);
        }
    }

    async updateCustomer(req, res, next) {
        try {
            const data = req.body;
            const id = req.params;
            const updatedUser = await customersService.updateCustomer(id, data);
            return res.status(201).json({ message: 'update successfull', updatedUser });
        }
        catch (err) {
            next(err);
        }
    }

    async deleteCustomer(req, res, next) {
        try {
            const id = req.params;
            await customersService.deleteCustomer(id);
            return res.status(200).json({ message: "deleted customer" });
        }
        catch (err) {
            next(err);
        }
    }

}

module.exports = new customersController();