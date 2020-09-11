const Ledger = use("App/Models/Ledger");
const LedgerBalance = use("App/Models/LedgerBalance");
const Database = use("Database");
const DepositM = use("App/Models/DepositLogHook");
const moment = require("moment");

class BalanceKeeper {
  async deduct({
    userId,
    amount,
    trxRef,
    depositRef,
    remark
  }) {
    // DEBIT
    await Ledger.create({
      user_id: userId,
      debit: amount,
      deposit_ref: depositRef ? depositRef : null,
      transaction_ref: trxRef ? trxRef : null,
      remark: remark ? remark : null
    });
  }

  async add({
    userId,
    amount,
    trxRef,
    depositRef,
    remark,
    selfReferences
  }) {
    // CREDIT
    await Ledger.create({
      user_id: userId,
      credit: amount,
      deposit_ref: depositRef ? depositRef : null,
      transaction_ref: trxRef ? trxRef : null,
      remark: remark ? remark : null,
      self_references: selfReferences
    });
  }

  async balance(userId) {
    // get balance
    const currentLBObj = await LedgerBalance.query()
      .where("user_id", userId)
      .with("ledger")
      .orderBy("created_at", "desc")
      .first();
    const curLB = currentLBObj ?
      currentLBObj.toJSON() : {
        balance: 0,
        ledger: {
          created_at: "1970-01-01T00:00:01.000Z"
        }
      };

    const earlierLimit =
      curLB.ledger && curLB.ledger.created_at ?
      curLB.ledger.created_at :
      "1970-01-01T00:00:01.000Z";
    //console.log(curLB);
    const sumCD = await Ledger.query()
      .where("user_id", userId)
      .where(
        "created_at",
        ">",
        moment(earlierLimit)
        .endOf("seconds")
        .toISOString()
      )
      .sum("debit as db")
      .sum("credit as cr")
      .first();
    //console.log(sumCD);
    const finalBalance = Number(curLB.balance) + Number(sumCD.cr) - Number(sumCD.db);
    console.log(finalBalance);
    return finalBalance;
  }

  async activeYesterdayBalance() {
    const yesterday = moment()
      .subtract(1, "day")
      .format("YYYY-MM-DD");
    const curLBObj = await LedgerBalance.query()
      .sum("balance as lb")
      .whereRaw(`DATE(created_at at time zone 'Asia/Kuala_Lumpur') = '${yesterday}'`)
      .groupByRaw("DATE(created_at at time zone 'Asia/Kuala_Lumpur')");
    // .debug(true);
    //console.log(curLBObj);
    return curLBObj[0] ? curLBObj[0].lb : 0;

    /**
     * DEBUGGING
     */
    //     const queryRaw = await Database.raw(`SELECT *, DATE(created_at at time zone 'Asia/Kuala_Lumpur') as date8
    // FROM public.ledger_balances where DATE(created_at at time zone 'Asia/Kuala_Lumpur') = '2019-05-31'
    // order by created_at desc limit 1`);
    //     const queryRaw2 = await Database.raw(`SELECT *, DATE(created_at at time zone 'Asia/Kuala_Lumpur') as date8
    // FROM public.ledger_balances where DATE(created_at at time zone 'Asia/Kuala_Lumpur') = '2019-05-31'
    // order by created_at asc limit 1`);
    //     console.log([queryRaw.rows, queryRaw2.rows]);
  }

  async deposit_statement(userId) {
    ///
    let last20moves = await Ledger.query()
      .where("user_id", userId)
      .whereNull("transaction_ref")
      .with("deposit")
      .orderBy("ledgers.created_at", "desc")
      .limit(20)
      .fetch();
    ///
    last20moves = last20moves.toJSON();
    // console.log(last20moves);
    const statementFormat = last20moves.reduce((acc, data) => {
      const paymentId = data.deposit && data.deposit.payment_id ? data.deposit.payment_id : null;
      acc.unshift({
        amount: data.credit > 0 ? data.credit : -1 * data.debit,
        reference: paymentId || data.remark,
        timestamp: moment(data.created_at).format("YYYY-MM-DD HH:mm:ss")
      });
      return acc;
    }, []);
    return statementFormat;
  }

  async statement(userId) {
    ///
    let [last20moves, balance] = await Promise.all([
      Ledger.query()
      .where("user_id", userId)
      .with("deposit")
      .with("transactionHistory")
      .orderBy("ledgers.created_at", "desc")
      .limit(20)
      .fetch(),
      this.balance(userId)
    ]);
    ///
    last20moves = last20moves.toJSON();
    last20moves[0].balance = balance;
    //console.log(last20moves);
    const statementFormat = last20moves.reduce((acc, data, idx) => {
      //
      const paymentId = data.deposit && data.deposit.payment_id ? data.deposit.payment_id : null;
      const transactionId =
        data.transactionHistory && data.transactionHistory.trx_id ?
        data.transactionHistory.trx_id :
        null;
      const validBalance =
        idx > 0 ?
        Number(acc[0].balance) + Number(acc[0].debit) - Number(acc[0].credit) :
        Number(data.balance);
      acc.unshift({
        balance: validBalance,
        debit: data.debit,
        credit: data.credit,
        price: data.sell_price,
        reference: paymentId || transactionId,
        timestamp: moment(data.created_at).toISOString()
      });
      return acc;
    }, []);
    return statementFormat;
  }

  async dailyClosingBalance(userId, refDate) {
    // latest balance in LedgerBalance
    const currentLBObj = await LedgerBalance.query()
      .where("user_id", userId)
      .with("ledger")
      .orderBy("created_at", "desc")
      .first();

    // fallback to 0 and init TS if not found
    const curLB = currentLBObj ?
      currentLBObj.toJSON() : {
        balance: 0,
        ledger: {
          created_at: "1970-01-01T00:00:01.000Z"
        },
        created_at: "1970-01-01T00:00:01.000Z"
      };
    // console.log(curLB);
    const earlierLimit =
      curLB.ledger && curLB.ledger.created_at ?
      curLB.ledger.created_at :
      "1970-01-01T00:00:01.000Z";

    // bypass if recent entry in LB already today
    if (moment(curLB.created_at).diff(moment(), "days") === 0) {
      // entry is already exist since difference between refDate and beginDate is less than 24hours
      return {
        status: "Bypassed",
        end: refDate,
        begin: earlierLimit
      };
    }
    /// if not yet created
    // const lockEndOfDay = moment(refDate, "YYYY-MM-DD").endOf("day");
    // const beginDate = moment(earlierLimit, "YYYY-MM-DD HH:mm:ss").endOf("seconds");
    const lockEndOfDay = moment(refDate, "YYYY-MM-DD").endOf("day");
    const beginDate = moment(earlierLimit).endOf("seconds");

    // console.dir([earlierLimit, refDate, userId]);
    // obtain balance to the expected date
    const [{
      cr,
      db
    }, latestEntry] = await Promise.all([
      Ledger.query()
      .where("user_id", userId)
      .where("created_at", ">", beginDate.toISOString())
      .where("created_at", "<=", lockEndOfDay.toISOString())
      .sum("debit as db")
      .sum("credit as cr")
      .first(),
      Ledger.query()
      .where("user_id", userId)
      .where("created_at", "<=", lockEndOfDay.toISOString())
      .orderBy("created_at", "desc")
      .first()
    ]);

    // console.dir([cr, db, latestEntry]);
    // insert new row in Ledger Balance
    const newBalance = Number(curLB.balance) + (Number(cr || 0) - Number(db || 0));
    const newEntryData = await LedgerBalance.create({
      user_id: userId,
      upto: latestEntry ? latestEntry.id : null,
      balance: newBalance
    });

    return {
      status: "Processed",
      end: refDate,
      begin: earlierLimit,
      balance: newBalance,
      data: newEntryData
    };
  }

  async transfer(fromAcc, toAcc, amount, is_sf) {
    const sharedId = `TB${moment()
      .valueOf()
      .toString(32)
      .toUpperCase()}`;
    /// create transaction object
    const trxDb = await Database.beginTransaction();
    const paidCount = (await DepositM.query()
      .where("user_id", toAcc)
      .where("status", "PAID")
      .count("* as total"))[0].total;

    const deposit = await DepositM.create({
      user_id: toAcc,
      payment_id: `TR` + new Date().valueOf(),
      amount: amount,
      status: "PAID",
      detail: `${sharedId} Transfer Balance`,
    })

    /// deduct from sender (debit)
    const debit = await Ledger.create({
      user_id: fromAcc,
      debit: amount,
      deposit_ref: null,
      transaction_ref: null,
      remark: `${sharedId} Transfer Balance`
    });

    /// add to receiver (credit)
    const credit = await Ledger.create({
      user_id: toAcc,
      credit: amount,
      deposit_ref: deposit.id,
      transaction_ref: null,
      remark: `${sharedId} Transfer Balance`
    });
    if (Number(paidCount) === 0 && is_sf === true) {
      const bonus = parseFloat((amount * 5) / 100);
      await Ledger.create({
        user_id: toAcc,
        credit: bonus,
        deposit_ref: null,
        transaction_ref: null,
        remark: `5% bonus from ${amount}`,
        self_references: credit.id
      })
    }
    trxDb.commit();
  }
}

module.exports = new BalanceKeeper();
