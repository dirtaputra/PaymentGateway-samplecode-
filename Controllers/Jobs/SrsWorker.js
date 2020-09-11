const delay = require("delay");

const Event = use("Event");
const Transaction = use("App/Models/Transaction");
const TransactionHistory = use("App/Models/TransactionHistory");
const BK = use("App/Common/BalanceKeeper");
const srsPlugin = use("App/Common/Supplier/SrsPlugin");
const Logger = use("Logger");
const serializeError = require("serialize-error");

class SampleJob {
	get concurrency() {
		return 2;
	}

	get backoffStrategy() {
		return {
			settings: {
				backoffStrategies: {
					checkStatus: function(attemptsMade, err) {
						if (attemptsMade <= 36) return 1000 * 5; // less than 3 mins: 5s delay
						if (36 < attemptsMade && attemptsMade <= 78) return 1000 * 10; // 3rd - 10th min: 10s delay
						if (78 < attemptsMade && attemptsMade <= 118) return 1000 * 15; // 10th - 20th min: 15s delay
						if (118 < attemptsMade && attemptsMade <= 198)
							return 1000 * 30; // 20th - 60th min: 30s delay
						else return 1000 * 60 * 2;
					}
				}
			}
		};
	}

	async handler(job) {
		try {
			console.log("SrsWorker");
			console.log(job.data);
			if (job.data.state === "PURCHASE") return await this.invokePurchase(job);
			if (job.data.state === "PINREQ") return await this.queryPin(job);
			if (job.data.state === "STATUS") return await this.queryStatus(job);
		} catch (e) {
			Logger.warning("SrsWorker", serializeError(e));
			throw e;
		}
	}

	/**
   * Refund for FAILED Transaction
   */
	async refundBalance(buyerId, historyId, amount) {
		await BK.add({
			userId: buyerId,
			amount,
			trxRef: historyId,
			depositRef: null
		});
	}

	/**
   * HANDLER untuk Purchase Request
   */
	async invokePurchase(job) {
		const jobData = job.data;
		const trxDataObj = await fetchTrxData(jobData.trxId);
		const trxData = trxDataObj.toJSON();
		//
		const requestData = Object.assign(
			{
				product_price: trxData.denom,
				customer_account_number: trxData.target,
				customer_mobile_number: trxData.target
			},
			trxData.supply.supplier_product_id
		);
		const { statusCode, data } = await srsPlugin.requestTopup(requestData);
		/// if not submit_success
		if (data.status != "SUBMIT_SUCCESS") {
			// if attempt less than scheduled, just let it FAIL
			if (job.attemptsMade + 1 < job.opts.attempts) {
				Logger.info("throw on invokePurchase:" + jobData.trxId, data);
				throw new Error(data.status || statusCode);
			} else {
				// log in History as Failed
				data.reason = data.status;
				const failedHistory = await TransactionHistory.create({
					trx_id: jobData.trxId,
					status: "FAILED",
					remark: data.status,
					data
				});
				// refund Balance
				await this.refundBalance(trxData.buyer_id, failedHistory.id, trxData.sell_price);
				// notify for FAILURE
				notifyDone(trxData, failedHistory);
			}
			return data;
		} else {
			// log in History as PENDING. Request has been submitted.
			await TransactionHistory.create({
				trx_id: jobData.trxId,
				status: "PENDING",
				data
			});
			/// save supplier_trx_id
			trxDataObj.supplier_trx_id = data.response_id;
			await trxDataObj.save();
			/// reschedule event
			if ([ "ELOAD", "BILL" ].includes(trxData.supply.category)) {
				/// queryStatus untuk ELOAD dan BILL
				Event.fire("SRS::STATUS", jobData.trxId);
			} else if ([ "PIN" ].includes(trxData.supply.category)) {
				/// requestPIN untuk PIN
				Event.fire("SRS::PINREQ", jobData.trxId);
			}
			return data;
		}
	}

	/**
   * HANDLER untuk query PIN
   */
	async queryPin(job) {
		const jobData = job.data;
		const trxData = (await fetchTrxData(jobData.trxId)).toJSON();
		//console.log(trxData);
		const { statusCode, data } = await srsPlugin.getReloadPINImmediate(trxData.supplier_trx_id);
		// data.pin exists
		Logger.warning(`SRS:queryPin ${jobData.trxId}`, data);
		if (data.pin) {
			const successHistory = await TransactionHistory.create({
				trx_id: jobData.trxId,
				status: "SUCCESS",
				data
			});
			// notify for SUCCESS
			notifyDone(trxData, successHistory);
		} else {
			/// throw FAIL, shall retry later
			throw new Error(data.status || statusCode);
		}
		return data;
	}

	/**
   * HANDLER untuk query Status
   */
	async queryStatus(job) {
		const jobData = job.data;
		const trxData = (await fetchTrxData(jobData.trxId)).toJSON();
		const recentHistory = (await TransactionHistory.query()
			.where("trx_id", jobData.trxId)
			.orderBy("created_at", "desc")
			.fetch()).first();
		// check status
    const check = ["SUCCESS","FAILED"].includes(recentHistory.status);
    if (check) {
      const status_latest = recentHistory.toJSON();
      Logger.info("Done queryStatus:", status_latest);
      notifyDone(trxData, status_latest);
      return status_latest;
    }
		//
		const { statusCode, data } = await srsPlugin.checkTransactionStatus(trxData.supplier_trx_id);
		/// check transaction flow
		const isFinalStatus = [ "SUCCESS", "FAILED" ].includes(recentHistory.status);
		Logger.info("SRS-queryStatus: " + jobData.trxId, {
			statusCode,
			data,
			isFinalStatus,
			recentHistory
		});
		if ((data.status === recentHistory.status || data.status === "COMPLETED") && !isFinalStatus) {
			/// jika recent_status(PENDING) == live_status(PENDING) dan belum SUCCESS/FAILED --> update created_at
			recentHistory.status = "PENDING";
			recentHistory.remark = job.attemptsMade;
			recentHistory.save();
			// Let it FAIL jika attempt masih dibawah limit
			if (job.attemptsMade + 1 < job.opts.attempts) {
				Logger.info("throw on queryStatus:" + jobData.trxId, data);
				throw new Error(data.status || statusCode);
			} else {
				/// kalau sudah limit dibuat FAILED dan dilakukan REFUND
				const failedHistory = await TransactionHistory.create({
					trx_id: jobData.trxId,
					status: "FAILED",
					data
				});
				// refund Balance
				await this.refundBalance(trxData.buyer_id, failedHistory.id, trxData.sell_price);
			}
			//
		} else if (data.status === "SUCCESS") {
			// jika live_status adalah SUCCESS (ekivalen SUCCESS di RPG) --> save new history to success
			const successHistory = await TransactionHistory.create({
				trx_id: jobData.trxId,
				status: "SUCCESS",
				data
			});
			// notify for SUCCESS
			notifyDone(trxData, successHistory);
		} else if (data.status === "REFUNDED") {
			// jika live_status adalah REFUNDED (ekivalen FAILED di RPG) --> save new history to FAILED
			const failedHistory = await TransactionHistory.create({
				trx_id: jobData.trxId,
				status: "FAILED",
				//remark: reason,
				data
			});
			// refund Balance
			await this.refundBalance(trxData.buyer_id, failedHistory.id, trxData.sell_price);
			// notify for FAILED
			notifyDone(trxData, failedHistory);
		} else {
			// let it FAIL
			throw new Error(data.status || statusCode);
		}
		return data;
	}
}

module.exports = SampleJob;

/**
 *  Fetch trx data and supply Info
 */
async function fetchTrxData(id) {
	return (await Transaction.query().where("id", id).with("supply").fetch()).first();
}

/**
 * notify is DONE.. Might be failed or success
 */
async function notifyDone(trxData, recentHistory) {}
