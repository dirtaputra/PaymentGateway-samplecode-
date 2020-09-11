"use strict";

/** @type {import('@adonisjs/framework/src/Env')} */
const Env = use("Env");
const soapRequest = require("easy-soap-request");
const Logger = use("Logger");
const convert = require("xml-js");

const MeReloadStub = use("App/Common/Supplier/MeReloadStub");

let wsdl = Env.get("MERELOAD_WSDL");
const ID = Env.get("MERELOAD_ID");
const Database = use("Database");
const TransactionHistory = use("App/Models/TransactionHistory");

class MeReloadPlugin {
	constructor() {
		/// on Sandbox, turn on Stub
		const sandboxEnv = Env.get("NODE_ENV") === "sandbox";
		if (sandboxEnv) new MeReloadStub(this);
	}
	async checkStatus(inputData) {
		const kepala = {
			"user-agent": "easy-soap-request-test",
			"Content-Type": "text/xml;charset=UTF-8",
			soapAction: "http://tempuri.org/SendRequest"
		};
		try {
			let xml = `<Envelope xmlns="http://schemas.xmlsoap.org/soap/envelope/">
                    <Body>
                        <SendRequest xmlns="http://tempuri.org/">
                            <ResellerAccount>${ID}</ResellerAccount>
                            <RefNum>${inputData.ref}</RefNum>
                        </SendRequest>
                    </Body>
                </Envelope>`;
			const { response } = await soapRequest(wsdl, kepala, xml, 120 * 1000);
			const { body } = response;
			Logger.info("MeReloadCheckStatus:response", response);
			let responseInJSON = JSON.parse(
				convert.xml2json(body, {
					compact: true,
					ignoreDeclaration: true,
					ignoreAttributes: true,
					spaces: 4
				})
			);
			const strData = responseInJSON["soap:Envelope"][
				"soap:Body"
			].SendRequestResponse.SendRequestResult._text.split("<|>");
			const resObj = {
				Date: strData[0],
				Time: strData[1],
				RefNum: strData[2],
				Status: strData[3],
				ServerMessage: strData[4],
				Balance: strData[5],
				StatusMessage: strData[6]
			};
			console.log(resObj);
			return resObj;
		} catch (error) {
			console.log(error);
			return error;
		}
	}

	async requestTopup(inputData) {
		const type =
			inputData.category === "ELOAD"
				? "R"
				: inputData.category === "BILL" ? "B" : inputData.category === "PIN" ? "P" : "R";
		const target = inputData.target.replace(/^(60)/g, "0");
		const message = type + "_" + target + "_" + inputData.denom + "_" + inputData.productCode;
		const kepala = {
			"user-agent": "easy-soap-request-test",
			"Content-Type": "text/xml;charset=UTF-8",
			soapAction: "http://tempuri.org/SendCommand"
		};
		try {
			let xml = `<Envelope xmlns="http://schemas.xmlsoap.org/soap/envelope/">
                    <Body>
                        <SendCommand xmlns="http://tempuri.org/">
                            <ResellerAccount>${ID}</ResellerAccount>
                            <RefNum>${inputData.ref}</RefNum>
                            <Message>${message}</Message>
                        </SendCommand>
                    </Body>
                </Envelope>`;
			const { response } = await soapRequest(wsdl, kepala, xml, 120 * 1000);
			console.log(xml);
			Logger.info("MeReloadCheckRequest: ", xml);
			Logger.info("MeReloadCheckRequest: response", response);
			console.log(response);
			let responseInJSON = JSON.parse(
				convert.xml2json(response.body, {
					compact: true,
					ignoreDeclaration: true,
					ignoreAttributes: true,
					spaces: 4
				})
			);
			const init = responseInJSON["soap:Envelope"]["soap:Body"].SendCommandResponse.SendCommandResult._text;
			console.log(init);
			//response.send(init)
			const resObj = {
				status: init
			};
			return resObj;
		} catch (error) {
			console.log(error);
			return error;
		}
	}

	async checkBalance() {
		try {
			// const query = `
			// select th."data"->'Balance' as balance, t."cost" from transaction_histories as th
			// join (
			//   select max(created_at) as created_at, trx_id from transaction_histories group by trx_id
			// ) as tmp_th on th.trx_id = tmp_th.trx_id and th.created_at = tmp_th.created_at
			// right join transactions as t on th.trx_id=t.id
			// left join supplies as s on t.supply_id = s.id
			// join (
			//   select max(t.created_at) as created_at from transaction_histories as th
			//   join (
			//     select max(created_at) as created_at, trx_id from transaction_histories group by trx_id
			//   ) as tmp_th on th.trx_id = tmp_th.trx_id and th.created_at = tmp_th.created_at
			//   right join transactions as t on th.trx_id=t.id
			//   left join supplies as s on t.supply_id = s.id
			//   where s.supplier_code='MERELOAD' and th.status='SUCCESS'
			// ) as tt on t.created_at = tt.created_at
			// where s.supplier_code='MERELOAD' and th.status='SUCCESS'
			// `;
			// const obj = await Database.raw(query);
			// let balance = 0;
			// if (obj.rows[0]) {
			//   const res = obj.rows[0];
			//   const balance_old = Number(res.balance);
			//   const cost = Number(res.cost);
			//   balance = balance_old;
			// }

			const res = await TransactionHistory.query()
				.where("status", "SUCCESS")
				.whereHas("transaction.supply", (builder) => {
					builder.where("supplier_code", "MERELOAD");
				})
				// .with("transaction.supply")
				.orderBy("created_at", "desc")
				.first();
			const res_json = res ? res.toJSON() : null;
			const blc = res_json ? Number(res_json.data.Balance) : null;
			return {
				balance: blc
			};
		} catch (e) {
			console.log(e);
		}
	}
}

module.exports = new MeReloadPlugin();
