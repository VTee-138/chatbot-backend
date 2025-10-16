// sepay.dto.js
const PaymentDTO = require("./paymentDTO");

class SePayDTO extends PaymentDTO {
    constructor(data) {
        super({
            transactionId: data.id,
            amount: data.transferAmount,
            createdAt: data.transactionDate,
            paymentProvider: "sepay",
            status: "success",
            orderCode: data.code
        });
    }
}

module.exports = SePayDTO;
