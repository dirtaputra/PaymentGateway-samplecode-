"use strict";
const Database = use("Database");
const TransactionHistories = use("App/Models/TransactionHistory");
const Catalog = use("App/Models/Catalog");
const transaction = use("App/Models/Transaction");
const supplies = use("App/Models/Supply");
const User = use("App/Models/User");
const moment = require("moment");
const numeral = require("numeral");
const Ledger = use("App/Models/Ledger");
const Transaction = use("App/Models/Transaction");

class TransactionHistoryController {
	async index({ request, response, view, auth }) {
		try {
			let { startdate, enddate } = request.all();
			const start = startdate
				? moment(startdate, "YYYY-MM-DD").startOf("day").toISOString()
				: moment().startOf("month").toISOString();
			const end = enddate
				? moment(enddate, "YYYY-MM-DD").endOf("day").toISOString()
				: moment().endOf("month").toISOString();

			if (request.ajax()) {
				const draw = request.input("draw");
				const start_dt = request.input("start");
				const length_dt = request.input("length");
				const field_order = request.input("columns[" + request.input("order[0][column]") + "][data]");
				const type_order = request.input("order[0][dir]");
				const search = request.input("search[value]");

				const f_supplier = request.input("filter_supplier")
					? `and s.supplier_code='${request.input("filter_supplier")}'`
					: "";
				const f_product = request.input("filter_product")
					? `and t.product_code='${request.input("filter_product")}'`
					: "";
				const f_status = request.input("filter_status")
					? `and tref.status='${request.input("filter_status")}'`
					: "";
				const f_user = request.input("filter_user")
					? `and t.buyer_id='${request.input("filter_user")}'`
					: "";
				let initial_db;
				let records_total;
				let records_filtered;
				let query = `
					SELECT
						t.created_at,
						t.id,
						t.product_code,
						t.target,
						t.cost,
						t.sell_price,
						t.denom,
						t.origin_price,
						u.fullname,
						u.msisdn,
						tref.status,
						(t.sell_price - t."cost") as profit,
						s.supplier_code,
						t.discount
					FROM (
						SELECT th1.*, th2.status AS refstatus, to_char(th1.created_at, 'YYYY-MM-DD') AS thday
						FROM transaction_histories th1
						LEFT JOIN transaction_histories th2 ON th2.trx_id=th1.trx_id AND th2.created_at > th1.created_at
						WHERE th2.status IS null
						order by th1.created_at asc
					) as tref
					join transactions as t on t.id=tref.trx_id
					left join users as u on t.buyer_id=u.id
					left join supplies as s on t.supply_id=s.id
					where
						t.created_at between '${start}' and '${end}'
						and (t.id ILIKE '%${search}%' or t.target ILIKE '%${search}%' or u.fullname ILIKE '%${search}%')
						${f_product}
						${f_status}
						${f_supplier}
						${f_user}`;

				let init_query = `
					SELECT
						count(*) as jumlah
					FROM (
						SELECT th1.*, th2.status AS refstatus, to_char(th1.created_at, 'YYYY-MM-DD') AS thday
						FROM transaction_histories th1
						LEFT JOIN transaction_histories th2 ON th2.trx_id=th1.trx_id AND th2.created_at > th1.created_at
						WHERE th2.status IS null
						order by th1.created_at asc
					) as tref
					join transactions as t on t.id=tref.trx_id
          left join users as u on t.buyer_id=u.id
          left join supplies as s on t.supply_id=s.id
					where 
						t.created_at between '${start}' and '${end}'
						${f_product}
						${f_status}`;

				if (auth.user.type === "STAFF") {
					const query_count = `
							${init_query}
							${f_supplier}
							${f_user}`;

					records_total = await Database.raw(query_count);
					records_filtered = records_total.rows[0].jumlah;
					if (search) {
						const res_search = await Database.raw(
							query_count +
								` and (t.id ILIKE '%${search}%' or t.target ILIKE '%${search}%' or u.fullname ILIKE '%${search}%')`
						);
						records_filtered = res_search.rows[0].jumlah;
					}
					initial_db = await Database.raw(`
						${query}
						order by ${field_order} ${type_order}
						offset ${start_dt} limit ${length_dt}`);
				} else if (auth.user.type === "SUPPLIER") {
					const query_count = `
							${init_query}
							and s.supplier_code='${auth.user.supplier_code}'`;
					records_total = await Database.raw(`
						${init_query}
						and s.supplier_code='${auth.user.supplier_code}'`);
					records_filtered = records_total.rows[0].jumlah;
					if (search) {
						const res_search = await Database.raw(
							query_count +
								` and (t.id ILIKE '%${search}%' or t.target ILIKE '%${search}%' or u.fullname ILIKE '%${search}%')`
						);
						records_filtered = res_search.rows[0].jumlah;
					}
					initial_db = await Database.raw(`
						${query}
						and s.supplier_code='${auth.user.supplier_code}'
						order by ${field_order} ${type_order}
						offset ${start_dt} limit ${length_dt}`);
				} else if (auth.user.type === "BUYER") {
					const query_count = `
						${init_query}
						and t.buyer_id='${auth.user.id}'`;
					records_total = await Database.raw(`
						${init_query}
						and t.buyer_id='${auth.user.id}'`);
					records_filtered = records_total.rows[0].jumlah;
					if (search) {
						const res_search = await Database.raw(
							query_count +
								` and (t.id ILIKE '%${search}%' or t.target ILIKE '%${search}%' or u.fullname ILIKE '%${search}%')`
						);
						records_filtered = res_search.rows[0].jumlah;
					}
					initial_db = await Database.raw(`
						${query}
						and t.buyer_id='${auth.user.id}'
						order by ${field_order} ${type_order}
						offset ${start_dt} limit ${length_dt}`);
				}

				const datas = initial_db.rows.map((data) => {
					return {
						...data,
						supplier_code:
							data.supplier_code === "AS2IN1MOBILE"
								? "TELIN HK"
								: data.supplier_code === "MKIOS" ? "MKIOS AS2IN1" : data.supplier_code
					};
				});

				const data_res = {
					draw: draw,
					recordsTotal: records_total.rows[0].jumlah,
					recordsFiltered: records_filtered,
					data: datas
				};
				return response.status(200).json(data_res);
			}
			// end of ajax datatable

			const productCode = await Catalog.query().select("code").fetch();
			if (auth.user.type === "STAFF") {
				const supplier = await supplies.query().select("supplier_code").groupBy("supplier_code").fetch();
				const remappedSupplier = supplier.rows.map((sp) => {
					return {
						supplier_code: sp.supplier_code,
						display_name:
							sp.supplier_code === "AS2IN1MOBILE"
								? "TELIN HK"
								: sp.supplier_code === "MKIOS" ? "MKIOS AS2IN1" : sp.supplier_code
					};
				});
				return view.render("pages.purchaseLog", {
					select_supplier: remappedSupplier,
					product_code: productCode.toJSON()
				});
			} else {
				return view.render("pages.purchaseLog", {
					product_code: productCode.toJSON()
				});
			}
		} catch (error) {
			return response.json({
				error: error
			});
		}
	}

	async sumTransaction({ request, response }) {
		try {
			const { startdate, enddate } = request.all();
			// const start = moment(startdate).startOf("day");
			// const end = moment(enddate).endOf("day");

			const start = startdate
				? moment(startdate, "YYYY-MM-DD").startOf("day").toISOString()
				: moment().startOf("month").toISOString();
			const end = enddate
				? moment(enddate, "YYYY-MM-DD").endOf("day").toISOString()
				: moment().endOf("month").toISOString();

			const f_supplier = request.input("filter_supplier")
				? `and s.supplier_code='${request.input("filter_supplier")}'`
				: "";
			const f_product = request.input("filter_product")
				? `and t.product_code='${request.input("filter_product")}'`
				: "";
			const f_status = request.input("filter_status")
				? `and tref.status='${request.input("filter_status")}'`
				: "";
			const f_user = request.input("filter_user")
				? `and t.buyer_id='${request.input("filter_user")}'`
				: "";

			let query = `
			SELECT
				sum(t."cost") as sum_cost,
				sum(t.sell_price) as sum_sell_price,
				sum(t.sell_price - t."cost") as sum_profit
			FROM (
				SELECT th1.*, th2.status AS refstatus, to_char(th1.created_at, 'YYYY-MM-DD') AS thday
				FROM transaction_histories th1
				LEFT JOIN transaction_histories th2 ON th2.trx_id=th1.trx_id AND th2.created_at > th1.created_at
				WHERE th2.status IS null
				order by th1.created_at asc
			) as tref
			join transactions as t on t.id=tref.trx_id
			left join supplies as s on t.supply_id=s.id
			where 
				t.created_at between '${start}' and '${end}'
				${f_product}
				${f_status}
				${f_supplier}
				${f_user}
			`;

			const sum_transaction = (await Database.raw(query)).rows;
			// total profit/total sell price*100
			const percent = 100 * Number(sum_transaction[0].sum_profit) / Number(sum_transaction[0].sum_sell_price);

			const res = {
				cost: numeral(Number(sum_transaction[0].sum_cost)).format("0,0.00"),
				profit: numeral(Number(sum_transaction[0].sum_profit)).format("0,0.00"),
				sell_price: numeral(Number(sum_transaction[0].sum_sell_price)).format("0,0.00"),
				percent: numeral(Number(percent)).format("0,0.00")
			};
			return response.json(res);
		} catch (error) {
			return response.json(error);
		}
	}

	async showRange({ view, auth, request, response }) {
		if (auth.user.type === "STAFF") {
			const start = request.all().startdate;
			const end = request.all().enddate;
			const transactions = await transaction
				.query()
				.whereBetween("transactions.created_at", [ start, end ])
				.with("histories")
				.with("supply")
				.fetch();
			return view.render("pages.purchaseLogs", {
				data: transactions.toJSON(),
				start: start,
				end: end
			});
		} else if (auth.user.type === "SUPPLIER") {
			const start = request.all().startdate;
			const end = request.all().enddate;
			const transactions = await transaction
				.query()
				.whereBetween("transactions.created_at", [ start, end ])
				.with("histories")
				.whereHas("supply", (builder) => {
					builder.where("supplier_code", auth.user.supplier_code);
				})
				.fetch();
			// console.log(auth.user.supplier_code)
			return view.render("pages.purchaseLog", {
				data: transactions.toJSON()
			});
		} else if (auth.user.type === "BUYER") {
			const start = request.all().startdate;
			const end = request.all().enddate;
			const transactions = await transaction
				.query()
				.whereBetween("transactions.created_at", [ start, end ])
				.with("histories")
				.with("user")
				.whereHas("user", (builder) => {
					builder.where("id", auth.user.id);
				})
				.fetch();
			return view.render("pages.purchaseLog", {
				data: transactions.toJSON()
			});
		}
	}
	async data({ request, response, view, auth }) {
		if (auth.user.type === "STAFF") {
			let pagination = request.only([ "page", "limit" ]);
			const page = parseInt(pagination.page, 10) || 1;
			const limit = parseInt(pagination.limit, 10) || 10;
			const transactions = await Database.select("*")
				.from("transactions")
				.innerJoin("transaction_histories", "transactions.id", "transaction_histories.trx_id")
				.leftJoin("users", "transactions.buyer_id", "users.id")
				.innerJoin("supplies", "transactions.supply_id", "supplies.id")
				.orderBy("transactions.created_at")
				.paginate(page, limit);
			return response.json(transactions);
		} else if (auth.user.type === "BUYER") {
			const transaction = await Database.select("*")
				.from("transactions")
				.leftJoin("transactions", "transaction_histories.trx_id", "transactions.id")
				.leftJoin("users", "transactions.buyer_id", "users.id")
				.where("users.type", "BUYER");
			return view.render("pages.purchaseLog", {
				data: transaction
			});
		} else if (auth.user.type === "SUPPLIER") {
			const transaction = await Database.select("*")
				.from("transactions")
				.leftJoin("transactions", "transaction_histories.trx_id", "transactions.id")
				.leftJoin("users", "transactions.buyer_id", "users.id")
				.where("users.type", "SUPPLIER");
			return view.render("pages.purchaseLog", {
				data: transaction
			});
		}
	}

	async show({ params, view, response, request, auth }) {
		try {
			const knownUser = auth.user;
			if (request.ajax()) {
				let [ Histories, detailModal ] = await Promise.all([
					TransactionHistories.query().orderBy("created_at", "asc").where("trx_id", params.id).fetch(),
					transaction.query().select("poin", "order_id", "product_code").where("id", params.id).fetch()
				]);
				const detailObj = detailModal.toJSON();
				const formattedData = Histories.rows.map((data) => {
					let info_data = knownUser.type === "STAFF" || knownUser.type === "SUPPLIER" ? data.data : {};
					// user B2B
					if (
						knownUser.type === "BUYER" &&
						knownUser.is_partner !== null &&
						knownUser.is_partner !== "0" &&
						data.status === "SUCCESS"
					) {
						switch (request.get().product_code) {
							case "PLN":
								if (!data.data) break;
								info_data = {
									token: data.data.token,
									meter_number: data.data.meter_number,
									info: data.data.data.info_text || ""
								};
								break;
							case "ALFAMART":
								if (!data.data) break;
								info_data = {
									voucher: data.data.serialNo
								};
								break;
							default:
								info_data = {};
								break;
						}
					}
					return {
						created_at: data.created_at,
						status: data.status,
						remark: data.remark === null ? "" : data.remark,
						data: info_data
					};
				});
				return response.json({
					list: formattedData,
					detail: detailObj
				});
			}
		} catch (error) {
			return response.json(error);
		}

		// const Histories = await TransactionHistories.query()
		//   .where("trx_id", params.id)
		//   .fetch();

		// const formattedData = Histories.rows.map(data => {
		//   return {
		//     created_at: moment(data.created_at).format("YYYY-MM-DD HH:mm:ss.SSS"),
		//     status: data.status,
		//     remark: data.remark === null ? "" : data.remark,
		//     data: data.data
		//   };
		// });
		// return view.render("pages.detailTransaction", {
		//   data: formattedData,
		//   trx_id: params.id
		// });
	}

	async override({request, response}){
		try {
			let {dataOverride, idTrx, remarkOverride, statusOverride} = request.get();
			const dataJson = dataOverride ? JSON.parse(dataOverride) : null;
			if (statusOverride !== 'SUCCESS' && statusOverride !== 'FAILED') return response.send({status: false, message: "Status can't be empty!"});
			const transaction = (await Transaction
				.query()
				.with('histories', builder => {
					builder.setVisible(['status'])
						.orderBy('created_at', 'desc')
				})
				.where('id', idTrx)
				.fetch()).toJSON();
			const check = transaction[0].histories[0].status;
			if (check === 'SUCCESS' || check === 'FAILED')
				return response.send({status: false, message: `Status already "${check}"`});
			
			const new_histo = new TransactionHistories();
			new_histo.trx_id = idTrx;
			new_histo.status = statusOverride;
			new_histo.remark = remarkOverride || null;
			new_histo.data = dataJson;
			await new_histo.save();
			console.log(`Override ${idTrx} => table transaction_histories: ${JSON.stringify(new_histo)}`)
			if (statusOverride === 'FAILED'){
				const refund = new Ledger();
				refund.transaction_ref = new_histo.id;
				refund.user_id = transaction[0].buyer_id;
				refund.credit = transaction[0].sell_price;
				refund.debit = 0;
				await refund.save();
				console.log(`Override ${idTrx} => table ledger: ${JSON.stringify(refund)}`)
			}
			return response.send({status: true});
		} catch (error) {
			console.log(`Error override transaction: ${error.name}: ${error.message}`)
			return response.status(400).send(`${error.name}: ${error.message}`);
		}
	}

	async coba({ params, view, response }) {
		const transactions = await transaction.query().with("histories").fetch();
		return view.render("pages.try", {
			data: transactions.toJSON()
		});
	}
}

module.exports = TransactionHistoryController;
