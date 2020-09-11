"use strict";
const btoa = use("btoa");
const moment = require("moment");
const Env = use("Env");
const crypto = require("crypto");
const Logger = use("Logger");
const User = use("App/Models/User");
const Database = use("Database");
const DepositM = use("App/Models/DepositLogHook");
const Ledger = use("App/Models/Ledger");
const Cache = use("Cache");
class MobilePulsaController {
  async callBack({
    request,
    response,
    auth
  }) {
    try{
      const data = JSON.parse(request.raw());
      Logger.info("MobilePulsaRaw", request.raw());
      Logger.info("MobilePulsaJSON", request.post());
      return response.send({status: true})
    } catch (error) {
      Logger.warning("Error", error.message);
      response.send({
        error: error.message
      });
    }
  }
}

module.exports = MobilePulsaController;
