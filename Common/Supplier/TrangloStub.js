const sinon = use("sinon");

const moment = require("moment");

class TrangloStub {
  constructor(stubTarget) {
    /**
     * Stub query balance
     */
    sinon.stub(stubTarget, "requestTopup").callsFake(async inputData => {
      return {
        statusCode: 200,

        result: true,
        Status: {
          Code: "968",
          Type: "Pending",
          Description: "Transaction Pending"
        },
        Denomination: "50000.00",
        OperatorCode: "ID_AM",
        ProductPrice: "15.65",
        AmountAfterTax: "50000.00",
        AmountCurrency: "IDR",
        WalletCurrency: "MYR",
        TrangloTransactionId: "190619123602024",
        OperatorTransactionID: {}
      };
    });

    /**
     * Stub checkTransactionStatus -->
     */
    sinon.stub(stubTarget, "checkTransactionStatus").callsFake(async transaction_id => {
      return {
        statusCode: 200,
        result: true,
        TrangloTransactionId: "190619123602024",
        DealerTransactionStatus: {
          Code: "968",
          Description: "Pending",
          Type: "Pending",
        }
      };
    });

    sinon.stub(stubTarget, "checkTransactionStatusDetails").callsFake(async transaction_id => {
      return {
        statusCode: 200,
        result: true,
        TrangloTransactionId: "190620092356072",
        DealerTransactionId: "TRXXXX4370ZGE5EE",
        serialNo: "DUMMY123",
        DealerTransactionStatus: {
          Code: "000",
          Description: "Transaction is Success",
          Type: "Approved"
        },
        OperatorTransactionID: "190620092356072",
        DestNo: "6285791858101",
        ProdCode: "ID_AM_50000",
        serialNo: "DUMMY199678674",
        WalletCurrency: "MYR",
        ProductPrice: "15.6500000000",
        AmountCurrency: "IDR",
        AmountAfterTax: "50000.0000000000"
      };
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
    // sinon.stub(stubTarget, "getReloadPINImmediate").callsFake(async local_MO_ID => {
    //   return {
    //     statusCode: 200,
    //     data: {
    //       result: "true",
    //       serial_number: "900852",
    //       pin: "886845479848187",
    //       expiry_date: {},
    //       reload_telco: "DIGIPIN-NOTVALID",
    //       amount: "5",
    //       DN_received_id: "1352",
    //       instruction: "0166666666.DP10",
    //       description: "Key in *123*<16-digit reload PIN>#, press SEND.",
    //       batch_id: "9"
    //     }
    //   };
    // });

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

module.exports = TrangloStub;
