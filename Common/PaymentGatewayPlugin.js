"use strict";

/** @type {import('@adonisjs/framework/src/Env')} */
const Env = use("Env");
const axios = require("axios");
const serializeError = require("serialize-error");
const Logger = use("Logger");

const PaymentGatewayStub = use("App/Common/PaymentGatewayStub");

class PaymentGatewayPlugin {
  constructor() {
    /// on Sandbox, turn on Stub
    const sandboxEnv = Env.get("NODE_ENV") === "sandbox";
    if (sandboxEnv) new PaymentGatewayStub(this);
  }
  /**
   *
   * {
   *  "response_code":"ss",
   *  "response_detail":"success",
   *  "data":{
   *    "url":"",
   *    "payment_id":""
   *  }
   * }
   */
  async generateTW(inputData) {
    try {
      const baseURL = Env.get("PG_URL");
      const response = await axios({
        method: "post",
        url: `${baseURL}/gateway/request_url`,
        headers: {
          "Content-Type": "application/json",
          signature: Env.get("PG_SIGNATURE")
        },
        data: inputData
      });
      return response.data;
    } catch (e) {
      Logger.warning("generateTW", serializeError(e));
      return { error: e.message };
    }
  }

  async checkStatusByTrxId(payment_id) {
    try {
      const baseURL = Env.get("PG_URL");
      const response = await axios({
        method: "post",
        url: `${baseURL}/api/v1/gateway/transaction/status`,
        headers: {
          "Content-Type": "application/json",
          signature: Env.get("PG_SIGNATURE")
        },
        data: {
          PAYMENT_ID: payment_id
        }
      });
      return response.data;
    } catch (e) {
      Logger.warning("checkStatusByTrxId", serializeError(e));
      return { error: e.message };
    }
  }

  async getAllTransactions(inputData) {
    try {
      const baseURL = Env.get("PG_URL");
      const response = await axios({
        method: "post",
        url: `${baseURL}/api/v1/gateway/transaction/all`,
        headers: {
          "Content-Type": "application/json",
          signature: Env.get("PG_SIGNATURE")
        }
      });
      console.log(response);
      return response.data;
    } catch (e) {
      Logger.warning("getAllTransactions", serializeError(e));
      return e;
    }
  }

  async getTrxByTrxId(payment_id) {
    try {
      const baseURL = Env.get("PG_URL");
      const response = await axios({
        method: "post",
        url: `${baseURL}/api/v1/gateway/transaction/id`,
        headers: {
          "Content-Type": "application/json",
          signature: Env.get("PG_SIGNATURE")
        },
        data: {
          PAYMENT_ID: payment_id
        }
      });
      return response.data;
    } catch (e) {
      Logger.warning("getTrxByTrxId", serializeError(e));
      return e;
    }
  }

  async getTrxByOrderId(order_id) {
    try {
      const baseURL = Env.get("PG_URL");
      const response = await axios({
        method: "post",
        url: `${baseURL}/api/v1/gateway/transaction/orderId`,
        headers: {
          "Content-Type": "application/json",
          signature: Env.get("PG_SIGNATURE")
        },
        data: {
          ORDER_ID: order_id
        }
      });
      return response.data;
    } catch (e) {
      Logger.warning("getTrxByOrderId", serializeError(e));
      return e;
    }
  }

  async getLiveStatusFromPaymentChannel(payment_id) {
    try {
      const baseURL = Env.get("PG_URL");
      const response = await axios({
        method: "post",
        url: `${baseURL}/api/v1/gateway/transaction/liveStatus`,
        headers: {
          "Content-Type": "application/json",
          signature: Env.get("PG_SIGNATURE")
        },
        data: {
          PAYMENT_ID: payment_id
        }
      });
      return response.data;
    } catch (e) {
      Logger.warning("getLiveStatusFromPaymentChannel", serializeError(e));
      return e;
    }
  }
}

module.exports = new PaymentGatewayPlugin();
