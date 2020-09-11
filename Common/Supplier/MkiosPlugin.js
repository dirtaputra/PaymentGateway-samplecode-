const axios = require("axios");
const moment = require("moment");
const Env = use("Env");
const Logger = use("Logger");
const serializeError = require("serialize-error");
const MkiosStub = use("App/Common/Supplier/MkiosStub");

class MkiosPlugin {
  //
  constructor() {
    this._url = Env.get("MKIOS_URI", "http://mkios.telin.com.my:8021/api/dealer");
    this._fixedParams = {
      UserID: Env.get("MKIOS_USER", ""),
      PassID: Env.get("MKIOS_PASS", "")
    };

    /// on Sandbox, turn on Stub
    const sandboxEnv = Env.get("NODE_ENV") === "sandbox";
    if (sandboxEnv) new MkiosStub(this);
  }
  //
  async requestTransactionRM(denom, target) {
    console.log("requestTransactionRM");
    //
    try {
      if ([1, 5, 10, 20, 30, 50, 100].includes(Number(denom)) === false) {
        throw new Error("Invalid denom");
      }
      const finalTarget = target.startsWith("60") ? target : `60${target}`;
      const reqId = moment().format("YYMMDDHHmmssSS");
      const additionalParams = {
        destnumber: finalTarget,
        reqid: reqId
      };
      // check dest. number validity
      const checkRequestBody = Object.assign({}, this._fixedParams, additionalParams, {
        source: Env.get("MKIOS_SOURCE", ""),
        method: "GETACCOUNT"
      });
      const accountData = await axios.post(this._url, checkRequestBody);
      if (accountData.data.rc == "0") {
        // dest. number is valid
        // // request transaction
        const transRequestBody = Object.assign({}, this._fixedParams, additionalParams, {
          source: Env.get("MKIOS_SOURCE", ""),
          denom: `RM${Number(denom)}`,
          method: "TRANSACTION"
        });
        console.log(transRequestBody);
        const {
          data
        } = await axios.post(this._url, transRequestBody);
        if (data.rc == "0") {
          // success
          return {
            id: reqId,
            data
          };
        } else {
          // failed
          return {
            id: reqId,
            error: `MKIOS_${data.rc}: ${data.message}`,
            data
          };
        }
      } else {
        // invalid dest. number
        return {
          id: reqId,
          error: `MKIOS_${accountData.data.rc}: ${accountData.data.message}`
        };
      }
    } catch (e) {
      Logger.warning("requestTransactionRM", serializeError(e));
      return {
        error: e
      };
    }
  }

  async requestTransactionRP(denom, target) {
    console.log("requestTransactionRP");
    //
    try {
      if ([10000, 15000, 20000, 25000, 30000, 40000, 50000, 75000, 100000].includes(Number(denom)) === false) {
        throw new Error("Invalid denom");
      }
      const finalTarget = target.replace(/^(620|62|0)/ig, '62')
      console.log("mkios plugin :" + finalTarget)
      const reqId = moment().format("YYMMDDHHmmssSS");
      const additionalParams = {
        destnumber: finalTarget,
        reqid: reqId
      };
      // // request transaction
      const transRequestBody = Object.assign({}, this._fixedParams, additionalParams, {
        source: finalTarget,
        denom: `RP${Number(denom)}`,
        method: "TRANSACTION"
      });
      console.log(transRequestBody);
      const {
        data
      } = await axios.post(this._url, transRequestBody);
      if (data.rc == "0") {
        // success
        return {
          id: reqId,
          data
        };
      } else {
        // failed
        return {
          id: reqId,
          error: `MKIOS_${data.rc}: ${data.message}`,
          data
        };
      }
    } catch (e) {
      Logger.warning("requestTransactionRP", serializeError(e));
      return {
        error: e
      };
    }
  }

  async queryStatusRM(reqId, denom, target) {
    console.log("queryStatusRM");
    //
    try {
      console.log({
        reqId,
        denom,
        target
      });
      if ([1, 5, 10, 20, 30, 50, 100].includes(Number(denom)) === false) {
        throw new Error("Invalid denom");
      }
      const finalRequestBody = Object.assign({}, this._fixedParams, {
        source: Env.get("MKIOS_SOURCE", ""),
        destnumber: target.replace("+", ""),
        denom: `RM${Number(denom)}`,
        reqid: reqId,
        method: "STATUS"
      });
      const {
        data
      } = await axios.post(this._url, finalRequestBody);
      if (["100", "101", "20"].includes(data.rc)) {
        return {
          id: reqId,
          status: data.rc === "100" ? "SUCCESS" : data.rc === "101" ? "FAILED" : "NOTFOUND",
          data
        };
      } else {
        return {
          id: reqId,
          error: `MKIOS_${data.rc}: ${data.message}`
        };
      }
    } catch (e) {
      Logger.warning("queryStatusRM", serializeError(e));
      return {
        error: e
      };
    }
  }

  async queryStatusRP(reqId, denom, target) {
    console.log("queryStatusRP");
    //
    try {
      console.log({
        reqId,
        denom,
        target
      });
      if ([10000, 20000, 25000, 50000, 100000].includes(Number(denom)) === false) {
        throw new Error("Invalid denom");
      }
      const finalRequestBody = Object.assign({}, this._fixedParams, {
        source: target.replace("+", ""),
        destnumber: target.replace("+", ""),
        denom: `RP${Number(denom)}`,
        reqid: reqId,
        method: "STATUS"
      });
      const {
        data
      } = await axios.post(this._url, finalRequestBody);
      if (["100", "101", "20"].includes(data.rc)) {
        return {
          id: reqId,
          status: data.rc === "100" ? "SUCCESS" : data.rc === "101" ? "FAILED" : "NOTFOUND",
          data
        };
      } else {
        return {
          id: reqId,
          error: `MKIOS_${data.rc}: ${data.message}`,
          data
        };
      }
    } catch (e) {
      Logger.warning("queryStatusRP", serializeError(e));
      return {
        error: e
      };
    }
  }

  async queryBalance(reqId) {
    //
    try {
      const finalRequestBody = Object.assign({}, this._fixedParams, {
        reqid: reqId,
        method: "GETBALANCE"
      });
      delete finalRequestBody.source;
      const {
        data
      } = await axios.post(this._url, finalRequestBody);
      if (data.rc == "0") {
        // all balance
        const regExp = /rm=(\d+)|(?:v\d{2,3}=(\d+))+/gim;
        const balances = [];
        let matches;
        while ((matches = regExp.exec(data.message))) {
          const splittedData = matches[0].split("=");
          balances.push({
            id: splittedData[0].replace("v", ""),
            value: splittedData[1]
          });
        }

        return {
          id: reqId,
          status: "OK",
          balanceRM: (/rm=(\d+(?:.\d+)?)\,/gi.exec(data.message) || ["", ""])[1],
          balanceAll: balances
        };
      } else {
        return {
          id: reqId,
          status: "FAIL",
          message: `MKIOS_${data.rc}: ${data.message}`
        };
      }
    } catch (e) {
      Logger.warning("queryBalance", serializeError(e));
      return {
        error: e
      };
    }
  }
}

module.exports = new MkiosPlugin();
