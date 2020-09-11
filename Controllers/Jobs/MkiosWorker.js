// @ts-check
const delay = require("delay");
//@ts-ignore
const Event = use("Event");
//@ts-ignore
const Logger = use("Logger");
//@ts-ignore
const Transaction = use("App/Models/Transaction");
//@ts-ignore
const TransactionHistory = use("App/Models/TransactionHistory");
//@ts-ignore
const BK = use("App/Common/BalanceKeeper");
//@ts-ignore
const MkiosPlugin = use("App/Common/Supplier/MkiosPlugin");
// @ts-ignore
const As2in1Mobile = use("App/Common/Supplier/As2in1MobilePlugin");
// @ts-ignore
const FailOver = use("App/FailOver/Prepaid");
const serializeError = require("serialize-error");
const rc_desc = {
	"0": "Success Transaction",
	"1": "Fail Transaction",
	"2": "Transaction Not Found",
	"10": "Parameter request not complete",
	"11": "Invalid denom value",
	"12": "Invalid MSISDN destination number",
	"13": "Invalid RequestID format",
	"14": "Problem user access",
	"15": "Duplicate ReqID",
	"16": "Not Enough Deposit",
	"17": "IP Address not allowed",
	"18": "Invalid Method Request",
	"26": "Insufficient Deposit",
	"69": "late response cause answering more than 14 seconds",
	"81": "B-Phone number is expired",
	"100": "Other error",
	"101": "Transaction is failed",
	"102": "Subscriber not found",
	"103": "Account barred from refill",
	"104": "Temporary blocked",
	"105": "Dedicated account not allowed",
	"109": "Reaches maximum number of daily balance sharing from",
	"115": "Refill not accepted",
	"117": "Service Class not allowed",
	"120": "Invalid refill profile",
	"121": "Supervision period too long",
	"122": "Service fee period too long",
	"123": "Max credit limit exceed",
	"126": "Account not active",
	"136": "Date adjustment error",
	"153": "Dedicated account max credit limit exceeded",
	"160": "Operation not allowed",
	"167": "Invalid unit type",
	"177": "Refill denied, account not active",
	"178": "Refill denied, service fee expired",
	"179": "Refill denied, supervision expired",
	"199": "Transaction Failed",
	"900": "Gateway problem",
	"998": "998 HTTP access not allowed",
	"999": "Time limit transaction exceeded (No Response)"
};
class MkiosWorker {
	get concurrency() {
		return 2;
	}

	async handler(job) {
		try {
			console.log("MkiosWorker");
			console.log(job.data);
			if (job.data.state === "TRANSACTION") return await this.invokeTrx(job);
			if (job.data.state === "STATUS") return await this.queryStatus(job);
			// as 2in1 mobile
			if (job.data.state === "TRANSACTION_AS2IN1MOBILE") return await this.invokeTrxAS(job);
		} catch (e) {
			Logger.warning("MkiosWorker", serializeError(e));
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
	async invokeTrx(job) {
		const jobData = job.data;
		const trxDataObj = await fetchTrxData(jobData.trxId);
		const trxData = trxDataObj.toJSON();
		const isDirectPurchase = trxDataObj.directpay_id ? true : false;
		const { error, id, data } =
			trxData.product_code === "TSEL"
				? await MkiosPlugin.requestTransactionRP(trxData.denom, trxData.target)
				: await MkiosPlugin.requestTransactionRM(trxData.denom, trxData.target);
		///
		if (error) {
			if (job.attemptsMade + 1 < job.opts.attempts) {
				throw new Error(error);
			} else {
				// check possibility of fail over
				const failOver = await FailOver.checkRules({
					facts: {
						supplier: "MKIOS",
						rc: data.rc
					},
					trxId: jobData.trxId
				});

				if (trxData.product_code === "TSEL" && failOver) {
					return `${error}. Retry the transaction using other supplier`;
				}

				let rc;
				let remark;
				let dataTmp = data;
				if (data) {
					rc = data.rc;
					remark = rc_desc[rc];
					data.reason = remark;
				}
				const failedHistory = await TransactionHistory.create({
					trx_id: jobData.trxId,
					status: "FAILED",
					remark: remark,
					data: dataTmp
				});
				/// sudah terdeteksi FAILED
				if (isDirectPurchase === false) {
					// bukan direct purchase, refund saja
					await this.refundBalance(trxData.buyer_id, failedHistory.id, trxData.sell_price);
				} else {
					// fire SHALLRETRY karena DirectPurchase
					Event.fire("DIRECT::SHALLRETRY", {
						trxId: jobData.trxId,
						payId: trxData.directpay_id
					});
				}
				// notify for FAILURE
				notifyDone(trxData, failedHistory);
			}
			return {
				error,
				id
			};
		}
		// if not error, then it is SUCCESS
		await TransactionHistory.create({
			trx_id: jobData.trxId,
			status: "SUCCESS",
			data
		});
		/// save supplier_trx_id
		trxDataObj.supplier_trx_id = id;
		await trxDataObj.save();
		/// reschedule event
		// Event.fire("MKIOS::STATUS", jobData.trxId);
		return {
			error,
			id,
			data
		};
	}

	/**
   * HANDLER untuk query Status
   */
	async queryStatus(job) {
		const jobData = job.data;
		const trxData = (await fetchTrxData(jobData.trxId)).toJSON();
		const isDirectPurchase = trxData.directpay_id ? true : false;
		//
		const recentHistory = (await TransactionHistory.query()
			.where("trx_id", jobData.trxId)
			.orderBy("created_at", "desc")
			.fetch()).first();
		//
		const { id, error, status, data } =
			trxData.product_code === "TSEL"
				? await MkiosPlugin.queryStatusRP(trxData.supplier_trx_id, trxData.denom, trxData.target)
				: await MkiosPlugin.queryStatusRM(trxData.supplier_trx_id, trxData.denom, trxData.target);
		/// check transaction flow
		const historyStatusIsFinal = [ "SUCCESS", "FAILED" ].includes(recentHistory.status);
		//
		if (historyStatusIsFinal) {
			// check possibility of fail over
			const failOver = await FailOver.checkRules({
				facts: {
					supplier: "MKIOS",
					rc: data.rc
				},
				trxId: jobData.trxId
			});

			if (status === "FAILED" && trxData.product_code === "TSEL" && failOver) {
				return `${error}. Retry the transaction using other supplier`;
			}

			// jika di history sudah final, langsung job complete
			return {
				id,
				error,
				status
			};
		} else if (error && error.startsWith("MKIOS_") === false) {
			// jika ada error dan bukan dari MKIOS
			throw new Error(error);
		} else if (status === "PENDING") {
			// dari MKIOS itu PENDING tapi history tercatat belum Final
			throw new Error(`${id} is ${status}. ${data.rc}`);
		} else {
			/// jika history_status(PENDING) dan belum SUCCESS/FAILED
			/// status FAILED jika ada error dari MKIOS
			const newHistory = await TransactionHistory.create({
				trx_id: jobData.trxId,
				status,
				data: {
					id,
					error
				}
			});
			// jika memang statusnya error atau FAILED, perlu refund balance
			if (error || status === "FAILED") {
				if (isDirectPurchase === false) {
					/// bukan direct purchase, refund saja
					await this.refundBalance(trxData.buyer_id, newHistory.id, trxData.sell_price);
				} else {
					// fire SHALLRETRY karena DirectPurchase
					Event.fire("DIRECT::SHALLRETRY", {
						trxId: jobData.trxId,
						payId: trxData.directpay_id
					});
				}
			}

			notifyDone(trxData, newHistory);
			return {
				id,
				error
			};
		}
	}

	/**
   * HANDLER untuk AS 2in1 Mobile
   */
	async invokeTrxAS(job) {
		const jobData = job.data;
		const trxDataObj = await fetchTrxData(jobData.trxId);
		const trxData = trxDataObj.toJSON();
		///
		const { status, data } = await As2in1Mobile.updateBalance({
			currency: "RM",
			target: trxData.target,
			amount: trxData.denom
		});
		if (status === 200) {
			const splitData = data.return.split(":");
			const statusTrans = splitData[0];
			const msgTrans = splitData[1];
			if (statusTrans === "000000") {
				// success
				await TransactionHistory.create({
					trx_id: jobData.trxId,
					status: "SUCCESS",
					data: {
						code: statusTrans,
						status: msgTrans
					}
				});
			} else {
				if (job.attemptsMade + 1 < job.opts.attempts) {
					throw new Error(statusTrans);
				} else {
					// log in History as Failed
					const failedHistory = await TransactionHistory.create({
						trx_id: jobData.trxId,
						status: "FAILED",
						remark: msgTrans,
						data: {
							code: statusTrans,
							error: msgTrans,
							reason: msgTrans
						}
					});
					// refund Balance
					await this.refundBalance(trxData.buyer_id, failedHistory.id, trxData.sell_price);
					// notify for FAILURE
					notifyDone(trxData, failedHistory);
				}
				return {
					data
				};
			}
		} else {
			if (job.attemptsMade + 1 < job.opts.attempts) {
				throw new Error(status);
			} else {
				// log in History as Failed
				const failedHistory = await TransactionHistory.create({
					trx_id: jobData.trxId,
					status: "FAILED",
					remark: null,
					data: {
						code: status,
						error: data
					}
				});
				// refund Balance
				await this.refundBalance(trxData.buyer_id, failedHistory.id, trxData.sell_price);
				// notify for FAILURE
				notifyDone(trxData, failedHistory);
			}
			return {
				status
			};
		}
	}
}

module.exports = MkiosWorker;

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
