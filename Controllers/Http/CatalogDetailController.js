"use strict";
const CatalogDetail = use("App/Models/CatalogDetail");
const Catalog = use("App/Models/Catalog");
const Database = use("Database");
const Log = use("App/Models/Log");
const axios = require("axios");
class CatalogDetailController {
  async data({
    request,
    response,
    view
  }) {
    let pagination = request.only(["page", "limit"]);
    const page = parseInt(pagination.page, 10) || 1;
    const limit = parseInt(pagination.limit, 10) || 10;
    const catalogData = await Database.select("*").from("catalog_details").paginate(page, limit);
    return response.json(catalogData);
  }
  async index({
    view,
    params
  }) {
    const CatalogDetails = await CatalogDetail.query().where("catalog_details.product_code", params.code).fetch();
    return view.render("pages.productCatalog", {
      data: CatalogDetails.toJSON(),
    });
  }
  async showDetail({
    view,
    params,
    request,
    response
  }) {
    try {
      if (request.ajax()) {
        const draw = request.input("draw");
        const start_dt = request.input("start");
        const length_dt = request.input("length");
        const field_order = request.input("columns[" + request.input("order[0][column]") + "][data]");
        const type_order = request.input("order[0][dir]");
        const search = request.input("search[value]");

        const init = CatalogDetail.query()
          .select("id", "product_code", "min", "denom", "value", "method", "status", "sub_id", "label")
          .where("product_code", params.code)
          .whereRaw(
            `(
            id::text ILIKE '%${search}%'
            or product_code ILIKE '%${search}%'
            or min::text ILIKE '%${search}%'
            or denom::text ILIKE '%${search}%'
            or value::text ILIKE '%${search}%'
            or method ILIKE '%${search}%'
						or status ILIKE '%${search}%'
						or label ILIKE '%${search}%'
            )`,
          )
          .orderBy(field_order, type_order)
          .clone();

        let records_total = await CatalogDetail.query().where("product_code", params.code).getCount();
        let records_filtered = search ? await init.getCount() : records_total;
        let initial_db = await init.offset(start_dt).limit(length_dt).fetch();

        const data_res = {
          draw: draw,
          recordsTotal: records_total,
          recordsFiltered: records_filtered,
          data: initial_db,
        };
        return response.status(200).json(data_res);
      }
      // end of ajax datatable

      const codeData = params.code;
      return view.render("pages.productCatalog", {
        productCode: codeData,
      });
    } catch (error) {
      return response.json({
        error: error,
      });
    }
  }
  async create({
    view,
    params
  }) {
    // const list = await Catalog.query()
    //   // .orderBy("catalogs.code", "asc")
    //   .where("product_code", params.code)
    //   .fetch()
    const code = params.code;
    return view.render("pages.productCatalogAdd", {
      // data: list.toJSON(),
      codes: code,
    });
  }
  async destroy({
    response,
    params,
    auth
  }) {
    try {
      const change_status = params.status === "DISABLE" ? "ENABLE" : "DISABLE";
      const product = await CatalogDetail.find(params.id);
      product.auth_user_id = auth.user.id;
      product.status = change_status;
      if (change_status === "DISABLE") {
        product.is_check = false;
      } else if (change_status === "ENABLE") {
        product.is_check = true;
      }
      await product.save();
      // const Logs = new Log()
      // Logs.user_id = auth.user.id
      // Logs.activity = 'Delete data catalog detail'
      // Logs.detail = 'Deleted catalog detail with code = ' + product.product_code
      // await Logs.save()
      return response.redirect("back");
    } catch (error) {
      return response.redirect("back");
    }
  }
  async store({
    request,
    response,
    auth
  }) {
    let data_req = request.only([
      "product_code",
      "min",
      "denom",
      "method",
      "value",
      "status",
      "reference",
      "sub_id",
      "label",
      "poin",
    ]);
    data_req.auth_user_id = auth.user.id;
    await CatalogDetail.create(data_req);
    const code = request.input("product_code");
    // const Logs = new Log()
    // Logs.user_id = auth.user.id
    // Logs.activity = 'add data catalog detail'
    // Logs.detail = 'add data catalog detail with product code= ' + code

    // await Logs.save()
    return response.redirect("/product/detail/" + code);
  }
  async edit({
    params,
    view
  }) {
    const catalogDetails = await CatalogDetail.find(params.id);
    const list = await Catalog.all();
    const code = catalogDetails.product_code;
    console.log(catalogDetails.toJSON());
    return view.render("pages.productCatalogEdit", {
      data: catalogDetails,
      list: list.toJSON(),
      codes: code,
    });
  }
  async update({
    params,
    request,
    response,
    auth
  }) {
    const catalogDetails = await CatalogDetail.find(params.id);

    catalogDetails.product_code = request.all().product_code;
    catalogDetails.min = request.all().min;
    catalogDetails.denom = request.all().denom;
    catalogDetails.method = request.all().method;
    catalogDetails.value = request.all().value;
    catalogDetails.reference = request.all().reference;
    catalogDetails.sub_id = request.all().sub_id;
    catalogDetails.label = request.all().label;
    catalogDetails.status = request.all().status;
    catalogDetails.poin = request.all().poin;
    catalogDetails.auth_user_id = auth.user.id;
    if (request.all().status === "DISABLE") {
      catalogDetails.is_check = false;
    } else if (request.all().status === "ENABLE") {
      catalogDetails.is_check = true;
    }

    // const Logs = new Log()
    // Logs.user_id = auth.user.id
    // Logs.activity = 'Update data catalog detail'
    // Logs.detail = ''

    // await Promise.all([catalogDetails.save(), Logs.save()]);
    await Promise.all([catalogDetails.save()]);
    return response.redirect("/product/detail/" + catalogDetails.product_code);
  }

  async updatePartner({
    params,
    request,
    response,
    auth
  }) {
    const catalogData = await CatalogDetail.find(params.id);
    catalogData.b2b = request.all().b2b;
    catalogData.auth_user_id = auth.user.id;
    await catalogData.save();
    return response.redirect("/product/detail/" + catalogData.product_code);
  }

  async b2bProductList({
    request,
    response,
    auth,
    view,
    params
  }) {
    if (!request.ajax()) return view.render("pages.b2bProductList", {
      partner_id: params.partner_id ? params.partner_id : ''
    });
    const kurs1 = await axios.get("https://api.exchangerate-api.com/v4/latest/MYR");
    console.log("CatalogDetailController >> kurs: " + kurs1.data.rates.IDR)
    const draw = request.input("draw");
    const start_dt = request.input("start");
    const length_dt = request.input("length");
    const search = request.input("search[value]");
    const knownUser = params.partner_id ? {is_partner: params.partner_id} : auth.user;
    const ava = request.get().filter_available;
    const inq = request.get().filter_inquiry;
    const list_inquiry = ["PLN", "PLNBILL"];
    const init = CatalogDetail.query()
      .with("catalog")
      .with("supply")
      .orderBy("product_code", "asc")
      .orderBy("denom", "asc")
      .where(function () {
        this.where("b2b", "?", knownUser.is_partner);
        if (ava) this.where("status", ava);
        if (inq === 'false') this.whereNotIn('product_code', list_inquiry);
        if (inq === 'true') this.whereIn('product_code', list_inquiry);
        this.whereHas('supply', builder => {
          builder.whereNotNull('product_code');
        })
      })
      .where(function () {
        this.orWhere(Database.raw(`(product_code||':'||sub_id)`), 'ILIKE', `%${search}%`);
        this.orWhere(Database.raw('denom::text'), 'ILIKE', `%${search}%`);
        this.orWhereHas("catalog", builder => {
          builder.where('description', 'ILIKE', `%${search}%`)
        });
        this.orWhereHas("supply", builder => {
          builder.where('category', 'ILIKE', `%${search}%`)
        });
      })
      .clone();

    let records_total = await CatalogDetail.query()
      .where(function () {
        this.where("b2b", "?", knownUser.is_partner);
        if (ava) this.where("status", ava);
        if (inq === 'false') this.whereNotIn('product_code', list_inquiry);
        if (inq === 'true') this.whereIn('product_code', list_inquiry);
        this.whereHas('supply', builder => {
          builder.whereNotNull('product_code');
        })
      })
      .getCount();
    let records_filtered = search ? await init.getCount() : records_total;
    let obj_init = await init.offset(start_dt).limit(length_dt).fetch();

    const initial_db = obj_init.toJSON().map(el => {
      const key = knownUser.is_partner;
      if (!el.b2b) return null;
      if (!(el.b2b).hasOwnProperty(key)) return null;
      const partner = el.b2b[key];
      let price;
      let denom;
      if (!partner.min) {
        price =
          partner.type === "PERCENT" ?
          (parseFloat(partner.value) / 100) * el.reference :
          partner.value;
        price = parseFloat(price).toFixed(2);
        denom = el.denom
      } else {
        let min, max;
        min = (parseFloat(partner.value) / 100) * el.min;
        max = (parseFloat(partner.value) / 100) * el.denom;
        max = max / kurs1.data.rates.IDR;
        price = `${min.toFixed(2)} - ${(max + parseFloat(2)).toFixed(2)}`;
        denom = `${el.min} - ${el.denom}`;
      }
      let rrp;
      if (partner.min) {
        let denomTmp = parseFloat(el.denom) / kurs1.data.rates.IDR;
        rrp = `${el.min} - ${(denomTmp + parseFloat(4)).toFixed(2)}`;
      } else {
        rrp = el.reference;
      }
      const {
        country,
        currency
      } = countryCurrencyMap(el.catalog.origin);
      let b2bUser = knownUser.is_partner;
      let margin;
      if (el.supply.category === "PREDEFINED") {
        margin = "2";
      } else if (
        el.supply.category === "BILL" &&
        el.supply.min_denom !== null
      ) {
        margin =
          parseFloat(el.min) - (parseFloat(partner.value) / 100) * el.min;
        margin = parseFloat(margin).toFixed(2);
      } else {
        if (el.b2b[b2bUser].type === "ABSOLUTE") {
          margin = (rrp - parseFloat(el.b2b[b2bUser].value)).toFixed(2);
        } else if (el.b2b[b2bUser].type === "PERCENT") {
          margin = (
            rrp -
            rrp * (parseFloat(el.b2b[b2bUser].value) / 100)
          ).toFixed(2);
          margin = (margin / rrp) * 100;
        }
      }

      return {
        id: el.id,
        data_json: el.b2b[knownUser.is_partner],
        code: el.product_code,
        item_id: `${el.product_code}:${el.sub_id}`,
        category: el.supply.category,
        country: country,
        name: el.label || "-",
        description: el.catalog.description,
        denom: denom+' '+currency,
        price: price+' MYR',
        rrp: rrp+' MYR',
        margin_type: el.b2b[b2bUser].type,
        margin: margin,
        inquiry_first: el.product_code === "PLN" ||
          el.product_code === "PLNBILL" ||
          el.product_code === "BPJS" ?
          true : false,
        available: el.status === "ENABLE" ? true : false
      };
    });
    const data_res = {
      draw: draw,
      recordsTotal: records_total,
      recordsFiltered: records_filtered,
      data: await initial_db.filter(el => el !== null)
    };
    return response.status(200).json(data_res);
  }

  async filter_product({
    request,
    response
  }) {
    const param = request.input("q");
    const res = await CatalogDetail.query()
      .select("id", Database.raw("(product_code||':'||sub_id||' - '||denom) as text"))
      .whereRaw(`(product_code||':'||sub_id||' - '||denom) ILIKE '%${param}%'`)
      .fetch();
    return response.json({
      items: res.toJSON()
    });
  }

  async save_json({
    request,
    response,
    auth
  }) {
    const json_data = request.input('data');
    const id_catalog_detail = request.input('id');
    const partner_id = request.input('partner_id');
    let obj = await CatalogDetail.find(id_catalog_detail);
    if (!obj.b2b) obj.b2b = {};
    if (!(obj.b2b).hasOwnProperty(partner_id)) obj.b2b[partner_id] = {};
    obj.b2b[partner_id] = json_data;
    await CatalogDetail
      .query()
      .where('id', id_catalog_detail)
      .update({ b2b: obj.b2b })
    console.log(`Update B2B product catalog detail [${obj.id}] by ${auth.user.fullname} / ${auth.user.id}`)
    return response.json({status: true, obj: obj.toJSON()})
  }
}

module.exports = CatalogDetailController;

function countryCurrencyMap(code) {
  if (code === "IDN") {
    return {
      country: "Indonesia",
      currency: "IDR"
    };
  } else if (code === "MYS") {
    return {
      country: "Malaysia",
      currency: "MYR"
    };
  } else if (code === "NPL") {
    return {
      country: "Nepal",
      currency: "NPR"
    };
  } else if (code === "BGD") {
    return {
      country: "Bangladesh",
      currency: "BDT"
    };
  } else if (code === "PHL") {
    return {
      country: "Philippines",
      currency: "PHP"
    };
  }
}
