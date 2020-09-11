'use strict'
// const User = use("App/Models/User");
const Poin = use("App/Models/Poin");
const Transaction = use("App/Models/Transaction");
const _ = require("lodash");
const moment = require("moment");
const Database = use('Database');
const Env = use("Env");

class PoinController {
  async index({
    request,
    view,
    response
  }) {
    const arrIndex = await Poin.query().where('expiry', '>=', moment().startOf('month')).groupBy('index').orderBy('index','asc').pluck('index');
    const arrFilter = arrIndex.map((val, idx)=>{
      const value = val.split(' ');
      return value.join("-")
    });
    
    try {
      if (request.ajax()) {
        const poin_validity = Env.get("POIN_VALIDITY");
        let { startdate, enddate } = request.all();
        const start = moment(startdate, "YYYY-MM").add(poin_validity, "months").startOf("month").toISOString();
        const end = moment(enddate, "YYYY-MM").add(poin_validity, "months").endOf("month").toISOString();

        const draw = request.input('draw');
        const start_dt = request.input('start');
        const length_dt = request.input('length');
        const field_order = request.input('columns['+request.input('order[0][column]')+'][data]');
        const type_order = request.input('order[0][dir]');
        const search = request.input('search[value]');
        
        const init = Poin
          .query()
          .from('poins as p')
          .select('u.fullname', 'u.email', 'p.user_id',
            Database.raw('sum(p.poin) as poin'),
            Database.raw('sum(p.consumed) as consumed')
          )
          .whereRaw(`(
            u.fullname ILIKE '%${search}%'
            or u.email ILIKE '%${search}%'
            )`)
          .whereBetween('p.expiry', [start, end])
          .leftJoin('users as u', 'p.user_id','u.id')
          .groupByRaw('user_id, email, fullname')
          .orderBy(field_order, type_order)
          .clone()

        let count = Database
          .table('poins as p')
          .select(Database.raw('count(distinct(p.user_id)) as total'))
          .whereBetween('p.expiry', [start, end]);
        let records_total = (await count)[0].total;
        let records_filtered = search 
          ? (await count
            .leftJoin('users as u', 'p.user_id','u.id')
            .whereRaw(`(
              u.fullname ILIKE '%${search}%'
              or u.email ILIKE '%${search}%'
              )`))[0].total
          : records_total;
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
      return view.render("pages.poin", { filter: arrFilter });
    } catch (error) {
      return response.json({error: error})
    }
  }

  async show({response, params}){
    try {
      const poin_validity = Env.get("POIN_VALIDITY");
      const start = moment(params.start, "YYYY-MM").add(poin_validity, "months").startOf("month").toISOString();
      const end = moment(params.end, "YYYY-MM").add(poin_validity, "months").endOf("month").toISOString();
      const obj = await Poin
        .query()
        .select('index', 'poin', 'consumed', 'expiry')
        .whereBetween('expiry', [start, end])
        .where('user_id', params.id)
        .orderBy('expiry', 'asc')
        .fetch();
      return response.status(200).json({list: obj.toJSON()});
    } catch (e) {
      return response.json({error: e});
    }
  }
}

module.exports = PoinController
