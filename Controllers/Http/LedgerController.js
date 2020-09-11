"use strict";
const Ledger = use("App/Models/Ledger");
const Database = use("Database");
const LedgerBalance = use("App/Models/LedgerBalance");
const user = use("App/Models/User");
const moment = require("moment");

class LedgerController {
	async index({ view, request, response, auth }) {
		try {
			let { startdate, enddate } = request.all();
			const start = startdate
				? moment(startdate).startOf("day").toISOString()
				: moment().startOf("month").toISOString();
			const end = enddate ? moment(enddate).endOf("day").toISOString() : moment().endOf("month").toISOString();

			if (request.ajax()) {
				const draw = request.input("draw");
				const start_dt = request.input("start");
				const length_dt = request.input("length");
				const field_order = request.input("columns[" + request.input("order[0][column]") + "][data]");
				const type_order = request.input("order[0][dir]");
				const search = request.input("search[value]");
				const table_model = "ledgers as l";

				const req_user = request.input("filter_user");
				let init = Database.table(table_model)
					.select(
						"u.fullname",
						"l.credit",
						"l.debit",
						"l.created_at",
						Database.raw("coalesce(th.trx_id, d.payment_id, '') as reference"),
						Database.raw("coalesce(l.remark, '') as remark"),
					)
					.leftJoin("users as u", "l.user_id", "u.id")
					.leftJoin("deposit_logs as d", "l.deposit_ref", "d.id")
					.leftJoin("transaction_histories as th", "l.transaction_ref", "th.id")
					.whereBetween("l.created_at", [ start, end ])
					.whereRaw(
						`(
            l.credit::text ILIKE '%${search}%'
            or l.debit::text ILIKE '%${search}%'
            or coalesce(th.trx_id, d.payment_id, '') ILIKE '%${search}%'
            or coalesce(l.remark, '') ILIKE '%${search}%'
            )`,
					)
					.orderBy(field_order, type_order);
				init = req_user ? init.where("l.user_id", req_user) : init;

				let initial_db;
				let records_total;
				let records_filtered;
				let init_total_record = Database.table(table_model)
					.select("l.credit")
					.leftJoin("users as u", "l.user_id", "u.id")
					.leftJoin("transaction_histories as th", "l.transaction_ref", "th.id")
					.whereBetween("l.created_at", [ start, end ]);

				if (auth.user.type === "STAFF") {
					let init_count = Database.table(table_model).whereBetween("l.created_at", [ start, end ]);
					init_count = req_user ? init_count.where("l.user_id", req_user) : init_count;
					records_total = await init_count.getCount();
					records_filtered = search ? await init.getCount() : records_total;

					init = req_user ? init.where("l.user_id", req_user) : init;
					initial_db = await init.offset(start_dt).limit(length_dt);
				} else if (auth.user.type === "BUYER") {
					records_total = await init_total_record.whereRaw("l.user_id = ?", auth.user.id).getCount();
					records_filtered = search ? await init.getCount() : records_total;
					initial_db = await init.offset(start_dt).limit(length_dt).whereRaw("l.user_id = ?", auth.user.id);
				} else if (auth.user.type === "SUPPLIER") {
					let init_total = req_user ? init_total_record.where("l.user_id", req_user) : init_total_record;
					records_total = await init_total
						.leftJoin("transactions as t", "th.trx_id", "t.id")
						.leftJoin("supplies as s", "t.supply_id", "s.id")
						.whereRaw("coalesce(s.supplier_code,u.supplier_code,'') = ?", auth.user.supplier_code)
						.getCount();
					records_filtered = search ? await init.getCount() : records_total;

					init = req_user ? init.where("l.user_id", req_user) : init;
					initial_db = await init
						.offset(start_dt)
						.limit(length_dt)
						.leftJoin("transactions as t", "th.trx_id", "t.id")
						.leftJoin("supplies as s", "t.supply_id", "s.id")
						.whereRaw("coalesce(s.supplier_code,u.supplier_code,'') = ?", auth.user.supplier_code);
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

			return view.render("pages.statement");
		} catch (error) {
			return response.json({ error: error });
		}
	}

	async showRange({ request, response, view, auth }) {
		if (auth.user.type === "STAFF") {
			const start = moment(request.all().startdate).startOf("day").toISOString();
			const end = moment(request.all().enddate).endOf("day").toISOString();
			const ledger = await Ledger.query()
				.with("deposit")
				.with("transactionHistory")
				.with("user")
				.whereBetween("ledgers.created_at", [ start, end ])
				.orderBy("ledgers.created_at", "desc")
				.fetch();
			const formattedLedger = ledger.rows.map((data) => {
				data = data.toJSON();
				return {
					fullname: data.user.fullname,
					credit: data.credit,
					debit: data.debit,
					reference:
						data.transactionHistory !== null
							? data.transactionHistory.trx_id
							: data.deposit !== null ? data.deposit.payment_id : "",
					remark: data.remark === null ? "" : data.remark,
					created_at: data.created_at,
				};
			});
			return view.render("pages.statements", {
				data: formattedLedger,
				start: start,
				end: end,
			});
		} else if (auth.user.type === "SUPPLIER") {
			const start = moment(request.all().startdate).startOf("day").toISOString();
			const end = moment(request.all().enddate).endOf("day").toISOString();
			const ledger = await Ledger.query()
				.with("transactionHistory")
				.with("user")
				.whereHas("user", (builder) => {
					builder.where("id", auth.user.id);
				})
				.whereBetween("ledgers.created_at", [ start, end ])
				.orderBy("ledgers.created_at", "desc")
				.fetch();
			const formattedLedger = ledger.rows.map((data) => {
				data = data.toJSON();
				return {
					fullname: data.user.fullname,
					credit: data.credit,
					debit: data.debit,
					reference:
						data.transactionHistory !== null
							? data.transactionHistory.trx_id
							: data.deposit !== null ? data.deposit.payment_id : "",
					remark: data.remark === null ? "" : data.remark,
					created_at: data.created_at,
				};
			});
			return view.render("pages.statements", {
				data: formattedLedger,
				start: start,
				end: end,
			});
		} else if (auth.user.type === "BUYER") {
			const start = moment(request.all().startdate).startOf("day").toISOString();
			const end = moment(request.all().enddate).endOf("day").toISOString();
			const ledger = await Ledger.query()
				.with("deposit")
				.with("transactionHistory")
				.with("user")
				.whereHas("user", (builder) => {
					builder.where("id", auth.user.id);
				})
				.whereBetween("ledgers.created_at", [ start, end ])
				.orderBy("ledgers.created_at", "desc")
				.fetch();
			console.log(ledger);
			const formattedLedger = ledger.rows.map((data) => {
				data = data.toJSON();
				return {
					fullname: auth.user.fullname,
					credit: data.credit,
					debit: data.debit,
					reference:
						data.transactionHistory !== null
							? data.transactionHistory.trx_id
							: data.deposit !== null ? data.deposit.payment_id : "",
					remark: data.remark === null ? "" : data.remark,
					created_at: data.created_at,
				};
			});
			//return response.json(ledger)
			return view.render("pages.statement", {
				data: formattedLedger,
				start: start,
				end: end,
			});
		}
	}
}

module.exports = LedgerController;
