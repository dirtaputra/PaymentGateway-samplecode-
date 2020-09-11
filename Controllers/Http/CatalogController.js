'use strict'

const Catalog = use('App/Models/Catalog')
const Database = use('Database')
const Log = use('App/Models/Log')
const Swal = require('sweetalert2')
const { validateAll } = use('Validator')

class CatalogController {

  async data({
    response,
    request
  }) {
    let pagination = request.only(["page", "limit"]);
    const page = parseInt(pagination.page, 10) || 1;
    const limit = parseInt(pagination.limit, 10) || 10;
    const catalogData = await Database.select("*")
      .from("catalogs")
      .paginate(page, limit)
    return response.json(catalogData)
  }
  async index({
    view,
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
        
        const init = Catalog
          .query()
          .select("code", "name", "origin", "description", "validator", "usage_description")
          .whereRaw(`(
            code ILIKE '%${search}%'
            or name ILIKE '%${search}%'
            or origin ILIKE '%${search}%'
            or usage_description ILIKE '%${search}%'
            or validator::text ILIKE '%${search}%'
            )`)
          .orderBy(field_order, type_order)
          .clone()

        let records_total = await Catalog.getCount()
        let records_filtered = search ? await init.getCount() : records_total;
        let initial_db = await init.offset(start_dt).limit(length_dt).fetch();
        
        const data_res = {
          'draw': draw,
          'recordsTotal': records_total,
          'recordsFiltered': records_filtered,
          'data': initial_db
        }
        return response.status(200).json(data_res)
      }
      // end of ajax datatable

      return view.render('pages.product')
    } catch (error) {
      return response.json({error: error})
    }
  }

  async create({
    view
  }) {
    return view.render('pages.productAdd');
  }

  async store({
    request,
    response,
    auth,
    session
  }) {
    let data_req = request.only(['code', 'name', 'usage_description', 'description', 'origin', 'prefix', 'validator'])
    data_req.auth_user_id = auth.user.id

    // validation
    const rules = {
      code: 'required|unique:catalogs,code',
      validator: 'json'
    }
    const messages = {
      'code.unique': 'Not allowed duplicat code'
    }
    const validation = await validateAll(data_req, rules, messages)
    if (validation.fails()) {
      // return response.json({
      //   error: validation.messages()
      // })
      session.withErrors(validation.messages())
      return response.redirect('back');
    }

    await Catalog.create(data_req);
    // const Logs = new Log()
    // const code = request.input('code')
    // const name = request.input('name')
    // Logs.user_id = auth.user.id
    // Logs.activity = 'add data catalog master'
    // Logs.detail = 'add catalog master with code =' + code + ', and name = ' + name
    // await Logs.save()
    return response.redirect('/product')
  }

  async edit({
    params,
    view
  }) {
    const catalogs = await Catalog.find(params.code);
    return view.render('pages.productEdit', {
      data: catalogs
    });
  }

  async update({
    params,
    request,
    response,
    auth,
    session
  }) {
    const catalogs = await Catalog.find(params.code);

    let data_req = request.only(['validator'])
    // validation
    const rules = {
      validator: 'json'
    }
    const validation = await validateAll(data_req, rules)
    if (validation.fails()) {
      session.withErrors(validation.messages())
      return response.redirect('back');
    }

    catalogs.code = request.all().code;
    catalogs.name = request.all().name;
    catalogs.origin = request.all().origin;
    catalogs.prefix = request.all().prefix;
    catalogs.description = request.all().description;
    catalogs.usage_description = request.all().usage_description;
    catalogs.validator = request.all().validator;

    catalogs.auth_user_id = auth.user.id

    await catalogs.save();

    // const Logs = new Log()
    // Logs.user_id = auth.user.id
    // Logs.activity = 'Update data catalog master'
    // Logs.detail = ''

    // await Logs.save()
    return response.redirect('/product');
  }

  async destroy({
    params,
    response,
    auth,
    session
  }) {
    try {
      const product = await Catalog.find(params.code);
      product.auth_user_id = auth.user.id
      await product.delete();
      // const Logs = new Log()
      // Logs.user_id = auth.user.id
      // Logs.activity = 'Delete data catalog master'
      // Logs.detail = 'deleted data with code =' + product.code
      // await Logs.save()
      return response.redirect('back');
    } catch (error) {
      return response.redirect('back');
      // session.flash({ status: 'error' })
    }
    // const product = await Catalog.find(params.code);
    // await product.delete();
    // const Logs = new Log()
    // Logs.user_id = auth.user.id
    // Logs.activity = 'Delete data catalog master'
    // Logs.detail = ''
    // await Logs.save()
    // return response.redirect('back');
  }
}

module.exports = CatalogController
