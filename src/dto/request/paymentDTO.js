// payment.dto.js
class PaymentDTO {
    constructor({ transactionId, amount, createdAt, paymentProvider, status, orderCode }) {
        this.transactionId = transactionId;
        this.amount = Number(amount);
        this.createdAt = createdAt;
        this.paymentProvider = paymentProvider;
        this.status = status;
        this.orderCode = orderCode;
    }
    toJSON() {
        return {
            transactionId: this.transactionId,
            amount: this.amount,
            createdAt: this.createdAt,
            paymentProvider: this.paymentProvider,
            status: this.status,
            orderCode: this.orderCode
        };
    }
}

module.exports = PaymentDTO;
