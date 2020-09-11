const sinon = use("sinon");
const moment = require("moment");
const TransactionHistory = use("App/Models/TransactionHistory");
const Transaction = use("App/Models/Transaction");
const Database = use("Database");

class SrsStub {
  constructor(stubTarget) {
    /**
     * Stub query balance
     */
    sinon.stub(stubTarget, "requestTopup").callsFake(async (inputData) => {
      return {
        statusCode: 200,
        data: {
          result: true,
          response_id: `${moment().format("YYYYMMDDHHmmssSSS")}${Math.floor(100 + Math.random() * 999)}`,
          status: "SUBMIT_SUCCESS"
        }
      };
    });

    /**
     * Stub checkTransactionStatus -->
     */
    sinon.stub(stubTarget, "checkTransactionStatus").callsFake(async (response_id) => {
      const trxHist = await TransactionHistory.query()
        .where(Database.raw("data->>'response_id'"), response_id)
        .first();

      const trxData = await Transaction.find(trxHist.trx_id);
      const code = `53548${Math.floor(100 + Math.random() * 999)} NOT VALID`;

      switch (trxData.target) {
        case "60123456787":
        case "60123456788":
        case "60123456789":
          return {
            statusCode: 200,
              data: {
                result: "true",
                status: "SUCCESS",
                error_code: code,
                DN_received_id: code
              }
          };

        default:
          return {
            statusCode: 200,
              data: {
                result: true,
                response_id: response_id,
                status: "REFUNDED",
                DN_received_id: "Invalid Product"
              }
          };
      }
    });

    /**
     * Stub customerTxStatus -->
    //  */
    // sinon.stub(stubTarget, "customerTxStatus").callsFake(async inputData => {
    //   throw new Error("Stub enforce to Pending");
    // });

    /**
     * Stub getReloadPINImmediate -->
     */
    sinon.stub(stubTarget, "getReloadPINImmediate").callsFake(async (local_MO_ID) => {
      return {
        statusCode: 200,
        data: {
          result: "true",
          serial_number: "900852",
          pin: "886845479848187",
          expiry_date: {},
          reload_telco: "DIGIPIN-NOTVALID",
          amount: "5",
          DN_received_id: "1352",
          instruction: "0166666666.DP10",
          description: "Key in *123*<16-digit reload PIN>#, press SEND.",
          batch_id: "9"
        }
      };
    });

    /**
     * Stub checkBalance
     */
    sinon.stub(stubTarget, "checkBalance").callsFake(async () => {
      return {
        statusCode: 200,
        data: {
          result: true,
          response_id: "1",
          status: "QUERY_SUCCESS",
          balance: "60300.970"
        }
      };
    });
  }
}

module.exports = SrsStub;
