const Event = use("Event");
const PGPlugin = use("App/Common/PaymentGatewayPlugin");
const Logger = use("Logger");
const TransactionHistory = use("App/Models/TransactionHistory");
const serializeError = require("serialize-error");

class DirectPayWorker {
  get concurrency() {
    return 1;
  }

  /**
   * Query to Payment Gateway to check status
   */
  async handler(job) {
    console.log("DirectPayWorker");
    console.log(job.data);
    try {
      if (job.data.state === "STATUS") return await this.queryStatus(job);
    } catch (e) {
      Logger.warning("DirectPayWorker", serializeError(e));
      throw e;
    }
  }

  async queryStatus(job) {
    const { trxId, payId } = job.data;
    const recentTrxLog = await TransactionHistory.query()
      .where("trx_id", trxId)
      .orderBy("created_at", "desc")
      .first();
    // if recent is not Final (PAID or FAILED)
    if (recentTrxLog.status !== "UNPAID") {
      return recentTrxLog.toJSON();
    }
    /// query to PG
    const { error, data } = await PGPlugin.checkStatusByTrxId(payId);
    /// throw error if check FAILED
    if (error) {
      throw new Error(error);
    }
    if (data.STATUS_CODE === "UP") {
      recentTrxLog.remark = job.attemptsMade;
      await recentTrxLog.save();
      throw new Error(`${trxId} - ${payId} is UNPAID`);
    }
    const finalStatus = data.STATUS_CODE === "FL" ? "FAILED" : "PENDING";
    const newTrxLog = await TransactionHistory.create({
      trx_id: recentTrxLog.trx_id,
      status: finalStatus,
      remark: job.attemptsMade,
      data
    });
    ///
    if (finalStatus === "PENDING") {
      Event.fire("new::transaction", {
        trxId,
        supplier: "MKIOS"
      });
    }
    return newTrxLog;
  }
}

module.exports = DirectPayWorker;
