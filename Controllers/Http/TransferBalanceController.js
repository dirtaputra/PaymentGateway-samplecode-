'use strict'

const Database = use('Database');
const User = use("App/Models/User");
const moment = require('moment');
const numeral = require("numeral");

class TransferBalanceController {
  async index({
    request,
    response,
    view
  }) {
    if (!request.ajax()) {
      return view.render('pages.transferBalance')
    }
    let {
      startdate,
      enddate,
      filter_orig,
      filter_dest
    } = request.all();
    const start = moment(startdate, "YYYY-MM-DD").startOf("day").toISOString();
    const end = moment(enddate, "YYYY-MM-DD").endOf("day").toISOString();
    const f_orig = filter_orig ? `and l1.user_id='${filter_orig}'` : "";
    const f_dest = filter_dest ? `and l2.user_id='${filter_dest}'` : "";

    const draw = request.input("draw");
    const start_dt = request.input("start");
    const length_dt = request.input("length");
    const field_order = request.input("columns[" + request.input("order[0][column]") + "][data]");
    const type_order = request.input("order[0][dir]");
    const search = request.input("search[value]");
    //query
    let query = `
      select d.payment_id, l1.created_at, l1.debit, u1.email as originating, u2.email as destination,u1.is_salesforce as salesforce
      from ledgers as l1
      join ledgers as l2 on l1.remark=l2.remark and l1.debit != 0 and l2.credit != 0
      left join users as u1 on l1.user_id=u1.id
      left join users as u2 on l2.user_id=u2.id
      left join deposit_logs as d on l2.deposit_ref = d.id
      where
        l1.created_at between '${start}' and '${end}'
        and (
          (l1.debit::text ILIKE '%${search}%')
          or (payment_id ILIKE '%${search}%')
        )
        ${f_orig}
        ${f_dest}
      order by ${field_order} ${type_order}
      offset ${start_dt} limit ${length_dt}
    `;
    let init_count = `
      select count(l1.user_id) as jumlah
      from ledgers as l1
      join ledgers as l2 on l1.remark=l2.remark and l1.debit != 0 and l2.credit != 0
      where
        l1.created_at between '${start}' and '${end}'
        ${f_orig}
        ${f_dest}
    `;

    const records_total = await Database.raw(init_count);
    let records_filtered = search ? (await Database.raw(init_count + ` and (l1.debit::text ILIKE '%${search}%')`)).rows[0].jumlah : records_total.rows[0].jumlah;
    const initial_db = await Database.raw(query);

    const data_res = {
      draw: draw,
      recordsTotal: records_total.rows[0].jumlah,
      recordsFiltered: records_filtered,
      data: initial_db.rows,
    };
    return response.status(200).json(data_res);
  }

  async filter_select({
    request,
    response
  }) {
    const param = request.input("q");
    const res = await User.query()
      .select("id", "email as text")
      .whereRaw(`email ILIKE '%${param}%'`)
      .fetch();
    return response.json({
      items: res.toJSON()
    });
  }

  async sumAmount({
    request,
    response
  }) {
    try {
      let {
        startdate,
        enddate,
        filter_orig,
        filter_dest
      } = request.all();
      const start = moment(startdate, "YYYY-MM-DD").startOf("day").toISOString();
      const end = moment(enddate, "YYYY-MM-DD").endOf("day").toISOString();
      const f_orig = filter_orig ? `and l1.user_id='${filter_orig}'` : "";
      const f_dest = filter_dest ? `and l2.user_id='${filter_dest}'` : "";

      let query = `
        select sum(l1.debit) as total
        from ledgers as l1
        join ledgers as l2 on l1.remark=l2.remark and l1.debit != 0 and l2.credit != 0
        left join users as u1 on l1.user_id=u1.id
        left join users as u2 on l2.user_id=u2.id
        where
          l1.created_at between '${start}' and '${end}'
          ${f_orig}
          ${f_dest}
      `;
      const initial_db = await Database.raw(query);
      return response.json({
        total: numeral(Number(initial_db.rows[0].total)).format("0,0.00")
      });
    } catch (error) {
      return response.json(error);
    }
  }

  // async coba({request, response}){
  //   const CsvPlugin = use("App/Common/DepositDownload");
  //   return response.send(await CsvPlugin.GenerateTransferBalance('4580dd12-3425-4a81-8077-7776bacd553a'))
  // }
}

module.exports = TransferBalanceController
