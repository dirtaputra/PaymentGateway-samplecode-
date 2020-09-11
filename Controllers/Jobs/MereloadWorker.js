const delay = require("delay");

const Event = use("Event");
const Transaction = use("App/Models/Transaction");
const TransactionHistory = use("App/Models/TransactionHistory");
const BK = use("App/Common/BalanceKeeper");
const MereloadPlugin = use("App/Common/Supplier/MeReloadPlugin");
const Logger = use("Logger");
const serializeError = require("serialize-error");
const Env = use("Env");
const Mail = use("Mail");
const moment = use("moment");
const numeral = require("numeral");
const CatalogKeeper = use("App/Common/CatalogKeeper");
const FailOver = use("App/FailOver/Prepaid");

class MereloadWorker {
	get concurrency() {
		return 1;
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
			console.log("MereloadWorker");
			console.log(job.data);
			if (job.data.state === "TRANSACTION_MERELOAD") return await this.invokeTransaction(job);
			if (job.data.state === "STATUS") return await this.queryStatus(job);
		} catch (e) {
			Logger.warning("MereloadWorker", serializeError(e));
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
	async invokeTransaction(job) {
		const jobData = job.data;
		const refID = await CatalogKeeper.generateRefID();
		const trxDataObj = await fetchTrxData(jobData.trxId);
		const trxData = trxDataObj.toJSON();
		console.log("trxData: ", trxData);
		const inputData = Object.assign({
			ref: refID,
			category: trxData.supply.category,
			target: trxData.target,
			productCode: trxData.supply.supplier_product_id.productCode,
			denom: numeral(trxData.denom)._value.toString()
		});
		console.log("inputData: ", inputData);
		const status = await MereloadPlugin.requestTopup(inputData);
		console.log("mereload response: ", status);
		if (status.status === "1") {
			status.refID = inputData.ref;
			const pendingHistory = await TransactionHistory.create({
				trx_id: jobData.trxId,
				status: "PENDING",
				data: status
			});
			Event.fire("MERELOAD::STATUS", {
				trxId: jobData.trxId,
				refID: inputData.ref
			});
			return status;
		} else {
			// check the possibility to continue the transaction using other supplier
			const failOver = await FailOver.checkRules({
				facts: {
					supplier: "MERELOAD",
					rc: "F"
				},
				trxId: jobData.trxId
			});

			if (failOver) {
				return `FAILED : ${inputData.ref}. Retry the transaction using other supplier`;
			}
			//
			console.log("FAILED : ", inputData.ref);
			status.refID = inputData.ref;
			const failedHistory = await TransactionHistory.create({
				trx_id: jobData.trxId,
				status: "FAILED",
				remark: "Transaction not found",
				data: status
			});
			await this.refundBalance(trxData.buyer_id, failedHistory.id, trxData.sell_price);
			notifyDone(trxData, failedHistory);
			return status;
		}
	}

	async queryStatus(job) {
		const mail = Env.get("TRANGLO_PROBLEM_EMAIL_1");
		const mail2 = Env.get("TRANGLO_PROBLEM_EMAIL_2");
		const jobData = job.data;
		const trxDataObj = await fetchTrxData(jobData.trxId);
		const trxData = trxDataObj.toJSON();
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
		console.log("refID: ", jobData.refID);
		const inputData = Object.assign({
			ref: jobData.refID
		});
		const status = await MereloadPlugin.checkStatus(inputData);
		console.log(status);
		if (status.Date === "1") {
			status.refID = jobData.refID;
			recentHistory.status = "PENDING";
			recentHistory.remark = job.attemptsMade;
			recentHistory.data = status;
			recentHistory.save();
			if (job.attemptsMade + 1 < job.opts.attempts) {
				Logger.info("throw on queryStatus:" + jobData.trxId, status);
				throw new Error(jobData.trxId);
			} else {
				/// kalau sudah limit dibuat FAILED dan dilakukan REFUND
				// const failedHistory = await TransactionHistory.create({
				//   trx_id: jobData.trxId,
				//   status: "FAILED",
				//   remark: "Manual Check to me reload",
				//   data: status
				// });
				status.reason = "More than 30 minutes, Please wait..";
				recentHistory.status = "PENDING";
				recentHistory.remark = "Manual Check to Mereload";
				recentHistory.data = status;
				recentHistory.save();
				const emailrp = await Mail.send(
					"emails.Mereload",
					{
						datetime: moment().utcOffset("+08:00").format("DD-MMM-YYYY HH:mm:ss ZZ"),
						refID: jobData.refID,
						dealer_txn: jobData.trxId,
						remark: "Transaction Hold on Mereload please manual cek"
					},
					(message) => {
						message.subject(`Transaction hold on Mereload ${jobData.refID}`);
						message.from("rpg.telinmy@yandex.com", "RPG Platform - TelinMY");
						message.to(mail);
						message.to(mail2);
						///stage 2 email
					}
				);
				// refund Balance
				//await this.refundBalance(trxData.buyer_id, failedHistory.id, trxData.sell_price);
			}
			return status;
		} else {
			if (status.Status === "S" || status.Status === "s") {
				const successHistory = await TransactionHistory.create({
					trx_id: jobData.trxId,
					status: "SUCCESS",
					data: status
				});
				notifyDone(trxData, successHistory);
				return status;
			} else if (status.Status === "F" || status.Status === "f") {
				// check the possibility to continue the transaction using other supplier
				const failOver = await FailOver.checkRules({
					facts: {
						supplier: "MERELOAD",
						rc: status.Status.toUpperCase()
					},
					trxId: jobData.trxId
				});

				if (failOver) {
					return `status message : ${status.StatusMessage}. Retry the transaction using other supplier`;
				}
				//

				status.reason = status.StatusMessage;
				const failedHistory = await TransactionHistory.create({
					trx_id: jobData.trxId,
					status: "FAILED",
					remark: status.StatusMessage,
					data: status
				});
				await this.refundBalance(trxData.buyer_id, failedHistory.id, trxData.sell_price);
				notifyDone(trxData, failedHistory);
				return status;
			}
			return status;
		}
	}
}

module.exports = MereloadWorker;

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
