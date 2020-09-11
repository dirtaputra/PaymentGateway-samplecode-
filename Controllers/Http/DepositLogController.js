"use strict";
const Database = use("Database");
const DepositLog = use("App/Models/DepositLog");
const User = use("App/Models/User");
const moment = require("moment");
const Env = use("Env");
const numeral = require("numeral");

class DepositLogController {
  async filter_name({
    request,
    response
  }) {
    const param = request.input("q");
    const res = await User.query()
      .select("id", "fullname as text")
      .whereRaw(`fullname ILIKE '%${param}%'`)
      .fetch();
    return response.json({
      items: res.toJSON()
    });
  }

  async index({
    request,
    response,
    view,
    auth
  }) {
    try {
      let {
        startdate,
        enddate
      } = request.all();
      // const start = startdate ? moment(startdate).startOf('day').format('YYYY-MM-DD HH:mm:ss') : moment().startOf('month').format('YYYY-MM-DD HH:mm:ss');
      // const end = enddate ? moment(enddate).endOf('day').format('YYYY-MM-DD HH:mm:ss') : moment().endOf('month').format('YYYY-MM-DD HH:mm:ss');

      const start = startdate ?
        moment(startdate, "YYYY-MM-DD")
        .startOf("day")
        .toISOString() :
        moment()
        .startOf("month")
        .toISOString();
      const end = enddate ?
        moment(enddate, "YYYY-MM-DD")
        .endOf("day")
        .toISOString() :
        moment()
        .endOf("month")
        .toISOString();

      if (request.ajax()) {
        const draw = request.input("draw");
        const start_dt = request.input("start");
        const length_dt = request.input("length");
        const field_order = request.input(
          "columns[" + request.input("order[0][column]") + "][data]"
        );
        const type_order = request.input("order[0][dir]");
        const search = request.input("search[value]");
        const table_model = "deposit_logs as d";

        // select d.created_at, d.payment_id, u.fullname, (d.amount - coalesce((select l.debit from ledgers as l where split_part(l.remark, ' ', 3) = d.payment_id),0)) as amount, d.status,
        // coalesce((select l.debit from ledgers as l where split_part(l.remark, ' ', 3) = d.payment_id),0) as processing_fee
        // from deposit_logs as d
        // left join ledgers as l on d.id=l.deposit_ref
        // left join users as u on d.user_id=u.id

        const req_user = request.input("filter_user");
        const req_status = request.input("filter_status");
        let init = Database.table(table_model)
          .select("d.created_at", "d.payment_id", "u.fullname", "d.status", "d.amount",
            Database.raw(`(d.amount - coalesce((select l.debit from ledgers as l where l.remark like 'processing fee%' and split_part(l.remark, ' ', 3) = d.payment_id),0)) as deposit_amount`),
            Database.raw(`coalesce((select l.debit from ledgers as l where l.remark like 'processing fee%' and split_part(l.remark, ' ', 3) = d.payment_id),0) as processing_fee`),
            Database.raw(`(SUBSTRING(d.payment_id,1,4)) as prefix_id`),
          )
          .leftJoin("users as u", "d.user_id", "u.id")
          .leftJoin("ledgers as l", "d.id", "l.deposit_ref")
          .whereBetween("d.created_at", [start, end])
          .whereRaw(
            `(d.payment_id ILIKE '%${search}%')`
          )
          .orderBy(field_order, type_order);
        init = req_user ? init.where("d.user_id", req_user) : init;
        init = req_status ? init.where("d.status", req_status) : init;

        let initial_db;
        let records_total;
        let records_filtered;
        const init_total_record = DepositLog.query()
          .select("d.created_at")
          .from("deposit_logs as d")
          .whereBetween("d.created_at", [start, end])
          .clone();
        if (auth.user.type === "STAFF") {
          let init_count = Database.table(table_model).whereBetween("d.created_at", [start, end]);
          init_count = req_user ? init_count.where("d.user_id", req_user) : init_count;
          init_count = req_status ? init_count.where("d.status", req_status) : init_count;
          records_total = await init_count.getCount();
          records_filtered = search ? await init.getCount() : records_total;

          initial_db = await init.offset(start_dt).limit(length_dt);
        } else if (auth.user.type === "BUYER") {
          records_total = await init_total_record.where("d.user_id", auth.user.id).getCount();
          records_filtered = search ? await init.getCount() : records_total;
          initial_db = await init.offset(start_dt).limit(length_dt).whereRaw(`d.user_id = '${auth.user.id}'`);
        }

        const data_res = {
          draw: draw,
          recordsTotal: records_total,
          recordsFiltered: records_filtered,
          data: initial_db
        };
        return response.status(200).json(data_res);
      }

      // select status from deposit_logs group by status
      const list_status = await DepositLog.query().select('status').groupBy('status').fetch();
      return view.render("pages.depositLog", {
        list_status: list_status.toJSON()
      });
    } catch (error) {
      return response.json({
        error: error
      });
    }
  }

  async sumAmount({
    request,
    response,
    auth
  }) {
    try {
      const {
        startdate,
        enddate
      } = request.all();
      const start = startdate ?
        moment(startdate, "YYYY-MM-DD")
        .startOf("day")
        .toISOString() :
        moment()
        .startOf("month")
        .toISOString();
      const end = enddate ?
        moment(enddate, "YYYY-MM-DD")
        .endOf("day")
        .toISOString() :
        moment()
        .endOf("month")
        .toISOString();

      const req_user = request.input("filter_user");
      const req_status = request.input("filter_status");
      const auth_user = auth.user.type === "BUYER" ? `and user_id = '${auth.user.id}'`:'';

      let init = Database.table("deposit_logs as d")
        .select(
          Database.raw(`sum(d.amount - coalesce((select l.debit from ledgers as l where l.remark like 'processing fee%' and split_part(l.remark, ' ', 3) = d.payment_id),0)) as sum_amount`),
        )
        .whereBetween("d.created_at", [start, end])
        .whereRaw(`d.payment_id not like 'TRSF%' ${auth_user}`);

      init = req_user ? init.where("d.user_id", req_user) : init;
      init = req_status ? init.where("d.status", req_status) : init;

      const sum_amount = await init;
      return response.json({
        total: numeral(Number(sum_amount[0].sum_amount)).format("0,0.00")
      });
    } catch (error) {
      return response.json(error);
    }
  }

  async showRange({
    view,
    auth,
    request,
    response
  }) {
    if (auth.user.type === "STAFF") {
      const start = request.all().startdate;
      const end = request.all().enddate;
      const deposit = await DepositLog.query()
        .with("user")
        .whereBetween("deposit_logs.created_at", [start, end])
        .fetch();
      // console.log(deposit.toJSON())
      return view.render("pages.depositLogs", {
        data: deposit.toJSON(),
        start: start,
        end: end
      });
    } else if (auth.user.type === "BUYER") {
      const start = request.all().startdate;
      const end = request.all().enddate;
      const deposit = await DepositLog.query()
        .with("user")
        .whereHas("user", builder => {
          builder.where("id", auth.user.id);
        })
        .whereBetween("deposit_logs.created_at", [start, end])
        .fetch();
      // console.log(deposit.toJSON())
      return view.render("pages.depositLogs", {
        data: deposit.toJSON(),
        start: start,
        end: end
      });
    }
  }
  async data({
    response,
    view,
    auth,
    request
  }) {
    if (auth.user.type === "STAFF") {
      // let pagination = request.only(["page", "limit"]);
      // const page = parseInt(pagination.page, 10) || 1;
      // const limit = parseInt(pagination.limit, 10) || 10;
      // const DepositLogs = await Database.select("*")
      //   .from("deposit_logs")
      //   .leftJoin("users", "deposit_logs.user_id", "users.id")
      //   .paginate(page, limit)
      // return response.json(DepositLogs)
      let pagination = request.only(["page", "limit"]);
      const page = parseInt(pagination.page, 10) || 1;
      const limit = parseInt(pagination.limit, 10) || 10;
      const asd = await DepositLog.query().paginate(page, limit);
      return response.json(asd);
      // const deposit = await Database
      //   .select('*')
      //   .select('payment_id',
      //     'amount',
      //     'status',
      //     'created_at',
      //     'row_number() over(partition by payment_id order by created_at desc) as rn')
      //   .from('deposit_logs')
      //   .where('rn', 1)
      // console.log(deposit);
      // return view.render('pages.purchaseLog', {
      //   data: transaction
      // })
    } else if (auth.user.type === "BUYER") {
      const DepositLogs = await Database.select("*")
        .from("deposit_logs")
        .leftJoin("users", "deposit_logs.user_id", "users.id")
        .where("users.type", "BUYER")
        .where("users.supplier_code", auth.user.supplier_code);
      return response.json(DepositLogs);
    } else if (auth.user.type === "SUPPLIER") {
      const DepositLogs = await Database.select("*")
        .from("deposit_logs")
        .leftJoin("users", "deposit_logs.user_id", "users.id")
        .where("users.type", "SUPPLIER");
      return response.json(DepositLogs);
    }
  }
}

module.exports = DepositLogController;
