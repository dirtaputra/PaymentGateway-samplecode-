const sinon = use("sinon");

const moment = require("moment");

class MobilePulsaStub {
  constructor(stubTarget) {
    /**
     * Stub query balance
     */
    sinon.stub(stubTarget, "requestTransaction").callsFake(async inputData => {
      return {

        "data": {
          "hp": "3.6285732283196",
          "rc": "39",
          "code": "indomaret10",
          "price": 10000,
          "tr_id": 16431,
          "ref_id": "TRXXXX4B0913QAF0",
          "status": 0,
          "balance": 99910000,
          "message": "PROCESS"
        },
        "status": 200
      }
    });

    /**
     * Stub checkTransactionStatus -->
     */

    sinon.stub(stubTarget, "cekStatus").callsFake(async transaction_id => {
      return {
        "data": {
          "hp": "3.6285732283196",
          "rc": "00",
          "sn": "B2CCBF4A15UC / 2019-06-21",
          "code": "indomaret10",
          "price": 10000,
          "tr_id": 16431,
          "ref_id": "TRXXXX4B0913QAF0",
          "status": 1,
          "balance": 99910000,
          "message": "SUCCESS"
        },
        "status": 200,
        "serialNo": "B2CCBF4A15UC / 2019-06-21"
      };
    });

    /**
     * Stub checkBalance
     */
    sinon.stub(stubTarget, "balance").callsFake(async () => {
      return {
        status: 200,
        data: {
          balance: "60300.970"
        }
      };
    });
  }
}

module.exports = MobilePulsaStub;
