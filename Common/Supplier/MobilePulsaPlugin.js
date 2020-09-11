'use strict'

const axios = require("axios");
const serializeError = require("serialize-error");
const Logger = use("Logger");
const MD5 = use("md5");
const MobilePulsaStub = use("App/Common/Supplier/MobilePulsaStub");
const Env = use("Env");

class MobilePulsaPlugin {
  constructor() {
    const sandboxEnv = Env.get("NODE_ENV") === "development";
    if (sandboxEnv) new MobilePulsaStub(this);
    this._uri = "https://testprepaid.mobilepulsa.net/v1/legacy/index";
    this._username = "085112406046";
    this._apiKey = "3215d5bdbb01842e";
    this._axiosConfig = {
      headers: {
        'Content-Type': 'application/json;charset=UTF-8'
      }
    }
  }

  async balance() {
    try {
      const {
        status,
        data
      } = await axios.post(this._uri, {
        "commands": "balance",
        "username": this._username,
        "sign": MD5(this._username + this._apiKey + "bl")
      }, this._axiosConfig);
      Logger.info("MobilePulsa:checkBalance", data);
      return {
        status: status,
        data: data.data,
      };
    } catch (e) {
      Logger.warning("MobilePulsa:checkBalance", serializeError(e));
      return e;
    }
  }

  async priceList() {
    try {
      const {
        status,
        data
      } = await axios.post(this._uri, {
        "commands": "pricelist",
        "username": this._username,
        "sign": MD5(this._username + this._apiKey + "pl")
      }, this._axiosConfig);
      Logger.info("MobilePulsa:PriceList", data);
      return {
        status: status,
        data: data.data,
      };
    } catch (e) {
      Logger.warning("MobilePulsa:PriceList", serializeError(e));
      return e;
    }
  }

  async requestTransaction(inputData) {
    try {
      const {
        status,
        data
      } = await axios.post(this._uri, {
        "commands": "topup",
        "username": this._username,
        "ref_id": inputData.ref_id,
        "hp": inputData.target,
        "pulsa_code": inputData.pulsa_code,
        "sign": MD5(this._username + this._apiKey + inputData.ref_id)
      }, this._axiosConfig);
      Logger.info("MobilePulsa:RequestTransaction", data)
      return {
        status: status,
        data: data.data
      }
    } catch (error) {
      Logger.info("MobilePulsa:RequestTransaction", serializeError(error))
      return error
    }
  }

  async cekStatus(inputData) {
    try {
      const {
        status,
        data
      } = await axios.post(this._uri, {
        "commands": "inquiry",
        "username": this._username,
        "ref_id": inputData.ref_id,
        "sign": MD5(this._username + this._apiKey + inputData.ref_id)
      })
      Logger.info("MobilePulsa:RequestTransaction", data)
      return {
        status: status,
        data: data.data
      }
    } catch (error) {
      Logger.info("MobilePulsa:cekStatus", serializeError(error))
      return error
    }
  }
}

module.exports = new MobilePulsaPlugin()
