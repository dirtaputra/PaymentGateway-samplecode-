const Poin = use("App/Models/Poin");
const bbPromise = require("bluebird");
const Transaction = use("App/Models/Transaction");
const CatalogDetail = use("App/Models/CatalogDetail");
const TransactionHistory = use("App/Models/TransactionHistory");
const BK = use("App/Common/BalanceKeeper");
const moment = require("moment");
const Database = use("Database");
const numeral = require("numeral");

const Env = use("Env");

class PoinKeeper {
	async add({ price, user_id, trxId }) {
		const validity = Env.get("POIN_VALIDITY");
		const index = moment().format("YYYY MM");
		const expiry = moment().add(validity, "month").endOf("month").toISOString();
		//
		const detailsProduct = await Transaction.findBy("id", trxId);
		const [ existingPoin, poinConf ] = await Promise.all([
			Poin.query().where("index", index).where("user_id", user_id).first(),
			CatalogDetail.query()
				.where("product_code", detailsProduct.product_code)
				.where("sub_id", detailsProduct.sub_id)
				.where("status", "ENABLE")
				.where(function() {
					this.where(function() {
						this.where("denom", Number(detailsProduct.denom)).whereNull("min");
					}).orWhere(function() {
						this.where("min", "<=", Number(detailsProduct.denom)).where(
							"denom",
							">=",
							Number(detailsProduct.denom),
						);
					});
				})
				.first(),
		]);
		// setup POIN divider
		const divider = poinConf.poin.divider ? poinConf.poin.divider : Env.get("POIN_DIVIDER");
		//
		if (existingPoin) {
			// index exist, update POIN
			const currPoint = Number(existingPoin.poin);
			existingPoin.poin = currPoint + Number(price / divider);
			await existingPoin.save();
			return {
				current_poin: currPoint,
				sell_price: price,
				divider: divider,
				added_poin: numeral(Number(price / divider)).format("0.00"),
			};
		} else {
			// index doesn't exist, create new entry
			const savedData = await Poin.create({
				index: index,
				poin: numeral(Number(price / divider)).format("0.00"),
				expiry: expiry,
				user_id: user_id,
			});
			return savedData;
		}
	}

	async deduct({ consumed, user_id }) {
		// get list of available poin
		const [ PoinList, total ] = await Promise.all([
			Poin.query()
				.where("expiry", ">=", moment().toISOString())
				.where("user_id", user_id)
				.orderBy("expiry", "asc")
				.fetch(),
			Poin.query()
				.sum("poin as poin")
				.sum("consumed as consumed")
				.where("expiry", ">=", moment().toISOString())
				.where("user_id", user_id)
				.first(),
		]);
		// check total POIN
		if (Number(total.poin) < Number(total.consumed) + Number(consumed)) {
			return {
				status: "FAIL",
				error: {
					message: `Insufficient POIN, POIN: ${Number(total.poin)}, CONSUMED: ${numeral(
						Number(total.consumed),
					).format("0.00")}, NEED: ${numeral(Number(consumed)).format("0.00")}`,
				},
			};
		}
		// deduct POIN
		const trx = await Database.beginTransaction();
		//
		const deductData = new Array();
		deductData.push({ current_poin: total.poin, current_consumed: total.consumed, need: consumed });
		await bbPromise.map(PoinList.rows, (poinX) => {
			if (Number(poinX.poin) > Number(poinX.consumed) && Number(consumed) > 0) {
				const deduction =
					Number(poinX.poin - poinX.consumed) > Number(consumed)
						? Number(consumed)
						: Number(poinX.poin - poinX.consumed);
				consumed = Number(consumed - deduction);
				deductData.push({
					index: poinX.index,
					poin: Number(poinX.poin),
					deduction: deduction,
					consumed: {
						before: Number(poinX.consumed),
						after: parseFloat(Number(poinX.consumed) + deduction).toFixed(2),
					},
				});
				return Poin.query()
					.where("index", poinX.index)
					.where("user_id", user_id)
					.update({ consumed: parseFloat(Number(poinX.consumed) + deduction).toFixed(2) });
			}
			return;
		});
		// commit DB trans
		trx.commit();
		return { status: "OK", data: deductData };
	}

	async revert({ trxId, poin, discount, buyerId }) {
		const trx = await Database.beginTransaction();
		// update Trans DB
		const [ logTrans, transHist ] = await Promise.all([
			Transaction.query().where("id", trxId).first(),
			TransactionHistory.query().where("trx_id", trxId).orderBy("created_at", "desc").first(),
		]);

		const newSellPrice = parseFloat(Number(logTrans.sell_price) + Number(discount)).toFixed(2);
		logTrans.sell_price = newSellPrice;
		logTrans.poin = 0;
		logTrans.discount = 0;
		const logT = await logTrans.save();
		// update ledgers
		await BK.deduct({
			userId: buyerId,
			amount: discount,
			trxRef: transHist.id,
			remark: `REVERT disc. ${Number(poin)} POIN`,
		});
		// commit transaction
		trx.commit();
		return {
			transData: {
				sell_price: newSellPrice,
				poin: 0,
				discount: 0,
			},
			balanceUpdate: {
				userId: buyerId,
				amount: discount,
				trxRef: transHist.id,
				remark: `REVERT disc. ${Number(poin)} POIN`,
			},
		};
	}
}

module.exports = new PoinKeeper();
