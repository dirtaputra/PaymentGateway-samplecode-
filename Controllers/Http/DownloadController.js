'use strict'
const Download = use('App/Models/Download')
const Event = use("Event");
const moment = require("moment");
const Database = use("Database");
class DownloadController {
  async index({
    view,
    auth,
    request,
    response
  }) {
    try {
      if (request.ajax()) {
        const draw = request.input('draw')
        const start_dt = request.input('start')
        const length_dt = request.input('length')
        const field_order = request.input('columns['+request.input('order[0][column]')+'][data]')
        const type_order = request.input('order[0][dir]')
        const search = request.input('search[value]')        
        
        const init = Download
          .query()
          .select("filename", "start", "end", "status", "created_at", "url")
          .where("downloads.user_id", auth.user.id)
          .whereRaw(`(
            filename ILIKE '%${search}%'
            or status ILIKE '%${search}%'
            )`)
          .orderBy(field_order, type_order)
          .clone()

        let records_total = await Download.query().where("downloads.user_id", auth.user.id).getCount()
        let records_filtered = search ? await init.getCount() : records_total;
        let initial_db = await init.offset(start_dt).limit(length_dt).fetch()
        
        const data_res = {
          'draw': draw,
          'recordsTotal': records_total,
          'recordsFiltered': records_filtered,
          'data': initial_db
        }
        return response.status(200).json(data_res)
      }
      // end of ajax datatable

      return view.render('pages.download')
    } catch (error) {
      return response.json({error: error})
    }

    // const DownloadData = await Download.query()
    //   .where("downloads.user_id", auth.user.id)
    //   .orderBy("downloads.created_at", "desc")
    //   .fetch()
    // // const asd = await Database.table("downloads")
    // //   .select("filename")
    // //   .select(Database.raw('DATE_FORMAT(start, "%Y-%m-%d")as DateStart'))
    // //   .select(Database.raw('DATE_FORMAT(start, "%Y-%m-%d") as date'))
    // const formattedData = DownloadData.rows.map((data) => {
    //   return {
    //     filename: data.filename,
    //     start: moment(data.start).format("YYYY-MM-DD"),
    //     end: moment(data.end).format("YYYY-MM-DD"),
    //     status: data.status,
    //     url: data.url,
    //     created_at: moment(data.created_at).format("YYYY-MM-DD HH:MM:SS")
    //   }
    // });
    // console.log();
    // return view.render("pages.download", {
    //   data: formattedData
    // })
  }

  async download({
    auth,
    view,
    request,
    response
  }) {
    const downloads = new Download()
    const date = new Date();
    const ms = date.getMilliseconds();
    downloads.user_id = auth.user.id
    downloads.filename = request.all().schema + '-' + request.all().start.replace("-", "").replace("-", "") + '-' + request.all().end.replace("-", "").replace("-", "") + '-' + ms;
    downloads.status = "QUEUED"
    downloads.start = request.all().start
    downloads.end = request.all().end
    downloads.schema = request.all().schema
    await downloads.save();
    // fire event
    Event.fire("DOWNLOAD::ADD", {
      id: downloads.id,
      filename: downloads.filename + '.csv',
      schema: downloads.schema,
      state: "ADD"
    });
    return response.redirect('/download')
  }

}

module.exports = DownloadController
