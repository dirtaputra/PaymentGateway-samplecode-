const delay = require("delay");

const Event = use("Event");
const Transaction = use("App/Models/Transaction");
const TransactionHistory = use("App/Models/TransactionHistory");
const BK = use("App/Common/BalanceKeeper");
const TrangloPlugin = use("App/Common/Supplier/TrangloPlugin");
const Logger = use("Logger");
const serializeError = require("serialize-error");
const Env = use("Env");
const Mail = use("Mail");
const moment = use("moment");
const twcl = use("TwilioSms");
const numeral = require("numeral");

class TrangloWorker {
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
      console.log("TrangloWorker");
      console.log(job.data);
      if (job.data.state === "TRANSACTION_TRANGLO") return await this.invokeTransaction(job);
      if (job.data.state === "STATUS") return await this.queryStatus(job);
      if (job.data.state === "SMS") return await this.sms(job);
    } catch (e) {
      Logger.warning("TrangloWorker", serializeError(e));
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
    const inputData = Object.assign({
      denom: trxData.denom,
      SourceNo: number,
      DestNo: number,
      TrxID: jobData.trxId,
      product_code: trxData.supply.supplier_product_id.operator_code,
    });
    console.log(trxData.supply.supplier_product_id.operator_code);
    const status = await TrangloPlugin.requestTopup(inputData);

    if (status.Status.Type != "Error") {
      const pendingHistory = await TransactionHistory.create({
        trx_id: jobData.trxId,
        status: "PENDING",
        data: status,
      });
      Event.fire("TRANGLO::STATUS", {
        trxId: jobData.trxId,
        TrangloTransactionID: status.TrangloTransactionId,
      });
      return status;
    } else {
      const failedHistory = await TransactionHistory.create({
        trx_id: jobData.trxId,
        status: "FAILED",
        remark: status.Status.Description,
        data: status,
      });
      // Event.fire("TRANGLO::STATUS", {
      //   trxId: jobData.trxId,
      //   TrangloTransactionID: status.TrangloTransactionID
      // });
      //DealerTransactionId;
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

    const check = ["SUCCESS","FAILED"].includes(recentHistory.status);
    if (check) {
      const status_latest = recentHistory.toJSON();
      Logger.info("Done queryStatus:", status_latest);
      notifyDone(trxData, status_latest);
      return status_latest;
    }

    const inputData = Object.assign({
      DealerTransactionID: jobData.trxId,
      TrangloTransactionID: recentHistory.data.TrangloTransactionId,
    });
    const status = await TrangloPlugin.checkTransactionStatus(inputData);
    const detail_status = await TrangloPlugin.checkTransactionStatusDetails(inputData);
    console.log(detail_status);
    if (detail_status.DealerTransactionStatus.Type === "Pending") {
      recentHistory.status = "PENDING";
      recentHistory.remark = job.attemptsMade;
      recentHistory.save();
      if (job.attemptsMade + 1 < job.opts.attempts) {
        Logger.info("throw on queryStatus:" + jobData.trxId, status);
        throw new Error(status.DealerTransactionStatus.Type || status.DealerTransactionStatus.Code);
      } else {
        /// kalau sudah limit dibuat FAILED dan dilakukan REFUND
        const failedHistory = await TransactionHistory.create({
          trx_id: jobData.trxId,
          status: "PENDING",
          remark: "Manual Check",
          data: detail_status,
        });
        ///send email ketika transaksi dianggap failed
        const emailrp = await Mail.send(
          "emails.TrangloAM", {
            datetime: moment().utcOffset("+08:00").format("DD-MMM-YYYY HH:mm:ss ZZ"),
            tranglo_id: status.TrangloTransactionId,
            dealer_txn: jobData.trxId,
            remark: "Transaction Hold on Tranglo please manual cek",
          },
          (message) => {
            message.subject(`Transaction hold on Tranglo`);
            message.from("rpg.telinmy@yandex.com", "RPG Platform - TelinMY");
            message.to(mail);
            message.to(mail2);
            ///stage 2 email
          },
        );
        // refund Balance
        //await this.refundBalance(trxData.buyer_id, failedHistory.id, trxData.sell_price);
      }
      // const pendingHistory = await TransactionHistory.create({
      //   trx_id: jobData.trxId,
      //   status: "PENDING",
      //   data: status
      // });
      return status;
    } else if (detail_status.DealerTransactionStatus.Type === "Approved") {
      const serialNo = detail_status.serialNo;
      console.log(serialNo);
      const successHistory = await TransactionHistory.create({
        trx_id: jobData.trxId,
        status: "SUCCESS",
        data: detail_status,
      });
      if (
        Env.get("NODE_ENV") === "production" &&
        trxData.supply.supplier_product_id.operator_code.toUpperCase() === "ID_AM"
      ) {
        // const message = await twcl.send(
        //   trxData.target,
        //   `Thank you for using MyKedai.\nALFAMART Voucher IDR ${numeral(trxData.denom).format(
        //     "0,0.00",
        //   )}\nVoucher Code : ${serialNo}`,
        // );
        Event.fire("TRANGLO::SMS", {
          trxId: jobData.trxId,
          denom: trxData.denom,
          target: trxData.target,
          serialno: serialNo,
        });
      }
      notifyDone(trxData, successHistory);
      return status;
    } else {
      const failedHistory = await TransactionHistory.create({
        trx_id: jobData.trxId,
        status: "FAILED",
        remark: detail_status.reason,
        data: detail_status,
      });
      await this.refundBalance(trxData.buyer_id, failedHistory.id, trxData.sell_price);
      notifyDone(trxData, failedHistory);
      return status;
    }
  }

  async sms(job) {
    const jobData = job.data;
    if (jobData.target === "000000") {
      return Logger.notice("B2B:ALFAMART");
    } else {
      const message = await twcl.send(
        jobData.target,
        `Terima kasih sudah menggunakan MyKedai.\nVoucher ALFAMART IDR ${numeral(jobData.denom).format(
					"0,0.00",
				)}\nKode Voucher : ${jobData.serialno}`,
      );

      Logger.notice("Tranglo:SMS", serializeError(message));

      return serializeError(message);
    }

  }
}

module.exports = TrangloWorker;

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
