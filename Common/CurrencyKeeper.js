const transaction = use("App/Models/Transaction");
const Cache = use("Cache");
const axios = require("axios");
const numeral = require("numeral");

class CurrencyKeeper {
	async updateTransaction(trxId, price) {
		const curCost = await this.getCur();
		console.log("trxId: ", trxId);
		console.log("price: ", price);
		console.log("currentCost", curCost);
		const check = await transaction.findBy("id", trxId);
		check.cost = numeral(price / curCost).format("0.00");
		check.meta = Object.assign({ rates: numeral(curCost).format("0.00") });
		await check.save();
		return check;
	}

	async getCur() {
		const newRates = await axios.get("https://api.exchangerate-api.com/v4/latest/MYR");
		await Cache.put("rates_", newRates.data.rates.IDR);
		return Number(newRates.data.rates.IDR);
	}
}

module.exports = new CurrencyKeeper();
