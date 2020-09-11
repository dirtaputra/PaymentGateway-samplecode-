"use strict";
const supply = use("Database");
const supplies = use("App/Models/Supply");
const users = use("App/Models/User");
const catalog = use("App/Models/Catalog");
const Log = use("App/Models/Log");
const { validateAll } = use("Validator");

class SupplyController {
	async coba({ view }) {
		return view.render("pages.try");
	}
	async tambahSupply({ view }) {
		return view.render("pages.userAdd");
	}
	async data({ request, response }) {
		const coba = await supplies.all();
		return response.json(coba);
	}
	async index({ request, response, view, auth }) {
		try {
			if (request.ajax()) {
				const draw = request.input("draw");
				const start_dt = request.input("start");
				const length_dt = request.input("length");
				const field_order = request.input("columns[" + request.input("order[0][column]") + "][data]");
				const type_order = request.input("order[0][dir]");
				const search = request.input("search[value]");

				const init = supplies
					.query()
					.select(
						"id",
						"supplier_code",
						"category",
						"product_code",
						"min_denom",
						"denom",
						"method",
						"margin",
						"buy_hbs",
						"sell_hjs",
						"status",
						"sub_id",
					)
					.whereRaw(
						`(
            supplier_code ILIKE '%${search}%'
            or category ILIKE '%${search}%'
            or (product_code||':'||sub_id) ILIKE '%${search}%'
            or min_denom::text ILIKE '%${search}%'
            or denom::text ILIKE '%${search}%'
            or method ILIKE '%${search}%'
            or margin::text ILIKE '%${search}%'
            or buy_hbs::text ILIKE '%${search}%'
            or sell_hjs::text ILIKE '%${search}%'
            or status ILIKE '%${search}%'
            )`,
					)
					.orderBy(field_order, type_order)
					.clone();

				let initial_db;
				let records_total;
				let records_filtered;
				if (auth.user.type === "STAFF") {
					records_total = await supplies.getCount();
					records_filtered = search ? await init.getCount() : records_total;
					initial_db = await init.offset(start_dt).limit(length_dt).fetch();
				} else if (auth.user.type === "SUPPLIER") {
					records_total = await supplies.query().where("supplier_code", auth.user.supplier_code).getCount();
					records_filtered = search ? await init.getCount() : records_total;
					initial_db = await init
						.offset(start_dt)
						.limit(length_dt)
						.where("supplier_code", auth.user.supplier_code)
						.fetch();
				}

				const data_res = {
					draw: draw,
					recordsTotal: records_total,
					recordsFiltered: records_filtered,
					data: initial_db,
				};
				return response.status(200).json(data_res);
			}
			// end of ajax datatable

			return view.render("pages.supplyCatalogDetail");
		} catch (error) {
			return response.json({
				error: error,
			});
		}
	}

	/**
   * Render a form to be used for creating a new supplier.
   * GET suppliers/create
   *
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Response} ctx.response
   * @param {View} ctx.view
   */
	async create({ request, response, view }) {
		const supplier_code = await users.all();
		const catalogs = await catalog.query().orderBy("catalogs.code", "asc").fetch();
		return view.render("pages.supplyCatalogAdd", {
			users: supplier_code.toJSON(),
			catalogs: catalogs.toJSON(),
		});
	}

	/**
   * Create/save a new supplier.
   * POST suppliers
   *
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Response} ctx.response
   */
	async store({ request, response, auth, session }) {
		let data_req = request.only([
			"supplier_code",
			"category",
			"product_code",
			"supplier_product_id",
			"min_denom",
			"denom",
			"method",
			"margin",
			"buy_hbs",
			"sell_hjs",
			"reference",
			"status",
			"sub_id",
		]);
		data_req.auth_user_id = auth.user.id;

		const check_sp = request.input("supplier_product_id") || "{}";
		const check_json = JSON.parse(check_sp);
		if (Object.keys(check_json).length < 1) data_req["supplier_product_id"] = "";

		let rules = {
			supplier_code: "required",
			category: "required",
			product_code: "required",
			supplier_product_id: "required",
			status: "required",
			margin: "required",
			method: "required",
			denom: "required",
		};
		if (request.input("category_type") === "fp") {
			rules["sell_hjs"] = "required";
			rules["buy_hbs"] = "required";
			rules["reference"] = "required";
			const validation = await validateAll(data_req, rules);
			if (validation.fails()) {
				session.withErrors(validation.messages());
				return response.redirect("back");
			}
		} else if (request.input("category_type") === "dyn") {
			rules["min_denom"] = "required";
			rules["reference"] = "required";
			const validation = await validateAll(data_req, rules);
			if (validation.fails()) {
				session.withErrors(validation.messages());
				return response.redirect("back");
			}
		}
		await supplies.create(data_req);

		return response.redirect("/supply-catalog");
	}

	/**
   * Display a single supplier.
   * GET suppliers/:id
   *
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Response} ctx.response
   * @param {View} ctx.view
   */
	async show({ params, request, response, view }) {
		const supplys = supply.select("*").table("supplies").where("supplier_code", "SRS");

		// const supp = await post.findOrFail(params.supplier_code)
		// console.log(supplys)
		return view.render("pages.supplyCatalogDetail", {
			data: supplys,
		});
	}

	/**
   * Render a form to update an existing supplier.
   * GET suppliers/:id/edit
   *
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Response} ctx.response
   * @param {View} ctx.view
   */
	async edit({ params, request, response, view }) {
		const supplyData = await supplies.find(params.id);
		const supplier_code = await users.all();
		const catalogs = await catalog.all();
		return view.render("pages.supplyCatalogEdit", {
			data: supplyData,
			users: supplier_code.toJSON(),
			catalogs: catalogs.toJSON(),
		});
	}

	/**
   * Update supplier details.
   * PUT or PATCH suppliers/:id
   *
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Response} ctx.response
   */

	/**
   * Delete a supplier with id.
   * DELETE suppliers/:id
   *
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Response} ctx.response
   */
	async destroy({ params, request, response, auth }) {
		const change_status = params.status === "DISABLE" ? "ENABLE" : "DISABLE";
		const product = await supplies.find(params.id);
		product.supplier_product_id = JSON.stringify(product.supplier_product_id);
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
		// Logs.activity = 'delete data catalog supplier'
		// Logs.detail = 'deleted catalog supplier with supplier_code =' + product.supplier_code + ', and category = ' + product.category + ', and product code = ' + product.product_code
		// await Logs.save()
		return response.redirect("back");
	}
	async update({ params, request, response, auth }) {
		const supply = await supplies.find(params.id);
		supply.supplier_code = request.all().supplier_code;
		supply.category = request.all().category;
		supply.product_code = request.all().product_code;
		supply.supplier_product_id = request.all().supplier_product_id;
		supply.min_denom = request.all().min_denom;
		supply.denom = request.all().denom;
		supply.method = request.all().method;
		supply.margin = request.all().margin;
		supply.buy_hbs = request.all().buy_hbs;
		supply.sell_hjs = request.all().sell_hjs;
		supply.reference = request.all().reference;
		supply.sub_id = request.all().sub_id;
		supply.status = request.all().status;
		if (request.all().status === "DISABLE") {
			supply.is_check = false;
		} else if (request.all().status === "ENABLE") {
			supply.is_check = true;
		}

		supply.auth_user_id = auth.user.id;

		await supply.save();

		// const Logs = new Log()
		// Logs.user_id = auth.user.id
		// Logs.activity = 'Update data catalog supplier'
		// Logs.detail = ''
		// await Logs.save()
		return response.redirect("/supply-catalog");
	}
}

module.exports = SupplyController;
