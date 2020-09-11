"use strict";
const Log = use("App/Models/Log");
const Download = use("App/Models/Download");
const DownloadData = use("App/Common/DepositDownload");
const transaction = use("App/Models/Transaction");
const moment = require("moment");

class LogController {
  async index({ view, request, response }) {
    try {
      let { startdate, enddate } = request.all();
      // const start = startdate ? moment(startdate).startOf('day').format('YYYY-MM-DD HH:mm:ss') : moment().startOf('month').format('YYYY-MM-DD HH:mm:ss');
      // const end = enddate ? moment(enddate).endOf('day').format('YYYY-MM-DD HH:mm:ss') : moment().endOf('month').format('YYYY-MM-DD HH:mm:ss');

      const start = startdate
        ? moment(startdate, "YYYY-MM-DD")
            .startOf("day")
            .toISOString()
        : moment()
            .startOf("month")
            .toISOString();
      const end = enddate
        ? moment(enddate, "YYYY-MM-DD")
            .endOf("day")
            .toISOString()
        : moment()
            .endOf("month")
            .toISOString();

      // console.log([start, end]);

      if (request.ajax()) {
        const draw = request.input("draw");
        const start_dt = request.input("start");
        const length_dt = request.input("length");
        const field_order = request.input(
          "columns[" + request.input("order[0][column]") + "][data]"
        );
        const type_order = request.input("order[0][dir]");
        const search = request.input("search[value]");

        const init = Log.query()
          .select("l.id", "u.fullname", "l.activity", "l.before", "l.after", "l.created_at")
          .from(`logs as l`)
          .joinRaw("left join users as u on l.user_id = u.id::text")
          .whereBetween("l.created_at", [start, end])
          .whereRaw(
            `(
            l.id::text ILIKE '%${search}%'
            or u.fullname ILIKE '%${search}%'
            or l.activity ILIKE '%${search}%'
            or l.before::text ILIKE '%${search}%'
            or l.after::text ILIKE '%${search}%'
            )`
          )
          .orderBy(field_order, type_order)
          .clone();

        let records_total = await Log.query()
          .whereBetween("created_at", [start, end])
          .getCount();
        let records_filtered = search ? await init.getCount() : records_total;
        let initial_db = await init.offset(start_dt).limit(length_dt).fetch();

        const data_res = {
          draw: draw,
          recordsTotal: records_total,
          recordsFiltered: records_filtered,
          data: initial_db
        };
        return response.status(200).json(data_res);
      }
      // end of ajax datatable

      return view.render("pages.log");
    } catch (error) {
      return response.json({ error: error });
    }
  }

  async showRange({ view, response, request }) {
    const start = request.all().startdate;
    const end = request.all().enddate;
    const Logs = await Log.query()
      .with("user")
      .whereBetween("logs.created_at", [start, end])
      .fetch();
    console.log(start);
    // return response.json(Logs.toJSON())
    return view.render("pages.logs", {
      data: Logs.toJSON(),
      start: start,
      end: end
    });
  }
  async download({ request, response, view, auth }) {
    const id = "429ff319-806b-49a9-9b50-c9bcc3818a0e";
    const coba = await DownloadData.GenerateDeposit(id);
    return coba;
  }
}

module.exports = LogController;
