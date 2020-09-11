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
class JompayController {
  async testing({
    response
  }) {
    response.send({
      data: "success"
    });
  }

  async callBackBNS({
    request,
    response,
    auth
  }) {
    try {
      const data = JSON.parse(request.raw());
      Logger.info("JompayRaw", request.raw());
      Logger.info("JompayJSON", request.post());
      console.log(request.raw());
      console.log(request.post());
      const sig = data.header.sig;
      let key;
      const body = data.body
      var Concatenate = Object.keys(body).sort().map(function (key) {
        return body[key];
      });
      Concatenate = Concatenate.join().replace(/,/g, '')
      let date;
      if (Env.get("NODE_ENV") === "development") {
        date = moment(data.header.timestamp)
          .utcOffset(0)
          .format("YYYYMMDDHHmmss");
        key = Env.get("JOMPAY_KEY_DEVELOPMENT");
      } else {
        date = moment(data.header.timestamp)
          .utcOffset(0)
          .format("YYYYMMDDHHmmss");
        key = Env.get("JOMPAY_KEY");
      }
      Logger.info("date", date);
      const plainSignature = date + Concatenate + key;
      const signature = crypto
        .createHash("SHA256")
        .update(plainSignature)
        .digest("base64");
      console.log("signature :" + signature)
      const checkData = await Cache.get(sig)
      if (await Cache.has(sig)) {
        return response.send({
          body: {
            result: "N",
            errorcode: "99",
            errormessage: "Duplicate Transaction",
            resend: "N"
          }
        })
      } else {
        if (signature === sig) {
          const trxDb = await Database.beginTransaction();
          const user = await User.findBy("ref_number", data.body.rrn)
          const paidCount = (await DepositM.query()
            .where("user_id", user.id)
            .where("status", "PAID")
            .count("* as total"))[0].total;
          const amountRes = parseFloat(data.body.amount) / 100
          const deposit = await DepositM.create({
            user_id: user.id,
            payment_id: `JOM` + new Date().valueOf(),
            amount: amountRes,
            status: "PAID",
            detail: `Jompay`,
            data: data
          })
          /// add to ledger
          const credit = await Ledger.create({
            user_id: user.id,
            credit: amountRes,
            deposit_ref: deposit.id,
            transaction_ref: null,
            remark: `Jompay`
          });
          /// add processing fee < 500 (0.55) 
          const amountFee = parseFloat(data.body.amount) / 100
          if (amountFee < 500) {
            const debit = await Ledger.create({
              user_id: user.id,
              debit: 0.55,
              remark: `processing fee ${deposit.payment_id}`
            })
          }
          if (Number(paidCount) === 0) {
            const bonus = parseFloat((amountRes * 5) / 100);
            await Ledger.create({
              user_id: user.id,
              credit: bonus,
              deposit_ref: null,
              transaction_ref: null,
              remark: `5% bonus from ${amountRes}`,
              self_references: credit.id
            })
          }
          trxDb.commit();
          await Cache.forever(sig, sig)
          return response.send({
            body: {
              result: "Y",
              errorcode: "",
              errormessage: "",
              resend: "N"
            }
          })
        } else {
          return response.send({
            body: {
              result: "N",
              errorcode: "99",
              errormessage: "Invalid Signature",
              resend: "Y",
            }
          })
        }
      }
    } catch (error) {
      Logger.warning("Error", error.message);
      response.send({
        error: error.message
      });
    }
  }
}

// async function bns(data){

// }

module.exports = JompayController;
