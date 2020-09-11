const Logger = use("Logger");
const serializeError = require("serialize-error");
const Database = use("Database");
const moment = use("moment");
const Mail = use("Mail");
const numeral = require("numeral");
const Env = use("Env");
const BalanceKeeper = use("App/Common/BalanceKeeper");
const testing = use("App/Common/DepositAttr");
const User = use("App/Models/User");
const Transction = use("App/Models/Transaction");
const Override = use("App/Models/OverrideDeposit");
class B2BNotifWorker {
  get concurrency() {
    return 1;
  }

  get onBoot() {
    return {
      duplicate: false,
      jobData: {
        state: "B2BNOTIF_BALANCE",
      },
      jobConfig: {
        delay: 0,
        jobId: "onBoot",
        repeat: {
          cron: " 0 8 * * * ",
        }, // every At 08:00 AM
      },
    };
  }

  async handler(job) {
    try {
      if (job.data.state === "B2BNOTIF_BALANCE") return await this.notif_balance();
    } catch (e) {
      Logger.warning("B2BNotifWorker", serializeError(e));
      throw e;
    }
  }

  async notif_balance() {
    try {
    // const {rows} = await Database.raw(`
    //   select lb.user_id, u.is_partner, u.email, u.fullname, lb.balance, tmp.credit, tmp.debit, (lb.balance+tmp.credit-tmp.debit) as final_balance, tmp_avg.avg_trx_last_4_days
    //   from ledger_balances as lb
    //   right join 
    //     (
    //       select sum(credit) as credit, sum(debit) as debit, l.user_id, lb.created_at from ledgers as l
    //       join (
    //         select max(created_at) as created_at, user_id 
    //         from ledger_balances 
    //         group by user_id
    //       ) as lb on l.user_id=lb.user_id and l.created_at > lb.created_at
    //       group by l.user_id, lb.created_at
    //     ) as tmp 
    //     on lb.user_id=tmp.user_id and lb.created_at=tmp.created_at
    //   left join users as u on tmp.user_id=u.id
    //   left join (
    //     select avg(ave.sum_cost) as avg_trx_last_4_days, ave.buyer_id from
    //       (select t.buyer_id, sum(t."cost") as sum_cost, to_char(t.created_at at time zone 'Asia/Kuala_Lumpur', 'YYYY-MM-DD') AS group_day 
    //       from transactions as t
    //       join (
    //         select th1.status, th1.trx_id from transaction_histories as th1
    //         join (select max(created_at) as created_at, trx_id from transaction_histories
    //         group by trx_id) as tmp on th1.trx_id=tmp.trx_id and th1.created_at=tmp.created_at
    //         where th1.status = 'SUCCESS'
    //       ) as th
    //       on t.id=th.trx_id
    //       where to_char(t.created_at at time zone 'Asia/Kuala_Lumpur', 'YYYY-MM-DD') >= '${moment().utcOffset("+08:00").subtract(4, "d").startOf("d").toISOString()}'
    //       group by group_day, t.buyer_id) as ave
    //     group by buyer_id) as tmp_avg 
    //     on tmp_avg.buyer_id = lb.user_id
    //   where u.is_partner!='' and u.is_partner != '0'
    //   and (lb.balance+tmp.credit-tmp.debit) < 250
    //   `);
    //   for (const key in rows) {
    //     rows[key].depletion = rows[key].avg_trx_last_4_days === null ? '-' : Math.floor(Number(rows[key].final_balance) / Number(rows[key].avg_trx_last_4_days)).toString()+" days";
    //     rows[key].final_balance = numeral(rows[key].final_balance).format("0,0.00") + " MYR";
    //     console.log(rows[key])
        
    //     const subject = `Alert-${moment().format('DDMMYYYY')} Low deposit notification for ${rows[key].fullname}`;
    //     console.log("Send B2B Balance Mail: ",subject);
    //     const envMode = Env.get("NODE_ENV");
    //     const stage1_1 = Env.get("STAGE1_1");
    //     const stage1_2 = Env.get("STAGE1_2");
    //     if (envMode !== "sandbox" || envMode !== "development") {
    //       await Mail.send('emails.B2BNotifBalance', rows[key], (message) => {
    //         message.subject(subject);
    //         message.from("rpg.telinmy@yandex.com", "RPG Platform - TelinMY");
    //         message.to(rows[key].email);
    //         message.to(stage1_1);
    //         message.to(stage1_2);
    //       });
    //     }
    //   }
    
      let stage1_1 = "dennysetiawisnugraha@yandex.com";
      let stage1_2 = "dennysetiawisnugraha@yandex.com";
      const envMode = Env.get("NODE_ENV");
      if (envMode === "production") {
        stage1_1 = Env.get("STAGE1_1");
        stage1_2 = Env.get("STAGE1_2");
      }
      let tgl = moment().subtract(3, "d").startOf("day");
      const obj = await Transction
        .query()
        .select("buyer_id",
          Database.raw(`sum("cost") as sum_cost`),
          Database.raw(`to_char(created_at, 'YYYY-MM-DD') as group_day`)
        )
        .with('user')
        .whereHas('histories', (builder) => {
          builder.where('status', "SUCCESS")
        })
        .whereHas('user', (builder) => {
          builder.where('is_partner', "!=" ,"")
            .where('is_partner', "!=", "0")
        })
        .where("created_at", ">=", tgl)
        .groupBy("group_day","buyer_id")
        .fetch()
      let data = obj.toJSON();
      let groupUser = data.reduce((val, el, idx) => {
        const i_obj = val.findIndex(x => x.buyer_id === el.buyer_id);
        if (i_obj < 0) {
          let res = {
            buyer_id: el.buyer_id,
            sum_cost: Number(el.sum_cost),
            count_row: 1,
            fullname: el.user.fullname,
            email: el.user.email
          }
          if (envMode !== "production") res.email = "dennysetiawisnugraha@yandex.com";
          val.push(res);
        } else {
          val[i_obj].sum_cost += Number(el.sum_cost);
          val[i_obj].count_row += 1;
        }
        return val;
      }, []);
      for (const key in groupUser) {
        let balance_user = await BalanceKeeper.balance(groupUser[key].buyer_id);
        groupUser[key].avg_trx_last_4_days = groupUser[key].sum_cost / groupUser[key].count_row;
        groupUser[key].depletion = groupUser[key].avg_trx_last_4_days === null ? '-' : (Number(balance_user) / Number(groupUser[key].avg_trx_last_4_days)).toFixed(2).toString()+" days";
        groupUser[key].final_balance = numeral(balance_user).format("0,0.00") + " MYR";
        if (Number(balance_user) <= 250) {
          const subject = `Alert-${moment().format('DDMMYYYY')} Low deposit notification for ${groupUser[key].fullname}`;
          console.log("Send B2B Balance Mail: ",subject);
          await Mail.send('emails.B2BNotifBalance', groupUser[key], (message) => {
            message.subject(subject);
            message.from("rpg.telinmy@yandex.com", "RPG Platform - TelinMY");
            message.to(groupUser[key].email);
            message.to(stage1_1);
            message.to(stage1_2);
          });
        }
      }
      this.auto_aproval();
      return groupUser;
    } catch (e) {
      Logger.warning("B2BNotifWorker", serializeError(e));
      throw e;
    }
  }
  
  async auto_aproval(){
    const envMode = Env.get("NODE_ENV");
    let stage2_1;
    let stage2_2;
    let stage2_3;
    const email_test = "dennysetiawisnugraha@yandex.com";
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

    try {
      const arr_email = ['info@telin.hk', 'hello@telin.tw'];
      const obj = await User
          .query()
          .where('is_partner', '!=', "")
          .where('is_partner', '!=', "0")
          .whereIn('email', arr_email)
          .pluck('id');
      for (const user_id of obj) {
        let inputData = {
          user_id: user_id,
          remark: 'Topup Postpaid',
          amount: 2500,
          validator: '{"val1":"final","val2":""}',
          validate_by: '{"val1":"","val2":""}',
          status: 0,
          type: 'deposit_transfer'
        }
        const [balance, check_data] = await Promise.all([
          BalanceKeeper.balance(user_id),
          Override
            .query()
            .where(inputData)
            .getCount()
        ])
        if (balance < 500) {
          if (check_data < 1) await testing.reqOverride(inputData);
          const userData = await User.find(user_id);
          console.log(inputData)
          await Mail.send(
            "emails.ceo", {
              email: userData.email,
              amount: 2500,
              datetime: moment()
                .utcOffset("+08:00")
                .format("DD-MMM-YYYY HH:mm:ss ZZ"),
              remark: 'Topup Postpaid'
            },
            message => {
              message.subject(`APPROVAL:${moment().utcOffset("+08:00").format("DDMMYYYY")} Please Approve Manual Deposit Transaction`);
              message.from("rpg.telinmy@yandex.com", "RPG Platform - TelinMY");
              message.to(stage2_1);
              message.to(stage2_2);
              message.to(stage2_3);
            }
          );
        }
      }
    } catch (error) {
      console.log('B2BAutoAproval:', error)
      throw error;
    }
  }
}

module.exports = B2BNotifWorker;
