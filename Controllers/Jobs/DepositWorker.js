const Event = use("Event");
const DepositLog = use("App/Models/DepositLog");
const Ledger = use("App/Models/Ledger");
const UpayPlugin = use("App/Common/Payment/UpayPlugin");
const BalanceKeeper = use("App/Common/BalanceKeeper");
const Logger = use("Logger");
const serializeError = require("serialize-error");
const Cache = use("Cache");
const User = use("App/Models/User");
const BK = use("App/Common/BalanceKeeper");
const moment = use("moment");

class DepositWorker {
  get concurrency() {
    return 1;
  }

  get onBoot() {
    return {
      duplicate: false, //
      ///
      jobData: {
        state: "USER_BALANCE"
      },
      jobConfig: {
        delay: 0,
        jobId: "onBoot",
        repeat: {
          cron: " 0 */30 * * * *"
        } // every 30 minutes
      }
    };
  }
  /**
   * Query to Payment Gateway to check status
   */
  async handler(job) {
    try {
      console.log("DepositWorker");
      console.log(job.data);
      if (job.data.state === "DEPOSIT") return await this.queryStatus(job);
      if (job.data.state === "ADD") return await this.addBalance(job);
      if (job.data.state === "ADD_PROCESSING_FEE") return await this.deductBalance(job);
      if (job.data.state === "USER_BALANCE") return await this.userBalance();
    } catch (e) {
      Logger.warning("DepositWorker", serializeError(e));
      throw e;
    }
  }

  async queryStatus(job) {
    const {
      payId,
      fee
    } = job.data;
    const recentLog = (await DepositLog.query()
      .where("payment_id", payId)
      .orderBy("created_at", "desc")
      .fetch()).first();
    //
    const recentStatus = recentLog.status;
    // if recent is not Final (PAID or FAILED)
    if (recentStatus !== "UNPAID") {
      return recentLog.toJSON();
    }
    /// check deposit status
    const {
      status,
      data
    } = await UpayPlugin.checkStatus(payId);
    /// throw error if check FAILED
    if (status !== 200) {
      throw new Error(data);
    }
    const finalStatus = ["0", "00"].includes(data.STATUS_CODE) ? "PAID" : "UNPAID";
    if (finalStatus !== "PAID") {
      recentLog.detail = job.attemptsMade;
      recentLog.data = data;
      await recentLog.save();
      throw new Error(`${payId} is UNPAID`);
    }
    //
    const savedData = {
      user_id: recentLog.user_id,
      payment_id: payId,
      amount: recentLog.amount,
      status: finalStatus,
      data: data
    };
    //
    if (recentStatus !== "PAID" && finalStatus === "PAID") {
      // insert into deposit log as paid
      const recentDeposit = await DepositLog.create(savedData);
      //
      Event.fire("DEPOSIT::ADD", {
        userId: recentLog.user_id,
        amount: recentLog.amount,
        fee: fee || 0,
        ref: recentDeposit.id,
        payId: payId
      });
      // insert processing fee into ledger if fee > 0
      if (fee > 0) {
        Event.fire("DEPOSIT::ADD_PROCESSING_FEE", {
          userId: recentLog.user_id,
          amount: fee,
          payId: payId
        });
      }
      // propagate info via Email
      Event.fire("DEPOSIT::EMAIL", {
        userId: recentLog.user_id,
        amount: recentLog.amount,
        payId
      });
      //
      return recentDeposit;
    }
    return savedData;
  }

  async addBalance(job) {
    // using worker to ensure deposit is valid
    const {
      userId,
      amount,
      fee,
      ref
    } = job.data;
    // update ledger
    await BalanceKeeper.add({
      userId,
      amount,
      trxRef: null,
      depositRef: ref
    });
    // check bonus
    const PaidCount = await DepositLog.query()
      .where({
        user_id: userId,
        status: "PAID"
      })
      .count("id");
    const selfRef = await Ledger.query().where("deposit_ref", ref).fetch();
    const tmp = selfRef.toJSON();
    if (PaidCount[0].count === "1") {
      // add a 5% bonus
      await BalanceKeeper.add({
        userId,
        amount: (amount - fee) * 0.05,
        trxRef: null,
        depositRef: null,
        remark: `5% bonus from ${amount - fee}`,
        selfReferences: tmp[0].id
      });
    }
  }

  async deductBalance(job) {
    const {
      userId,
      amount,
      payId
    } = job.data;
    await BalanceKeeper.deduct({
      userId,
      amount,
      trxRef: null,
      depositRef: null,
      remark: "processing fee " + payId
    });
  }

  async userBalance() {
    const userList = await User.query().where("type", "BUYER").fetch();
    const userData = userList.rows.map((data) => {
      return {
        id: data.id
      };
    });
    var i;
    var balance = new Array();
    for (i = 0; i < userData.length; i++) {
      balance[i] = await BK.balance(userData[i].id);
    }
    const time = new Date().toISOString();
    const tryData = userList.rows.map((data, index) => {
      return {
        id: data.id,
        amount: balance[index],
        time: moment(time).toISOString()
      };
    });
    var total = 0;
    for (var i = 0; i < balance.length; i++) {
      total += balance[i];
    }
    await Cache.putMany(tryData, 60);
    await Cache.put("active_balance", total, 720);
    return tryData;
  }
}

module.exports = DepositWorker;
