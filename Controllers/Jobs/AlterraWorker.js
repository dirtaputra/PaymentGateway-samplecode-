const Event = use("Event");
const Transaction = use("App/Models/Transaction");
const TransactionHistory = use("App/Models/TransactionHistory");
const BK = use("App/Common/BalanceKeeper");
const AlterraPlugin = use("App/Common/Supplier/AlterraPlugin");
const Logger = use("Logger");
const serializeError = require("serialize-error");
const twcl = use("TwilioSms");
const Env = use("Env");
const numeral = require("numeral");
const CurrencyKeeper = use("App/Common/CurrencyKeeper");

const rc_desc = {
  "00": "Success",
  "10": "Pending",
  "20": "Wrong number/ number blocked/ number expired",
  "21": "Product Issue",
  "22": "Duplicate Transaction",
  "23": "Connection Timeout",
  "24": "Provider Cut Off",
  "25": "KWH is Overlimit",
  "26": "Payment Overlimit",
  "50": "Bill Already Paid/ Not Available",
  "51": "Invalid Inquiry Amount or No inquiry",
  "98": "Order Canceled by Ops",
  "99": "General Error",
};

class AlterraWorker {
  get concurrency() {
    return 2;
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
      console.log("AlterraWorker");
      console.log(job.data);
      if (job.data.state === "INQUIRY") return await this.invokeInquiry(job);
      if (job.data.state === "TRANSACTION") return await this.invokeTransaction(job);
      if (job.data.state === "STATUS") return await this.queryStatus(job);
      if (job.data.state === "SMS") return await this.sms(job);
    } catch (e) {
      Logger.warning("AlterraWorker", serializeError(e));
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
   * HANDLER for Inquiry Request
   */
  async invokeInquiry(job) {
    const jobData = job.data;
    const trxDataObj = await fetchTrxData(jobData.trxId);
    const trxData = trxDataObj.toJSON();
    //
    if (["PLN", "PLNBILL", "BPJS"].includes(trxData.supply.supplier_product_id.type.toUpperCase())) {
      const requestData = Object.assign({
          product: trxData.supply.supplier_product_id.type,
          target: trxData.target,
        },
        trxData.supply.supplier_product_id,
      );
      // do an inquiry.
      const {
        status,
        data
      } = await AlterraPlugin.inquiry(requestData);
      // inquiry data
      if (status) {
        // success, fire transaction
        Event.fire("ALTERRA::TRANSACTION", {
          trxId: jobData.trxId,
          phone: jobData.phone,
        });
        //
        return data;
      } else {
        if (data.error) {
          // log in History as Failed
          const failedHistory = await TransactionHistory.create({
            trx_id: jobData.trxId,
            status: "FAILED",
            data: data,
          });
          // refund Balance
          await this.refundBalance(trxData.buyer_id, failedHistory.id, trxData.sell_price);
          // notify for FAILURE
          notifyDone(trxData, failedHistory);
          //
          return data;
        } else if ([20, 23, 24].includes(Number(data.response_code))) {
          // retry
          // if attempt less than scheduled, just let it FAIL
          if (job.attemptsMade + 1 < job.opts.attempts) {
            Logger.info("throw on invokeInquiry:" + jobData.trxId, data);
            throw new Error(data.response_code);
          } else {
            // log in History as Failed
            const failedHistory = await TransactionHistory.create({
              trx_id: jobData.trxId,
              status: "FAILED",
              remark: `Purchase keep failing with RC ${data.response_code}: ${rc_desc[
								data.response_code
							]}`,
              data: data,
            });
            // refund Balance
            await this.refundBalance(trxData.buyer_id, failedHistory.id, trxData.sell_price);
            // notify for FAILURE
            notifyDone(trxData, failedHistory);
          }
          //
          return data;
        } else {
          // log in History as Failed
          const failedHistory = await TransactionHistory.create({
            trx_id: jobData.trxId,
            status: "FAILED",
            remark: `Error ${data.response_code}: ${rc_desc[data.response_code]}`,
            data: data,
          });
          // refund Balance
          await this.refundBalance(trxData.buyer_id, failedHistory.id, trxData.sell_price);
          // notify for FAILURE
          notifyDone(trxData, failedHistory);
          //
          return data;
        }
      }
    } else {
      // mobile: invoke request transaction directly.
      Event.fire("ALTERRA::TRANSACTION", {
        trxId: jobData.trxId,
        phone: jobData.phone,
      });
      //
      return {
        remark: "no need to inquire, invoke the transaction method directly",
      };
    }
  }

  /**
   * HANDLER for Payment Request
   */
  async invokeTransaction(job) {
    const jobData = job.data;
    const trxDataObj = await fetchTrxData(jobData.trxId);
    const trxData = trxDataObj.toJSON();
    // define target
    let target = trxData.target;
    if (trxData.supply.supplier_product_id.type.toUpperCase() === "MOBILE") {
      // remove country code
      target = target.replace(/^(62)/gm, "0");
      // update target on transaction table
      trxDataObj.target = target;
    }
    // setup request params
    const requestData = Object.assign({
        product: trxData.supply.supplier_product_id.type,
        target: target,
        phone: jobData.phone,
        order_id: trxData.id,
      },
      trxData.supply.supplier_product_id,
    );
    // do transaction
    const {
      status,
      data
    } = await AlterraPlugin.transaction(requestData);
    // Log in History as PENDING and save supplier_trx_id.
    trxDataObj.supplier_trx_id = data.transaction_id;
    console.log(data.price);
    await AlterraPlugin.originPrice(jobData.trxId, data.price);
    await Promise.all([
      TransactionHistory.create({
        trx_id: jobData.trxId,
        status: "PENDING",
        data: data,
      }),
      trxDataObj.save(),
    ]);
    //update transaction cost
    await CurrencyKeeper.updateTransaction(jobData.trxId, data.price)
    //
    if (data.error) {
      // log in History as Failed
      let errorMsg = data.error;
      const errorCode = errorMsg.replace(/\D/g, '');
      let remark = errorCode === "450" ? "Product closed temporarily due to operator issue" : "Purchase Keep Failing";
      data.reason = data.error
      const failedHistory = await TransactionHistory.create({
        trx_id: jobData.trxId,
        status: "FAILED",
        remark: remark,
        data: data,
      });
      // refund Balance
      await this.refundBalance(trxData.buyer_id, failedHistory.id, trxData.sell_price);
      // notify for FAILURE
      notifyDone(trxData, failedHistory);
      //
      return data;
    } else {
      const dataWithRCDesc = Object.assign(data, {
        response_code_desc: rc_desc[data.response_code],
      });
      // check status
      if (status === "success") {
        // log in History as SUCCESS.
        await TransactionHistory.create({
          trx_id: jobData.trxId,
          status: "SUCCESS",
          data: dataWithRCDesc,
        });
        //update transaction cost
        await CurrencyKeeper.updateTransaction(jobData.trxId, dataWithRCDesc.price)
        // PLN -> send SMS to client
        if (
          Env.get("NODE_ENV") === "production" &&
          trxData.supply.supplier_product_id.type.toUpperCase() === "PLN"
        ) {
          const {
            token
          } = dataWithRCDesc;
          // send token thru SMS.
          Event.fire("ALTERRA::SMS", {
            trxId: jobData.trxId,
            phone: jobData.phone,
            denom: trxData.denom,
            target: trxData.target,
            token: token,
          });
        }
      } else if (status === "failed") {
        /// dibuat FAILED dan dilakukan REFUND
        const failedHistory = await TransactionHistory.create({
          trx_id: jobData.trxId,
          status: "FAILED",
          remark: dataWithRCDesc.response_code_desc,
          data: dataWithRCDesc,
        });
        // refund Balance
        await this.refundBalance(trxData.buyer_id, failedHistory.id, trxData.sell_price);
      } else {
        Logger.warning("AlterraWorker:invokeTransaction", dataWithRCDesc);
        Event.fire("ALTERRA::STATUS", {
          trxId: jobData.trxId,
          transaction_id: data.transaction_id,
          phone: jobData.phone,
        });
      }

      //
      return dataWithRCDesc;
    }
  }

  /**
   * HANDLER for query Status
   */
  async queryStatus(job) {
    const jobData = job.data;
    const trxData = (await fetchTrxData(jobData.trxId)).toJSON();
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
    //
    const {
      status,
      data
    } = await AlterraPlugin.transDetail({
      product: trxData.supply.supplier_product_id.type,
      trx_id: jobData.transaction_id,
    });
    //
    if (data.error) {
      // log in History as Failed
      const failedHistory = await TransactionHistory.create({
        trx_id: jobData.trxId,
        status: "FAILED",
        data: data,
      });
      // refund Balance
      await this.refundBalance(trxData.buyer_id, failedHistory.id, trxData.sell_price);
      // notify for FAILURE
      notifyDone(trxData, failedHistory);
      //
      return data;
    } else {
      const dataWithRCDesc = Object.assign(data, {
        response_code_desc: rc_desc[data.response_code],
      });
      /// check transaction flow
      if (status === "success") {
        // jika live_status adalah SUCCESS (ekivalen SUCCESS di RPG) --> save new history to success
        await TransactionHistory.create({
          trx_id: jobData.trxId,
          status: "SUCCESS",
          data: dataWithRCDesc,
        });
        //update transaction cost
        await CurrencyKeeper.updateTransaction(jobData.trxId, dataWithRCDesc.price)
        // PLN -> send SMS to client
        if (
          Env.get("NODE_ENV") === "production" &&
          trxData.supply.supplier_product_id.type.toUpperCase() === "PLN"
        ) {
          const {
            token
          } = dataWithRCDesc;
          // send token thru SMS.
          Event.fire("ALTERRA::SMS", {
            trxId: jobData.trxId,
            phone: jobData.phone,
            denom: trxData.denom,
            target: trxData.target,
            token: token,
          });
        }
      } else if (status === "failed") {
        Logger.warning("AlterraPlugin:queryStatus", data);
        // log in History as Failed
        dataWithRCDesc.reason = dataWithRCDesc.response_code_desc;
        const failedHistory = await TransactionHistory.create({
          trx_id: jobData.trxId,
          status: "FAILED",
          remark: dataWithRCDesc.response_code_desc,
          data: dataWithRCDesc,
        });
        // refund Balance
        await this.refundBalance(trxData.buyer_id, failedHistory.id, trxData.sell_price);
      } else {
        recentHistory.status = "PENDING";
        recentHistory.remark = job.attemptsMade;
        recentHistory.save();
        // Let it FAIL jika attempt masih dibawah limit
        if (job.attemptsMade + 1 < job.opts.attempts) {
          Logger.info("throw on queryStatus:" + jobData.trxId, data);
          throw new Error(data.status);
        } else {
          /// kalau sudah limit dibuat FAILED dan dilakukan REFUND
          dataWithRCDesc.reason = dataWithRCDesc.response_code_desc;
          const failedHistory = await TransactionHistory.create({
            trx_id: jobData.trxId,
            status: "FAILED",
            remark: dataWithRCDesc.response_code_desc,
            data: dataWithRCDesc,
          });
          // refund Balance
          await this.refundBalance(trxData.buyer_id, failedHistory.id, trxData.sell_price);
        }
      }
      //
      return dataWithRCDesc;
    }
  }

  async sms(job) {
    const jobData = job.data;
    if (jobData.phone === "000000") {
      return Logger.notice("B2B:PLN");
    } else {
      const message = await twcl.send(
        jobData.phone,
        `Terima kasih sudah menggunakan MyKedai.\nPLN IDR ${numeral(jobData.denom).format(
					"0,0.00",
				)}\nMeter: ${jobData.target}\nToken: ${jobData.token}`,
      );

      Logger.notice("Alterra:SMS", serializeError(message));

      return serializeError(message);
    }
  }
}

module.exports = AlterraWorker;

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
