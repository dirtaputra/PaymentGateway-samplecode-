"use strict";

const Logger = use("Logger");
const User = use("App/Models/User");
const BalanceKeeper = use("App/Common/BalanceKeeper");
const testing = use("App/Common/DepositAttr");
const coba = use("App/Common/DepositDownload");
const Mail = use("Mail");
const Env = use("Env");
const moment = require("moment");
let stage2_1;
let stage2_2;
let stage2_3;
const email_test = "dirtaputraanggara@yandex.com";
// const email_test2 = "dirtaputraanggara@gmail.com";
// const email_test3 = "141111021@mhs.stiki.ac.id";

/**
 *  controller for DepositRequest
 */
class DepositRequest {
  constructor() {
    const envMode = Env.get("NODE_ENV")
    if (envMode === "sandbox") {
      stage2_1 = email_test
      stage2_2 = email_test
      stage2_3 = email_test
    } else if (envMode === "development") {
      stage2_1 = email_test
      stage2_2 = email_test
      stage2_3 = email_test
    } else if (envMode === "production") {
      stage2_1 = Env.get("STAGE2_1");
      stage2_2 = Env.get("STAGE2_2");
      stage2_3 = Env.get("STAGE2_3");
    }
  }
  async store({
    request,
    params,
    response,
    auth
  }) {
    const url = request.input("url");
    const knownUser = await request.buyerAccount;
    console.log()
    try {
      var inputData = {
        user_id: knownUser.id,
        remark: request.input("remark"),
        amount: request.input("amount"),
        validator: '{"val1":"final","val2":""}',
        validate_by: '{"val1":"","val2":""}',
        created_by: knownUser.id,
        url: url,
        status: 0,
        type: 'deposit_transfer_app'
      }

      const Data = await testing.reqOverride(inputData)
      console.log(Data);
      const userData = await User.find(knownUser.id)
      const emailrp = await Mail.send(
        "emails.ceo", {
          email: userData.email,
          amount: request.input("amount"),
          datetime: moment()
            .utcOffset("+08:00")
            .format("DD-MMM-YYYY HH:mm:ss ZZ"),
          remark: request.input("remark")
        },
        message => {
          message.subject(`Please Approve Manual Deposit Transaction`);
          message.from("rpg.telinmy@yandex.com", "RPG Platform - TelinMY");
          message.to(stage2_1);
          message.to(stage2_2);
          message.to(stage2_3);
        }
      );
      //const data = await coba.testing();
      response.send({
        status: "OK",
        data: 'Waiting for approved..'
      });
    } catch (error) {
      response.send({
        status: "FAILED",
        error: `Error:${error}`
      });
    }
  }

}

module.exports = new DepositRequest;
