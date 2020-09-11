const Logger = use("Logger");
const serializeError = require("serialize-error");
const mkiosDeposit = use("App/Common/Supplier/MkiosPlugin");
const srsDeposit = use("App/Common/Supplier/SrsPlugin");
const As2in1Mobile = use("App/Common/Supplier/As2in1MobilePlugin");
const Alterra = use("App/Common/Supplier/AlterraPlugin");
const Tranglo = use("App/Common/Supplier/TrangloPlugin");
const MereloadBalance = use("App/Common/Supplier/MeReloadPlugin");
const BalanceLog = use("App/Models/BalanceLog");
const Database = use("Database");
const moment = use("moment");
const Mail = use("Mail");
const numeral = require("numeral");
const Cache = use("Cache");
const Env = use("Env");
class DashboardWorker {
  get concurrency() {
    return 1;
  }

  get onBoot() {
    return {
      duplicate: false, //
      ///
      jobData: {
        state: "DASHBOARD_BALANCE",
      },
      jobConfig: {
        delay: 0,
        jobId: "onBoot",
        repeat: {
          cron: " 0 */1 * * * ",
        }, // every 1 hours
        // repeat: {
        //   cron: " */1 * * * * "
        // } // minutes
        // repeat: {
        //   cron: " */10 * * * * * "
        // } // 10 second
      },
    };
  }

  async handler(job) {
    try {
      if (job.data.state === "DASHBOARD_BALANCE") return await this.balance();
    } catch (e) {
      Logger.warning("DashboardWorker", serializeError(e));
      throw e;
    }
  }

  async balance() {
    try {
      const reqId = moment().format("YYMMDDHHmmssSS");
      const [srsBalance, mkiosBalance, resAlterra, trangloBalance, as2in1MobileBalance, mereloadBalance] = await Promise.all([
        srsDeposit.checkBalance(),
        mkiosDeposit.queryBalance(reqId),
        Alterra.balance(),
        Tranglo.checkBalance(),
        As2in1Mobile.checkWalletBalance(),
        MereloadBalance.checkBalance()
      ]);
      const res_final = [{
          supplier_code: "ALTERRA",
          balance: resAlterra.data,
          delta: null,
        },
        {
          supplier_code: "SRS",
          balance: srsBalance.data.balance,
          delta: null,
        },
        {
          supplier_code: "MKIOS",
          balance: mkiosBalance.balanceRM,
          delta: null,
        },
        {
          supplier_code: "TRANGLO",
          balance: trangloBalance.LastBalance,
          delta: null,
        },
        {
          supplier_code: "AS2IN1MOBILE",
          balance: as2in1MobileBalance.data.balance,
          delta: null,
        },
        {
          supplier_code: "MERELOAD",
          balance: mereloadBalance.balance,
          delta: null,
        },
      ];

      for (const key in res_final) {
        const get_bl = (await Database.table("balance_logs")
          .where("supplier_code", res_final[key].supplier_code)
          .whereRaw(
            "id = (select max(id) from balance_logs where supplier_code = '" +
            res_final[key].supplier_code +
            "')",
          ))[0];
        if (get_bl) {
          res_final[key].delta =
            Number(res_final[key].balance) > Number(get_bl.balance) || get_bl.balance === null || isNaN(Number(get_bl.balance)) || String(Number(get_bl.balance)) === 'NaN' ?
            null :
            Number(get_bl.balance) - Number(res_final[key].balance);
        }
        const bl = new BalanceLog();
        bl.supplier_code = res_final[key].supplier_code;
        bl.balance = res_final[key].balance;
        bl.delta = isNaN(res_final[key].delta) || res_final[key].delta === 'NaN' ? null : res_final[key].delta;
        await bl.save();
      }
      this.check_balance();
      return res_final;
    } catch (e) {
      Logger.warning("DashboardWorker", serializeError(e));
      throw e;
    }
  }

  async check_balance() {
    try {
      const last7day = moment().subtract(7, "d").toISOString();
      const [brSRS, brMKIOS, brAlterra, brTranglo, brAs2in1Mobile, brMereload] = await Promise.all([
        BalanceLog.query().where("created_at", ">=", last7day).where("supplier_code", "SRS").getAvg("delta"),
        BalanceLog.query().where("created_at", ">=", last7day).where("supplier_code", "MKIOS").getAvg("delta"),
        BalanceLog.query()
        .where("created_at", ">=", last7day)
        .where("supplier_code", "ALTERRA")
        .getAvg("delta"),
        BalanceLog.query()
        .where("created_at", ">=", last7day)
        .where("supplier_code", "TRANGLO")
        .getAvg("delta"),
        BalanceLog.query()
        .where("created_at", ">=", last7day)
        .where("supplier_code", "AS2IN1MOBILE")
        .getAvg("delta"),
        BalanceLog.query()
        .where("created_at", ">=", last7day)
        .where("supplier_code", "MERELOAD")
        .getAvg("delta"),
      ]);

      const reqId = moment().format("YYMMDDHHmmssSS");
      const [srsBalance, mkiosBalance, resAlterra, trangloBalance, as2in1MobileBalance, mereloadBalance] = await Promise.all([
        srsDeposit.checkBalance(),
        mkiosDeposit.queryBalance(reqId),
        Alterra.balance(),
        Tranglo.checkBalance(),
        As2in1Mobile.checkWalletBalance(),
        MereloadBalance.checkBalance(),
      ]);

      const burnRate = {
        srs: {
          burn: numeral(brSRS).format("0,0.00") + " MYR",
          est: (Number(srsBalance.data.balance) / brSRS / 24).toFixed(2),
          balance: numeral(srsBalance.data.balance).format("0,0.00") + " MYR",
          datetime: moment().utcOffset("+08:00").format("DD-MMM-YYYY HH:mm:ss Z"),
        },
        mkios: {
          burn: numeral(brMKIOS).format("0,0.00") + " MYR",
          est: (Number(mkiosBalance.balanceRM) / brMKIOS / 24).toFixed(2),
          balance: numeral(mkiosBalance.balanceRM).format("0,0.00") + " MYR",
          datetime: moment().utcOffset("+08:00").format("DD-MMM-YYYY HH:mm:ss Z"),
        },
        alterra: {
          burn: numeral(brAlterra).format("0,0.00") + " IDR",
          est: (Number(resAlterra.data) / brAlterra / 24).toFixed(2),
          balance: numeral(resAlterra.data).format("0,0.00") + " IDR",
          datetime: moment().utcOffset("+08:00").format("DD-MMM-YYYY HH:mm:ss Z"),
        },
        tranglo: {
          burn: numeral(brTranglo).format("0,0.00") + " MYR",
          est: (Number(trangloBalance.LastBalance) / brTranglo / 24).toFixed(2),
          balance: numeral(trangloBalance.LastBalance).format("0,0.00") + " MYR",
          datetime: moment().utcOffset("+08:00").format("DD-MMM-YYYY HH:mm:ss Z"),
        },
        as2in1mobile: {
          burn: numeral(brAs2in1Mobile).format("0,0.00") + " HKD",
          est: (Number(as2in1MobileBalance.data.balance) / brAs2in1Mobile / 24).toFixed(2),
          balance: numeral(as2in1MobileBalance.data.balance).format("0,0.00") + " HKD",
          datetime: moment().utcOffset("+08:00").format("DD-MMM-YYYY HH:mm:ss Z"),
        },
        mereload: {
          burn: numeral(brMereload).format("0,0.00") + " MYR",
          est: (Number(mereloadBalance.balance) / brMereload / 24).toFixed(2),
          balance: numeral(mereloadBalance.balance).format("0,0.00") + " MYR",
          datetime: moment().utcOffset("+08:00").format("DD-MMM-YYYY HH:mm:ss Z"),
        },
      };

      for (const key in burnRate) {
        if (burnRate[key].est > 3) {
          delete burnRate[key];
        }
      }

      if (Object.keys(burnRate).length > 0) {
        const date_now = moment().format("YYYY-MM-DD");
        const check = await Cache.has("balance_alert-" + date_now);
        const mail1 = Env.get("MAIL_ALERT1");
        if (!check) {
          // console.log('kirim email alert '+date_now)
          await Mail.send("emails.dashboard", {
            burnRate: burnRate
          }, (message) => {
            message.subject(`Alert Balance - ${date_now}`);
            message.from("rpg.telinmy@yandex.com", "RPG Platform - TelinMY");
            message.to(mail1);
          });
          await Cache.put("balance_alert-" + date_now, mail1, 1440); //24jam
        }
        // boleh dicoment
        // else{
        //   console.log('sudah ada');
        //   await Cache.forget("balance_alert-"+date_now)
        // }
      }
    } catch (e) {
      Logger.warning("DashboardWorker", serializeError(e));
      throw e;
    }
  }
}

module.exports = DashboardWorker;
