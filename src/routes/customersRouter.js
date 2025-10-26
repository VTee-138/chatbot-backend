const express = require('express');
const customersController = require("../controllers/customersController.js");
const customersValidator = require('../validators/customersValidator.js');
const { schemaValidate } = require('../middleware/validate')

const router = express.Router();

router.post(
    '/',
    schemaValidate(customersValidator.createCustomerSchema, "body"),
    customersController.createCustomer
);

//hàm này chưa phân trang @@
router.get(
    '/',
    customersController.getAllCustomers
)

router.get(
    '/:id',
    schemaValidate(customersValidator.getCustomerByIdOrUpdateSchema, 'params'),
    customersController.getCustomerById
)

router.patch(
    '/update/:id',
    schemaValidate(customersValidator.getCustomerByIdOrUpdateSchema, 'params'),
    customersController.updateCustomer
)

router.delete(
    '/delete/:id',
    schemaValidate(customersValidator.getCustomerByIdOrUpdateSchema, 'params'),
    customersController.deleteCustomer
)
module.exports = router;