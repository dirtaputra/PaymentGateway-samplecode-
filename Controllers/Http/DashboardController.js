"use strict";
// const transaction = use("App/Models/Transaction");
const Transaction = use("App/Models/Transaction");
const transaction_history = use("App/Models/TransactionHistory");
const mkiosDeposit = use("App/Common/Supplier/MkiosPlugin");
const srsDeposit = use("App/Common/Supplier/SrsPlugin");
const As2in1Mobile = use("App/Common/Supplier/As2in1MobilePlugin");
const buyerDeposit = use("App/Common/BalanceKeeper");
const Alterra = use("App/Common/Supplier/AlterraPlugin");
const Tranglo = use("App/Common/Supplier/TrangloPlugin");
const MereloadBalance = use("App/Common/Supplier/MeReloadPlugin");
const moment = require("moment");
const numeral = require("numeral");
// const histories = use('App/Models/TransactionHistory')
const Database = use("Database");
const Cache = use("Cache");
const BalanceLog = use("App/Models/BalanceLog");
const Logger = use("Logger");
const serializeError = require("serialize-error");
const Map = use("App/Models/Map");
const User = use("App/Models/User");
const DepositLog = use("App/Models/DepositLog");

class DashboardController {
  constructor() {
    /// fill in Jan-Dec
    this.monthNames = [...Array(12).keys()].map((key) => moment().month(key).format("MMM"));
  }
  //index
  async index({
    view,
    auth
  }) {
    let {
      supplier_code,
      id,
      type
    } = await auth.getUser();
    const [
      activeBalance,
      buyerBalance,
      transaction_y,
      amount
    ] = await Promise.all([
      Cache.get("active_balance"),
      buyerDeposit.balance(id),
      transaction_history
      .query()
      .select(Database.raw("EXTRACT(year from created_at)::text as _years"))
      .groupBy("_years")
      .orderBy("_years", "desc")
      .fetch(),
      Cache.get("0")
    ]);
    const time = moment().toISOString();
    var a = moment(amount.time);
    var b = moment(time);
    const diff = a.diff(b, "minutes"); // 1
    const minutesString = moment.duration(diff, "minutes").humanize(true);

    const res = {
      time: minutesString,
      active_balance: numeral(activeBalance).format("0,0.00"),

      buyer_balance: numeral(buyerBalance).format("0,0.00"),
      filter_year: transaction_y.toJSON(),
    }
    return view.render("pages.index_v2", res);
  }

  async chart({
    response,
    request,
    view,
    auth
  }) {
    try {
      let {
        supplier_code,
        id,
        type
      } = await auth.getUser();
      const filterSupcode = request.input("filter") !== "ALL" ? (request.input("filter") || supplier_code) : null;
      const filterYear = request.input("filterY") || moment().format("YYYY");
      let supplierQuery = "",
        buyerQuery = "";
      let req_dstart = request.input("startD") || moment().subtract(53, "d").format("YYYY-MM-DD");
      let req_dend = request.input("endD") || moment().format("YYYY-MM-DD");
      let filterDate = {
        // start: moment(req_dstart.replace(/\//g, "-"), "YYYY-MM-DD").startOf("day").toISOString(),
        // end: moment(req_dend.replace(/\//g, "-"), "YYYY-MM-DD").endOf("day").toISOString(),
        start: req_dstart.replace(/\//g, "-"),
        end: moment(req_dend.replace(/\//g, "-")).add(1, "day").format("YYYY-MM-DD"),
      };
      let filterWeek = request.input("filterW");
      if (filterSupcode) {
        supplierQuery = `JOIN supplies s ON s.id=t.supply_id AND s.supplier_code='${filterSupcode}'`;
      }
      if (type === "BUYER") {
        buyerQuery = `JOIN users u ON u.id=t.buyer_id AND u.id='${id}'`;
      }
      // let dbRaw;
      let groupedCount;
      let resStatusNew = [];
      const statusTrx = ['SUCCESS', 'FAILED', 'QUOTE', 'PENDING', 'UNPAID'];

      if (filterYear === "daily") {
        // const query = `
        // 	SELECT count(*), tref.status, to_char(t.created_at at time zone 'Asia/Kuala_Lumpur', 'YYYY-MM-DD') AS thday FROM (
        // 		SELECT th1.*, th2.status AS refstatus
        // 		FROM transaction_histories th1
        // 		LEFT JOIN transaction_histories th2 ON th2.trx_id=th1.trx_id AND th2.created_at > th1.created_at
        // 		WHERE th2.status IS null
        // 		ORDER BY th1.created_at asc
        // 	) AS tref
        //   JOIN transactions t ON tref.trx_id=t.id
        // 	${supplierQuery}
        // 	${buyerQuery}
        // 	WHERE t.created_at at time zone 'Asia/Kuala_Lumpur' between '${filterDate.start}' and '${filterDate.end}'
        // 	group by thday, tref.status`;
        // dbRaw = await Database.raw(query);

        const dbRaw = await Database
          .from(Database.raw(`
            (
              SELECT th1.*, th2.status AS refstatus
              FROM transaction_histories th1
              LEFT JOIN transaction_histories th2 ON th2.trx_id=th1.trx_id AND th2.created_at > th1.created_at
              WHERE th2.status IS null
              ORDER BY th1.created_at asc
            ) as tref`))
          .select(Database.raw(`count(*), tref.status, to_char(t.created_at at time zone 'Asia/Kuala_Lumpur', 'YYYY-MM-DD') AS thday`))
          .joinRaw(`
            JOIN transactions t ON tref.trx_id=t.id
            ${supplierQuery}
            ${buyerQuery}
          `)
          .whereRaw(`t.created_at at time zone 'Asia/Kuala_Lumpur' between '${filterDate.start}' and '${filterDate.end}'`)
          .groupBy('thday', 'tref.status')

        // groupedCount = dbRaw.rows.reduce((agg, row) => {
        groupedCount = dbRaw.reduce((agg, row) => {
          //{ count: '20', status: 'FAILED', day: 5 }
          if (!agg[row.thday]) agg[row.thday] = {};
          agg[row.thday][row.status] = row.count;
          return agg;
        }, {});

        const statusTrx = ['SUCCESS', 'FAILED', 'QUOTE', 'PENDING', 'UNPAID']
        for (const iterator of statusTrx) {
          const newCategory = {
            name: iterator,
            data: []
          }
          for (const i of Object.keys(groupedCount)) {
            const currentGroupedVal = groupedCount[i] || {};
            (newCategory.data).push({
              x: i,
              y: currentGroupedVal[iterator] || 0
            })
          }
          resStatusNew.push(newCategory)
        }
      } else if (filterYear === "weekly") {
        // const query = `
        // 	SELECT count(*), tref.status, 'Week ' || to_char(t.created_at at time zone 'Asia/Kuala_Lumpur' + INTERVAL '1 day', 'IW') as thweek FROM (
        // 		SELECT th1.*, th2.status AS refstatus
        // 		FROM transaction_histories th1
        // 		LEFT JOIN transaction_histories th2 ON th2.trx_id=th1.trx_id AND th2.created_at > th1.created_at
        // 		WHERE th2.status IS NULL
        // 		ORDER BY th1.created_at asc
        // 	) AS tref
        // 	JOIN transactions t ON tref.trx_id=t.id
        // 	${supplierQuery}
        // 	${buyerQuery}
        // 	WHERE EXTRACT(year FROM t.created_at at time zone 'Asia/Kuala_Lumpur') = '${filterWeek}'
        // 	group by thweek, tref.status
        // `;
        // dbRaw = await Database.raw(query);

        const dbRaw = await Database
          .from(Database.raw(`
            (
              SELECT th1.*, th2.status AS refstatus
              FROM transaction_histories th1
              LEFT JOIN transaction_histories th2 ON th2.trx_id=th1.trx_id AND th2.created_at > th1.created_at
              WHERE th2.status IS NULL
              ORDER BY th1.created_at asc
            ) AS tref`))
          .select(Database.raw(`count(*), tref.status, 'Week ' || to_char(t.created_at at time zone 'Asia/Kuala_Lumpur' + INTERVAL '1 day', 'IW') as thweek`))
          .joinRaw(`
            JOIN transactions t ON tref.trx_id=t.id
            ${supplierQuery}
            ${buyerQuery}
          `)
          .whereRaw(`EXTRACT(year FROM t.created_at at time zone 'Asia/Kuala_Lumpur') = '${filterWeek}'`)
          .groupBy('thweek', 'tref.status')

        // groupedCount = dbRaw.rows.reduce((agg, row) => {
        groupedCount = dbRaw.reduce((agg, row) => {
          //{ count: '20', status: 'FAILED', thweek: 5 }
          if (!agg[row.thweek]) agg[row.thweek] = {};
          agg[row.thweek][row.status] = row.count;
          return agg;
        }, {});
        // console.log(groupedCount,'groupcount')

        for (const iterator of statusTrx) {
          const newCategory = {
            name: iterator,
            data: []
          }
          for (const i of Object.keys(groupedCount)) {
            const currentGroupedVal = groupedCount[i] || {};
            (newCategory.data).push({
              x: i,
              y: currentGroupedVal[iterator] || 0
            })
          }
          resStatusNew.push(newCategory)
        }
      } else {
        // const dbRaw = await Database.raw(`
        // 	SELECT count(*), tref.status, extract(month FROM t.created_at at time zone 'Asia/Kuala_Lumpur') AS thMonth FROM (
        // 		SELECT th1.*, th2.status AS refstatus
        // 		FROM transaction_histories th1
        // 		LEFT JOIN transaction_histories th2 ON th2.trx_id=th1.trx_id AND th2.created_at > th1.created_at
        // 		WHERE th2.status IS NULL
        // 		ORDER BY created_at DESC
        // 	) AS tref
        // 	JOIN transactions t ON tref.trx_id=t.id
        // 	${supplierQuery}
        // 	${buyerQuery}
        // 	WHERE EXTRACT(year FROM t.created_at at time zone 'Asia/Kuala_Lumpur') = '${filterYear}'
        //   group by tref.status, thMonth`);

        const dbRaw = await Database
          .from(Database.raw(`
            (
              SELECT th1.*, th2.status AS refstatus
              FROM transaction_histories th1
              LEFT JOIN transaction_histories th2 ON th2.trx_id=th1.trx_id AND th2.created_at > th1.created_at
              WHERE th2.status IS NULL
              ORDER BY created_at DESC
            ) AS tref`))
          .select(Database.raw(`count(*), tref.status, extract(month FROM t.created_at at time zone 'Asia/Kuala_Lumpur') AS thMonth`))
          .joinRaw(`
            JOIN transactions t ON tref.trx_id=t.id
            ${supplierQuery}
            ${buyerQuery}
          `)
          .whereRaw(`EXTRACT(year FROM t.created_at at time zone 'Asia/Kuala_Lumpur') = '${filterYear}'`)
          .groupBy('tref.status', Database.raw('thMonth'))

        // groupedCount = dbRaw.rows.reduce((agg, row) => {
        groupedCount = dbRaw.reduce((agg, row) => {
          //{ count: '20', status: 'FAILED', thmonth: 5 }
          const monthIdx = this.monthNames[row.thmonth - 1];
          if (!agg[monthIdx]) agg[monthIdx] = {};
          agg[monthIdx][row.status] = row.count;
          return agg;
        }, {});

        const statusTrx = ['SUCCESS', 'FAILED', 'QUOTE', 'PENDING', 'UNPAID']
        for (const iterator of statusTrx) {
          const newCategory = {
            name: iterator,
            data: []
          }
          for (const i of this.monthNames) {
            const currentGroupedVal = groupedCount[i] || {};
            (newCategory.data).push({
              x: i,
              y: currentGroupedVal[iterator] || 0
            })
          }
          resStatusNew.push(newCategory)
        }
      }
      return response.status(200).json(resStatusNew);
    } catch (e) {
      Logger.warning("Dashboard", serializeError(e));
      throw e;
    }
  }

  async totalActiveUser() {
    const start = moment().startOf("day").toISOString();
    const end = moment().toISOString();
    const start_yesterday = moment().subtract(1, "d").startOf("day").toISOString();
    const end_yesterday = moment().subtract(1, "d").toISOString();
    // console.log({
    //   start: start+' || '+moment(start).format('YYYY-MM-DD HH:mm:ss Z'),
    //   end: end+' || '+moment(end).format('YYYY-MM-DD HH:mm:ss Z'),
    //   start_yesterday: start_yesterday+' || '+moment(start_yesterday).format('YYYY-MM-DD HH:mm:ss Z'),
    //   end_yesterday: end_yesterday+' || '+moment(end_yesterday).format('YYYY-MM-DD HH:mm:ss Z'),
    // })
    const [uToday, uYesterday, cToday, cYesterday] = await Promise.all([
      Transaction
      .query()
      .distinct('buyer_id')
      .whereBetween("created_at", [start, end])
      .getCount("buyer_id"),
      Transaction
      .query()
      .distinct('buyer_id')
      .whereBetween("created_at", [start_yesterday, end_yesterday])
      .getCount("buyer_id"),
      Transaction
      .query()
      .whereHas('histories', builder => {
        builder.where('status', "SUCCESS")
      })
      .whereBetween("created_at", [start, end])
      .getSum('cost'),
      Transaction
      .query()
      .whereHas('histories', builder => {
        builder.where('status', "SUCCESS")
      })
      .whereBetween("created_at", [start_yesterday, end_yesterday])
      .getSum('cost')
    ])
    // return {
    //   uToday: uToday,
    //   uYesterday: uYesterday,
    //   cToday: cToday,
    //   cYesterday: cYesterday
    // }
    const growthUser = uToday === 0 ? 'NaN' : ((uToday - uYesterday) * 100 / uYesterday).toFixed(2);
    const growthCost = cToday === 0 ? 'NaN' : ((cToday - cYesterday) * 100 / cYesterday).toFixed(2);
    return {
      user_active: uToday + ' Users',
      total_cost: numeral(cToday).format("0,0.00") + ' MYR',
      growthUser: growthUser === 'NaN' || growthUser === '-Infinity' || growthUser === 'Infinity' ? '- ' : growthUser + ' %',
      growthCost: growthCost === 'NaN' || growthCost === '-Infinity' || growthCost === 'Infinity' ? '- ' : growthCost + ' %',
      cost: growthCost < 0 ? 'down' : 'up',
      user: growthUser < 0 ? 'down' : 'up',
    };
  }

  async dataDiferensiasi({
    request,
    response
  }) {
    const by = request.get().by;
    const opsi = request.get().opsi;
    let data;
    let vol;
    if (opsi === 'transaction') {
      vol = `count(id)`;
    } else if (opsi === 'profit') {
      vol = `sum(sell_price - "cost")`;
    } else if (opsi === 'selling_price') {
      vol = `sum(sell_price)`;
    } else if (opsi === 'avg') {
      vol = `avg(sell_price - "cost")`;
    }

    if (by === 'month') {
      const date_param = moment().subtract(1, 'month').startOf('month').toISOString();
      const obj = await Transaction
        .query()
        .select(
          Database.raw(`to_char(created_at at time zone 'Asia/Kuala_Lumpur', 'YYYY-MM') as category`),
          Database.raw(`${vol} as volume`),
          Database.raw(`to_char(created_at at time zone 'Asia/Kuala_Lumpur', 'DD') as created`)
        )
        .whereHas('histories', builder => {
          builder.where('status', 'SUCCESS')
        })
        .where('created_at', '>=', date_param)
        .groupBy('created', 'category')
        .orderBy('category')
        .fetch()
      const res = obj.toJSON();
      const thisMonth = Number(moment().daysInMonth());
      const lastMonth = Number(moment().subtract(1, 'month').daysInMonth());
      const totalDay = thisMonth >= lastMonth ? thisMonth : lastMonth;
      const arrDate = [...Array(totalDay).keys()].map((key) => String(key + 1).padStart(2, "0"));
      const arrCategory = [...new Set((res).map(item => item.category))];
      const category = arrCategory.map(el => {
        return {
          name: el,
          data: []
        }
      });

      for (const i of arrDate) {
        for (const x in category) {
          const obj = (res).find(o => o.created === i && o.category === category[x].name);
          if (obj) {
            obj.volume = opsi === 'transaction' ? obj.volume : (Number(obj.volume)).toFixed(2);
            (category[x].data).push(obj.volume)
          } else {
            (category[x].data).push(null)
          }
        }
      }
      data = {
        series: category,
        labels: arrDate
      }
    } else if (by === 'day') {
      const date_param = moment().subtract(1, 'days').startOf('day').toISOString();
      const obj = await Transaction
        .query()
        .select(
          Database.raw(`to_char(created_at at time zone 'Asia/Kuala_Lumpur', 'YYYY-MM-DD') as category`),
          Database.raw(`${vol} as volume`),
          Database.raw(`to_char(created_at at time zone 'Asia/Kuala_Lumpur', 'HH24') as created`)
        )
        .whereHas('histories', builder => {
          builder.where('status', 'SUCCESS')
        })
        .where('created_at', '>=', date_param)
        .groupBy('created', 'category')
        .orderBy('category')
        .fetch()
      const res = obj.toJSON();
      const arrHour = [...Array(24).keys()].map((key) => moment().hour(key).format("HH"));
      const arrCategory = [...new Set((res).map(item => item.category))];
      const category = arrCategory.map(el => {
        return {
          name: el,
          data: []
        }
      });

      for (const i of arrHour) {
        for (const x in category) {
          const obj = (res).find(o => o.created === i && o.category === category[x].name);
          if (obj) {
            obj.volume = opsi === 'transaction' ? obj.volume : (Number(obj.volume)).toFixed(2);
            (category[x].data).push(obj.volume)
          } else {
            (category[x].data).push(null)
          }
        }
      }
      data = {
        series: category,
        labels: arrHour
      }
    } else if (by === 'week') {
      const start_last_week = moment().utcOffset("+08:00").subtract(1, 'week').startOf('week').toISOString();
      const end_last_week = moment().utcOffset("+08:00").subtract(1, 'week').endOf('week').toISOString();
      const obj = await Transaction
        .query()
        .select(
          Database.raw(`
            case
								when created_at <= '${end_last_week}' then 'Last Week'
						else 
								'This Week'
						end as category
          `),
          Database.raw(`${vol} as volume`),
          Database.raw(`to_char(created_at at time zone 'Asia/Kuala_Lumpur', 'YYYY-MM-DD') as created`),
          Database.raw(`to_char(created_at at time zone 'Asia/Kuala_Lumpur', 'Dy') as name_day`)
        )
        .whereHas('histories', builder => {
          builder.where('status', 'SUCCESS')
        })
        .where('created_at', '>=', start_last_week)
        .groupBy('created', 'category', 'name_day')
        .orderBy('created')
        .fetch()
      const res = obj.toJSON();
      const arrWeek = [...Array(7).keys()].map((key) => moment().day(key).format("ddd"));
      const arrCategory = [...new Set((res).map(item => item.category))];
      const category = arrCategory.map(el => {
        return {
          name: el,
          data: []
        }
      });

      for (const i of arrWeek) {
        for (const x in category) {
          const obj = (res).find(o => o.name_day === i && o.category === category[x].name);
          if (obj) {
            obj.volume = opsi === 'transaction' ? obj.volume : (Number(obj.volume)).toFixed(2);
            (category[x].data).push(obj.volume)
          } else {
            (category[x].data).push(null)
          }
        }
      }
      data = {
        series: category,
        labels: arrWeek
      }
    }
    return response.json(data);
  }

  async topUser({
    request,
    response
  }) {
    const by = request.get().by || "transaction";
    let query = '';
    if (by === 'transaction') {
      query = `count(transactions.buyer_id) as total`;
    } else if (by === 'profit') {
      query = `sum(transactions.sell_price - transactions."cost") as total`;
    } else if (by === 'selling_price') {
      query = `sum(transactions.sell_price) as total`;
    } else if (by === 'avg') {
      query = `avg(transactions.sell_price - transactions."cost") as total`;
    }
    const start = moment().startOf('month').toISOString();
    const end = moment().endOf('month').toISOString();
    const data = await Transaction
      .query()
      .select('transactions.buyer_id', 'users.fullname',
        Database.raw(query)
      )
      .whereHas('histories', builder => {
        builder.where('status', 'SUCCESS')
      })
      .leftJoin('users', 'transactions.buyer_id', 'users.id')
      .whereBetween("transactions.created_at", [start, end])
      .groupBy('transactions.buyer_id', 'users.fullname')
      .orderBy('total', 'desc')
      .limit(20)
      .fetch()
    const data_json = data.toJSON();
    const arr_id = data_json.map(el => el.buyer_id);
    const map = await Map
      .query()
      .distinct('user_id')
      .whereIn('user_id', arr_id)
      .pluck('user_id')
    const res = data_json.map(el => {
      return {
        user_id: map.includes(el.buyer_id) ? el.buyer_id : null,
        fullname: el.fullname,
        total: el.total
      }
    });
    return response.json(res);
  }

  async metodeTopup() {
    const params = moment().startOf('month').toISOString();
    const res = await DepositLog
      .query()
      .select('amount', Database.raw(`
          case
            when payment_id like 'TR%' and payment_id not like 'TRSF%' then 'Transfer Balance'
            when payment_id like 'MIBFT%' then 'Transfer Bank'
            when payment_id like 'XE%' or payment_id like 'UPAY%' then 'FPX'
            when payment_id like 'MAN%' or payment_id like 'MCASH%' then 'Cash'
            when payment_id like 'JOM%' then 'Jompay'
          else 
            'Transfer Bank'
          end as metode
        `))
      .where('status', 'PAID')
      .where('created_at', '>=', params)
      .fetch()
    const obj_json = res.toJSON();
    let final_res = {
      data: [],
      labels: [],
      series: []
    };
    const data = obj_json.reduce((val, el) => {
      const idx = (val.labels).findIndex(o => o === el.metode);
      if (idx < 0) {
        (val.labels).push(el.metode);
        (val.series).push(Number(el.amount));
        (val.data).push(1)
      } else {
        val.series[idx] += Number(el.amount);
        val.data[idx] += 1;
      }
      return val;
    }, final_res);
    return data;
  }

  async burnRate({
    request,
    response,
    auth
  }) {
    const req = request.get().target;
    const req_supplier = request.get().supplier;
    let res;
    switch (req) {
      case "metodeTopup":
        const [
          userTopup,
          metodeTopup,
          info_widget,
        ] = await Promise.all([
          this.userTopup(),
          this.metodeTopup(),
          this.totalActiveUser(),
        ]);
        res = {
          userTopup: userTopup,
          metodeTopup: metodeTopup,
          info_transaction: info_widget,
        };
        break;
      case "replaceBurnRate":
        res = await this.infoBurnRate(req_supplier);
        break;
      default:
        break;
    }
    response.send(res);
  }

  async userTopup() {
    const start = moment().startOf('month').toISOString();
    const end = moment().endOf('month').toISOString();
    const [user_topup, new_user] = await Promise.all([
      User
      .query()
      .where('type', 'BUYER')
      .whereBetween('created_at', [start, end])
      .whereHas('deposits', builder => {
        builder.where('status', 'PAID')
      })
      .getCount(),
      User
      .query()
      .where('type', 'BUYER')
      .whereBetween('created_at', [start, end])
      .getCount()
    ])
    return {
      user_topup: user_topup,
      new_user: new_user
    };
  }

  async infoBurnRate(req_supplier) {
    let br_supplier, burnRate;
    if (req_supplier !== 'MKIOSTSEL') {
      const last7day = moment().subtract(7, "d").toISOString();
      br_supplier = await BalanceLog.query()
        .where("created_at", ">=", last7day)
        .where("supplier_code", req_supplier)
        .getAvg("delta");
    }
    switch (req_supplier) {
      case "MKIOS":
        const reqIdMkios = moment().format("YYMMDDHHmmssSS");
        const mkiosBalance = await mkiosDeposit.queryBalance(reqIdMkios);
        burnRate = {
          name: 'MKIOS AS2IN1',
          id: 'estMkios',
          code: req_supplier,
          burn: numeral(br_supplier).format("0,0.00") + " MYR",
          status: (br_supplier || 0) * 72 >= Number(mkiosBalance.balanceRM || 0) ?
            "fa-exclamation-circle text-danger" : "fa-check-circle text-success",
          est: (Number(mkiosBalance.balanceRM) / br_supplier / 24).toFixed(2),
          balance: numeral(mkiosBalance.balanceRM).format("0,0.00") + " MYR",
        };
        break;
      case "AS2IN1MOBILE":
        const as2in1MobileBalance = await As2in1Mobile.checkWalletBalance();
        burnRate = {
          name: 'Telin HK',
          id: 'estThk',
          code: req_supplier,
          burn: numeral(br_supplier).format("0,0.00") + " HKD",
          status: (br_supplier || 0) * 72 >= Number(as2in1MobileBalance.data.balance || 0) ?
            "fa-exclamation-circle text-danger" : "fa-check-circle text-success",
          est: (Number(as2in1MobileBalance.data.balance) / br_supplier / 24).toFixed(2),
          balance: numeral(as2in1MobileBalance.data.balance).format("0,0.00") + " HKD",
        };
        break;
      case "SRS":
        const srsBalance = await srsDeposit.checkBalance();
        burnRate = {
          name: 'SRS',
          id: 'estSrs',
          code: req_supplier,
          burn: numeral(br_supplier).format("0,0.00") + " MYR",
          status: (br_supplier || 0) * 72 >= Number(srsBalance.data.balance || 0) ?
            "fa-exclamation-circle text-danger" : "fa-check-circle text-success",
          est: (Number(srsBalance.data.balance) / br_supplier / 24).toFixed(2),
          balance: srsBalance.data.balance ? numeral(srsBalance.data.balance).format("0,0.00") + " MYR" : "Calculating",
        };
        break;
      case "ALTERRA":
        const resAlterra = await Alterra.balance();
        burnRate = {
          name: 'Alterra',
          id: 'estAlterra',
          code: req_supplier,
          burn: numeral(br_supplier).format("0,0.00") + " IDR",
          status: (br_supplier || 0) * 72 >= Number(resAlterra.data || 0) ?
            "fa-exclamation-circle text-danger" : "fa-check-circle text-success",
          est: (Number(resAlterra.data) / br_supplier / 24).toFixed(2),
          balance: numeral(resAlterra.data).format("0,0.00") + " IDR",
        };
        break;
      case "TRANGLO":
        const trangloBalance = await Tranglo.checkBalance();
        burnRate = {
          name: 'Tranglo',
          id: 'estTranglo',
          code: req_supplier,
          burn: numeral(br_supplier).format("0,0.00") + " MYR",
          status: (br_supplier || 0) * 72 >= Number(trangloBalance.LastBalance || 0) ?
            "fa-exclamation-circle text-danger" : "fa-check-circle text-success",
          est: (Number(trangloBalance.LastBalance) / br_supplier / 24).toFixed(2),
          balance: numeral(trangloBalance.LastBalance).format("0,0.00") + " MYR",
        };
        break;
      case "MERELOAD":
        const mereloadBalance = await MereloadBalance.checkBalance();
        burnRate = {
          name: 'Mereload',
          id: 'estMereload',
          code: req_supplier,
          burn: numeral(br_supplier).format("0,0.00") + " MYR",
          status: (br_supplier || 0) * 72 >= Number(mereloadBalance.balance || 0) ?
            "fa-exclamation-circle text-danger" : "fa-check-circle text-success",
          est: (Number(mereloadBalance.balance) / br_supplier / 24).toFixed(2),
          balance: numeral(mereloadBalance.balance).format("0,0.00") + " MYR",
        };
        break;
      case "MKIOSTSEL":
        const reqId = moment().format("YYMMDDHHmmssSS");
        const mkiosTselBalance = await mkiosDeposit.queryBalance(reqId);
        burnRate = {
          name: 'MKIOS TSEL',
          id: 'estMkiosTsel',
          code: req_supplier,
          burn: "-",
          status: mkiosTselBalance.balanceAll ? [
              Number(mkiosTselBalance.balanceAll[1].value),
              Number(mkiosTselBalance.balanceAll[2].value),
              Number(mkiosTselBalance.balanceAll[3].value),
              Number(mkiosTselBalance.balanceAll[4].value),
              Number(mkiosTselBalance.balanceAll[5].value),
              Number(mkiosTselBalance.balanceAll[6].value),
              Number(mkiosTselBalance.balanceAll[7].value),
              Number(mkiosTselBalance.balanceAll[8].value),
              Number(mkiosTselBalance.balanceAll[9].value),
            ].includes(0) ?
            "fa-exclamation-circle text-danger" :
            "fa-check-circle text-success" : "",
          est: "-",
          balance: mkiosTselBalance.balanceAll ?
            `${mkiosTselBalance.balanceAll[1].id}K=${numeral(mkiosTselBalance.balanceAll[1].value).format(
              "0,0",
            )} ${mkiosTselBalance.balanceAll[2].id}K=${numeral(mkiosTselBalance.balanceAll[2].value).format(
              "0,0",
            )} ${mkiosTselBalance.balanceAll[3].id}K=${numeral(mkiosTselBalance.balanceAll[3].value).format(
              "0,0",
            )} ${mkiosTselBalance.balanceAll[4].id}K=${numeral(mkiosTselBalance.balanceAll[4].value).format(
              "0,0",
            )} ${mkiosTselBalance.balanceAll[5].id}K=${numeral(mkiosTselBalance.balanceAll[5].value).format(
              "0,0",
            )} ${mkiosTselBalance.balanceAll[6].id}K=${numeral(mkiosTselBalance.balanceAll[6].value).format(
              "0,0",
            )} ${mkiosTselBalance.balanceAll[7].id}K=${numeral(mkiosTselBalance.balanceAll[7].value).format(
              "0,0",
            )} ${mkiosTselBalance.balanceAll[8].id}K=${numeral(mkiosTselBalance.balanceAll[8].value).format(
              "0,0",
            )} ${mkiosTselBalance.balanceAll[9].id}K=${numeral(mkiosTselBalance.balanceAll[9].value).format(
              "0,0",
            )}` : "-",
        };
        break;
      default:
        burnRate = {};
        break;
    }
    return burnRate;
  }
}

module.exports = DashboardController;
