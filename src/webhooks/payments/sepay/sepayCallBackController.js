const sepayCallbackService = require("./sepayCallBackService");
const SePayDTO = require("../../../dto/request/sepayDTO");
const handleSepayCallback = async (req, res, next) => {
    try {
        let paymentData = new SePayDTO(req.body);
        paymentData = paymentData.toJSON();
        const result = await sepayCallbackService.handleSepayCallback(paymentData);
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return next(error);
    }
};

module.exports = {
    handleSepayCallback,
};
