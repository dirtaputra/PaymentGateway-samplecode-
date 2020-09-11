const delay = require("delay");

const Event = use("Event");
const Transaction = use("App/Models/Transaction");
const TransactionHistory = use("App/Models/TransactionHistory");
const BK = use("App/Common/BalanceKeeper");
const MobilePulsaPlugin = use("App/Common/Supplier/MobilePulsaPlugin");
const Logger = use("Logger");
const serializeError = require("serialize-error");
const Env = use("Env");
const Mail = use("Mail");
const moment = use("moment");
const twcl = use("TwilioSms");
const numeral = require("numeral");
const rc_desc = {
  "00": "SUCCESS",
  "06": "TRANSACTION NOT FOUND",
  "07": "FAILED",
  "13": "CUSTOMER NUMBER BLOCKED ",
  "14": "INCORRECT DESTINATION NUMBER",
  "16": "NUMBER NOT MATCH WITH OPERATOR",
  "17": "INSUFFICIENT DEPOSIT ",
  "20": "CODE NOT FOUND",
  "39": "PROCESS",
  "43": "DATE INTERVAL CANNOT MORE THAN 31 DAYS",
  "102": "INVALID IP ADDRESS",
  "106": "PRODUCT IS TEMPORARILY OUT OF SERVICE",
  "107": "ERROR IN XML FORMAT",
  "117": "PAGE NOT FOUND",
  "201": "UNDEFINED RESPONSE CODE",
  "202": "MAXIMUM 1 NUMBER 1 TIME IN 1 DAY",
  "203": "NUMBER IS TOO LONG",
  "204": "WRONG AUTHENTICATION",
  "205": "WRONG COMMAND",
  "206": "THIS DESTINATION NUMBER HAS BEEN BLOCKED",
  "207": "MAXIMUM 1 NUMBER WITH ANY CODE 1 TIME IN 1 DAY"
};
class MobilePulsaWorker {
  get concurrency() {
    return 1;
  }

  get backoffStrategy() {
    return {
      settings: {
        backoffStrategies: {
          checkStatus: function (attemptsMade, err) {
            if (attemptsMade <= 36) return 1000 * 5; // less than 3 mins: 5s delay
            if (36 < attemptsMade && attemptsMade <= 78) return 1000 * 10; // 3rd - 10th min: 10s delay
            if (78 < attemptsMade && attemptsMade <= 118) return 1000 * 15; // 10th - 20th min: 15s delay
            if (118 < attemptsMade && attemptsMade <= 198)
              return 1000 * 30; // 20th - 60th min: 30s delay
            else return 1000 * 60 * 2;
          },
        },
      },
    };
  }

  async handler(job) {
    try {
      console.log("MobilePulsaWorker");
      console.log(job.data);
      if (job.data.state === "TRANSACTION_MOBILEPULSA") return await this.invokeTransaction(job);
      if (job.data.state === "STATUS") return await this.queryStatus(job);
      if (job.data.state === "SMS") return await this.sms(job);
    } catch (e) {
      Logger.warning("MobilePulsaWorker", serializeError(e));
      throw e;
    }
  }

  /**
   * Refund for FAILED Transaction
   */
  async refundBalance(buyerId, historyId, amount) {
    await BK.add({
      userId: buyerId,
      amount,
      trxRef: historyId,
      depositRef: null,
    });
  }

  /**
   * HANDLER untuk Purchase Request
   */
  async invokeTransaction(job) {
    const jobData = job.data;
    const trxDataObj = await fetchTrxData(jobData.trxId);
    const trxData = trxDataObj.toJSON();
    let number = trxData.target === "000000" ? "601142601043" : trxData.target;
    var inputData = {
      ref_id: jobData.trxId,
      target: number,
      pulsa_code: trxData.supply.supplier_product_id.operator_code,
    }
    console.log(trxData.supply.supplier_product_id.operator_code);
    const status = await MobilePulsaPlugin.requestTransaction(inputData);

    if (status.data.rc === "39" || status.data.rc === "201") {
      const pendingHistory = await TransactionHistory.create({
        trx_id: jobData.trxId,
        status: "PENDING",
        data: status,
      });
      Event.fire("MOBILEPULSA::STATUS", {
        trxId: jobData.trxId,
      });
      return status;
    } else {
      status.reason = rc_desc[status.data.rc]
      const failedHistory = await TransactionHistory.create({
        trx_id: jobData.trxId,
        status: "FAILED",
        remark: rc_desc[status.data.rc],
        data: status,
      });
      await this.refundBalance(trxData.buyer_id, failedHistory.id, trxData.sell_price);
      notifyDone(trxData, failedHistory);
      return status;
    }
  }

  async queryStatus(job) {
    const mail = Env.get("TRANGLO_PROBLEM_EMAIL_1");
    const mail2 = Env.get("TRANGLO_PROBLEM_EMAIL_2");
    const jobData = job.data;
    const trxDataObj = await fetchTrxData(jobData.trxId);
    const trxData = trxDataObj.toJSON();
    //const trxData = (await fetchTrxData(jobData.trxId)).toJSON();
    const recentHistory = (await TransactionHistory.query()
      .where("trx_id", jobData.trxId)
      .orderBy("created_at", "desc")
      .fetch()).first();
      // check status
    const check = ["SUCCESS","FAILED"].includes(recentHistory.status);
    if (check) {
      const status_latest = recentHistory.toJSON();
      Logger.info("Done queryStatus:", status_latest);
      notifyDone(trxData, status_latest);
      return status_latest;
    }
    const inputData = Object.assign({
      ref_id: jobData.trxId,
    });
    const status = await MobilePulsaPlugin.cekStatus(inputData);
    console.log(status);
    if (status.data.rc === "39" || status.data.rc === "201") {
      status.refID = jobData.refID
      recentHistory.status = "PENDING";
      recentHistory.remark = job.attemptsMade;
      recentHistory.data = status
      recentHistory.save();
      if (job.attemptsMade + 1 < job.opts.attempts) {
        Logger.info("throw on queryStatus:" + jobData.trxId, status);
        throw new Error(jobData.trxId);
      } else {
        /// kalau sudah limit dibuat FAILED dan dilakukan REFUND
        // const failedHistory = await TransactionHistory.create({
        //   trx_id: jobData.trxId,
        //   status: "FAILED",
        //   remark: "Manual Check to me reload",
        //   data: status
        // });
        status.reason = "More than 30 minutes, Please wait.."
        recentHistory.status = "PENDING";
        recentHistory.remark = "Manual Check to Mereload";
        recentHistory.data = status;
        recentHistory.save();
        const emailrp = await Mail.send(
          "emails.Mereload", {
            datetime: moment().utcOffset("+08:00").format("DD-MMM-YYYY HH:mm:ss ZZ"),
            refID: jobData.refID,
            dealer_txn: jobData.trxId,
            remark: "Transaction Hold on Mereload please manual cek",
          },
          (message) => {
            message.subject(`Transaction hold on Mereload ${jobData.refID}`);
            message.from("rpg.telinmy@yandex.com", "RPG Platform - TelinMY");
            message.to(mail);
            message.to(mail2);
            ///stage 2 email
          },
        );
        // refund Balance
        //await this.refundBalance(trxData.buyer_id, failedHistory.id, trxData.sell_price);
      }
      return status;
    } else {
      if (status.data.rc === "00") {
        const serialNo = status.data.sn;
        status.serialNo = status.data.sn;
        const successHistory = await TransactionHistory.create({
          trx_id: jobData.trxId,
          status: "SUCCESS",
          data: status,
        });
        if (
          Env.get("NODE_ENV") === "production" &&
          trxData.supply.product_code.toUpperCase() === "INDOMART"
        ) {
          // const message = await twcl.send(
          //   trxData.target,
          //   `Thank you for using MyKedai.\nALFAMART Voucher IDR ${numeral(trxData.denom).format(
          //     "0,0.00",
          //   )}\nVoucher Code : ${serialNo}`,
          // );
          Event.fire("MOBILEPULSA::SMS", {
            trxId: jobData.trxId,
            denom: trxData.denom,
            target: trxData.target,
            serialno: serialNo,
          });
        }
        notifyDone(trxData, successHistory);
        return status;
      } else {
        status.reason = rc_desc[status.data.rc]
        const failedHistory = await TransactionHistory.create({
          trx_id: jobData.trxId,
          status: "FAILED",
          remark: rc_desc[status.data.rc],
          data: status,
        });
        await this.refundBalance(trxData.buyer_id, failedHistory.id, trxData.sell_price);
        notifyDone(trxData, failedHistory);
        return status;
      }
    }
  }

  async sms(job) {
    const jobData = job.data;
    if (jobData.target === "000000") {
      return Logger.notice("B2B:INDOMART");
    } else {
      const message = await twcl.send(
        jobData.target,
        `Terima kasih sudah menggunakan MyKedai.\nVoucher INDOMART IDR ${numeral(jobData.denom).format(
					"0,0.00",
				)}\nKode Voucher : ${jobData.serialno}`,
      );

      Logger.notice("MOBILEPULSA:SMS", serializeError(message));

      return serializeError(message);
    }

  }
}

module.exports = MobilePulsaWorker;

/**
 *  Fetch trx data and supply Info
 */
async function fetchTrxData(id) {
  return (await Transaction.query().where("id", id).with("supply").fetch()).first();
}

/**
 * notify is DONE.. Might be failed or success
 */
async function notifyDone(trxData, recentHistory) {}
