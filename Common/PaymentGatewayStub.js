const sinon = use("sinon");
const Env = use("Env");
const moment = require("moment");

class PaymentGatewayStub {
  constructor(stubTarget) {
    const appUrl = Env.get("APP_URL");
    /**
     * Stub generateTW
     */
    sinon.stub(stubTarget, "generateTW").callsFake(async inputData => {
      const payStr =
        "PYSBX" +
        moment()
          .valueOf()
          .toString(32)
          .toUpperCase();
      return {
        response_code: "ss",
        response_detail: "success",
        data: {
          url: `${appUrl}/api/sb-pay/${payStr}`,
          payment_id: payStr
        }
      };
    });

    /**
     * Stub checkStatusByTrxId
     */
    sinon.stub(stubTarget, "checkStatusByTrxId").callsFake(async inputData => {
      return {
        response_code: "ss",
        response_detail: "success",
        data: {
          ORDER_ID: moment()
            .unix()
            .toString(),
          STATUS_CODE: "UP",
          STATUS_DESC: "UNPAID",
          AMOUNT: 10
        }
      };
    });
  }
}

module.exports = PaymentGatewayStub;
