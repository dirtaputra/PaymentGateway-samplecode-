const sinon = use("sinon");

const moment = require("moment");

class FinnetStub {
  constructor(stubTarget) {
    /**
     * Stub billInquiry
     */
    sinon.stub(stubTarget, "billInquiry").callsFake(async inputData => {
      return {
        statusCode: 200,
        data: {
          sysCode: "840719540751",
          resultCode: "0",
          resultDesc: "Approve",
          productCode: "070006",
          merchantCode: "FNN008",
          terminal: "RPG_STUB",
          merchantNumber: "+6281000111222",
          amount: "0",
          feeAmount: "550",
          transactionType: "38",
          billNumber: "45015703988",
          bit61: "45015703988",
          bit39: "0",
          traxId: "921624545999303667",
          timeStamp: moment().format("DD-MM-YYYY HH:mm:ss:MSMSMS"),
          timeStampServer: moment().format("DD-MM-YYYY HH:mm:ss:MSMSMS")
        }
      };
    });

    /**
     * Stub billPayment -->
     */
    sinon.stub(stubTarget, "billPayment").callsFake(async transaction_id => {
      return {
        statusCode: 200,
        data: {
          sysCode: "840719540751",
          resultCode: "0",
          resultDesc: "Approve",
          productCode: "070006",
          merchantCode: "FNN008",
          terminal: "RPG_STUB",
          merchantNumber: "+6281000111222",
          amount: "0",
          feeAmount: "550",
          transactionType: "38",
          billNumber: "45015703988",
          bit61: "45015703988",
          bit39: "0",
          traxId: "921624545999303667",
          timeStamp: moment().format("DD-MM-YYYY HH:mm:ss:MSMSMS"),
          timeStampServer: moment().format("DD-MM-YYYY HH:mm:ss:MSMSMS")
        }
      };
    });

    /**
     * Stub customerTxStatus -->
    //  */
    // sinon.stub(stubTarget, "customerTxStatus").callsFake(async inputData => {
    //   throw new Error("Stub enforce to Pending");
    // });

    /**
     * Stub checkStatus -->
     */
    sinon.stub(stubTarget, "checkStatus").callsFake(async local_MO_ID => {
      return {
        statusCode: 200,
        data: {
          sysCode: "840719540751",
          resultCode: "0",
          resultDesc: "Approve",
          productCode: "070006",
          merchantCode: "FNN008",
          terminal: "RPG_STUB",
          merchantNumber: "+6281000111222",
          amount: "0",
          feeAmount: "550",
          transactionType: "38",
          billNumber: "45015703988",
          bit61: "45015703988",
          bit39: "0",
          traxId: "921624545999303667",
          timeStamp: moment().format("DD-MM-YYYY HH:mm:ss:MSMSMS"),
          timeStampServer: moment().format("DD-MM-YYYY HH:mm:ss:MSMSMS")
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
          sysCode: "912523888629",
          resultCode: "0",
          resultDesc: "Approve",
          productCode: "000001",
          merchantCode: "FNN008",
          terminal: "RPG_STUB",
          merchantNumber: "+6281000111222",
          amount: "917185",
          recipientName: "Dev Lunari",
          recipientNumber: "+6281000111222",
          transactionType: "61",
          traxId: "921650088150279228",
          timeStamp: moment().format("DD-MM-YYYY HH:mm:ss:MSMSMS"),
          timeStampServer: moment().format("DD-MM-YYYY HH:mm:ss:MSMSMS")
        }
      };
    });
  }
}

module.exports = FinnetStub;
