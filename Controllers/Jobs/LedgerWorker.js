const User = use("App/Models/User");
const BalanceKeeper = use("App/Common/BalanceKeeper");
const Logger = use("Logger");
const serializeError = require("serialize-error");
const moment = require("moment");
const bbPromise = require("bluebird");
const Cache = use("Cache");

class LedgerWorker {
  get concurrency() {
    return 1;
  }

  get onBoot() {
    return {
      duplicate: false, //
      ///
      jobData: {},
      jobConfig: {
        jobId: "onBoot",
        repeat: {
          cron: " 0 */3 * * * "
        } // every 3 hours
        //repeat: { cron: " */1 * * * * " } // every 1 minute
      }
    };
  }

  async handler(job) {
    try {
      console.log("LedgerWorker");
      return await this.calculateBalance(job);
    } catch (e) {
      Logger.warning("LedgerWorker", serializeError(e));
      throw e;
    }
  }

  async calculateBalance(job) {
    //
    const userList = await User.query()
      .where("type", "BUYER")
      .fetch();
    const prev2Days = moment()
      .subtract(1, "days")
      .format("YYYY-MM-DD");

    const closingRate = bbPromise.map(
      userList.rows,
      user => {
        return BalanceKeeper.dailyClosingBalance(user.id, prev2Days);
      }, {
        concurrency: 2
      }
    );

    return closingRate;
  }

  async userBalance(job) {
    const userList = await User.query()
      .where("type", "BUYER")
      .fetch();
    const userData = bbPromise.map(
      userList.rows,
      user => {
        id = user.id
        balance = BalanceKeeper.balance(user.id);
      }, {

      }
    );
    await Cache.putMany(userData, 30)
    return userData;
  }
}

module.exports = LedgerWorker;
