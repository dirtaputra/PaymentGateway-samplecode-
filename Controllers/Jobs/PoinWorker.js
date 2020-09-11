const PK = use("App/Common/PoinKeeper");
const Logger = use("Logger");
const serializeError = require("serialize-error");
const Transaction = use("App/Models/Transaction");
const Event = use("Event");
const Database = use("Database");
const Poin = use("App/Models/Poin");
const bbPromise = require("bluebird");
const moment = require("moment");
const Env = use("Env");
const User = use("App/Models/User");

class PoinWorker {
	get concurrency() {
		return 1;
	}

	get onBoot() {
		return {
			duplicate: false, //
			///
			jobData: {
				state: "INIT",
			},
			jobConfig: {
				delay: 0,
				jobId: "onBoot",
			},
		};
	}

	async handler(job) {
		try {
			console.log("PoinWorker");
			console.log(job.data);
			if (job.data.state === "INIT") return await this.init();
			if (job.data.state === "CHECK") return await this.check(job);
			if (job.data.state === "ADD") return await this.addPOIN(job);
			if (job.data.state === "DEDUCT") return await this.deductPOIN(job);
			if (job.data.state === "REVERT") return await this.revertPOIN(job);
		} catch (e) {
			Logger.warning("PoinWorker", serializeError(e));
			throw e;
		}
	}

	async init() {
		try {
			/**
			 * select date_trunc('month', created_at at time zone 'Asia/Kuala_Lumpur') as trx_month, buyer_id, sum(sell_price) 
			 * from transactions 
			 * group by buyer_id, trx_month 
			 */
			const listUsers = await User.all();
			const result = new Array();
			await bbPromise.map(listUsers.rows, async (userX) => {
				// iterate thru each user
				const listOfPoin = await Transaction.query()
					.select(
						Database.raw("date_trunc('month', created_at at time zone 'Asia/Kuala_Lumpur') as trxmonth"),
					)
					.whereHas(
						"histories",
						(builder) => {
							builder.where("status", "SUCCESS");
						},
						">",
						0,
					)
					.where("buyer_id", userX.id)
					.sum("sell_price as amount")
					.groupBy("trxmonth");
				//
				const validity = Env.get("POIN_VALIDITY");
				const divider = Env.get("POIN_DIVIDER");
				//
				if (listOfPoin.length > 0) {
					const insertedData = await bbPromise.map(listOfPoin, (dataX) => {
						const poin = parseFloat(dataX.amount / divider).toFixed(2);
						const index = moment(dataX.trxmonth).format("YYYY MM");
						const expiry = moment(dataX.trxmonth).add(validity, "month").endOf("month").toISOString();
						return this.insertPoin(index, poin, expiry, userX.id);
					});
					result.push(insertedData);
				} else {
					const poin = 0;
					const index = moment().format("YYYY MM");
					const expiry = moment().add(validity, "month").endOf("month").toISOString();
					const insertedData = await this.insertPoin(index, poin, expiry, userX.id);
					result.push(insertedData);
				}
			});
			return result;
		} catch (e) {
			Logger.warning("PoinWorker:init", serializeError(e));
			throw e;
		}
	}

	async insertPoin(index, poin, expiry, user_id) {
		try {
			const currPoin = await Poin.query().where("index", index).where("user_id", user_id).first();
			if (!currPoin) {
				return await Poin.create({
					index: index,
					poin: poin,
					expiry: expiry,
					user_id: user_id,
				});
			} else {
				return `Bypassed ~ ${index} ~ ${user_id}`;
			}
		} catch (e) {
			Logger.warning("PoinWorker:insertPoin", serializeError(e));
			throw e;
		}
	}

	async check(job) {
		try {
			const jobData = job.data;
			const trxDataObj = await fetchTrxData(jobData.trxId);
			const trxData = trxDataObj.toJSON();
			//
			if (Number(trxData.poin) > 0) {
				// POIN is being used
				Event.fire("POIN:DEDUCT", jobData.trxId);
			} else {
				Event.fire("POIN:ADD", jobData.trxId);
			}
			return trxData;
		} catch (e) {
			Logger.warning("PoinWorker:check", serializeError(e));
			throw e;
		}
	}

	async addPOIN(job) {
		try {
			const jobData = job.data;
			const trxDataObj = await fetchTrxData(jobData.trxId);
			const trxData = trxDataObj.toJSON();
			// add POIN
			const insertedPoin = await PK.add({
				price: trxData.sell_price,
				user_id: trxData.buyer_id,
				trxId: jobData.trxId,
			});
			return insertedPoin;
		} catch (e) {
			Logger.warning("PoinWorker:addPOIN", serializeError(e));
			throw e;
		}
	}

	async deductPOIN(job) {
		try {
			const jobData = job.data;
			const trxDataObj = await fetchTrxData(jobData.trxId);
			const trxData = trxDataObj.toJSON();
			// deduct POIN
			const { status, error, data } = await PK.deduct({ consumed: trxData.poin, user_id: trxData.buyer_id });
			if (status !== "OK") {
				Logger.warning("PoinWorker:deductPOIN", error);
				Event.fire("POIN:REVERT", jobData.trxId);
				return error;
			} else {
				Event.fire("POIN:ADD", jobData.trxId);
			}
			return data;
		} catch (e) {
			Logger.warning("PoinWorker:deductPOIN", serializeError(e));
			throw e;
		}
	}

	async revertPOIN(job) {
		try {
			const jobData = job.data;
			const trxDataObj = await fetchTrxData(jobData.trxId);
			const trxData = trxDataObj.toJSON();
			//
			const data = await PK.revert({
				trxId: jobData.trxId,
				poin: trxData.poin,
				discount: trxData.discount,
				buyerId: trxData.buyer_id,
			});
			Event.fire("POIN:ADD", jobData.trxId);
			return data;
		} catch (e) {
			Logger.warning("PoinWorker:revertPoin", serializeError(e));
			throw e;
		}
	}
}

module.exports = PoinWorker;

/**
 *  Fetch trx data and supply Info
 */
async function fetchTrxData(id) {
	return (await Transaction.query().where("id", id).with("supply").fetch()).first();
}
