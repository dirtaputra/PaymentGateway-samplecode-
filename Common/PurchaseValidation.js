const CatalogDetail = use("App/Models/CatalogDetail");
const Supply = use("App/Models/Supply");
var Ajv = require("ajv");
var ajv = new Ajv({
	allErrors: true,
});

class PurchaseValidation {
	/**
   * validate buyer's balance. given code
   */
	async sellingPrice(product_code, denom) {
		// get product price list
		let Price = await CatalogDetail.query()
			.with("catalog")
			.where("product_code", product_code)
			.where("status", "ENABLE")
			.where(function() {
				this.where(function() {
					this.where("denom", Number(denom)).whereNull("min");
				}).orWhere(function() {
					this.where("min", "<=", Number(denom)).where("denom", ">=", Number(denom));
				});
			})
			.first();
		if (Price === null) {
			return {
				status: "FAIL",
				error: "Product is not available in catalog",
			};
		}

		// denom validator
		const schema = Price.toJSON().catalog.validator === null ? null : Price.toJSON().catalog.validator;
		if (schema !== null) {
			const validate = ajv.compile(schema);
			if (
				!validate({
					denom: denom,
				})
			) {
				// invalid denom, round up
				denom = Math.ceil(denom);
			}
		}

		let finalPrice = "";
		let reference = denom;
		Price = Price.toJSON();
		// calculate reference and final price
		if (Price.method === "ABSOLUTE") {
			if (!Price.min) {
				finalPrice = parseFloat(Price.value).toFixed(2); //static
				reference = parseFloat(Price.reference).toFixed(2);
			} else {
				finalPrice = parseFloat(Number(denom) / Number(Price.reference) + Number(Price.value)).toFixed(2); // dynamic
				reference = parseFloat(Number(denom) / Number(Price.reference)).toFixed(2);
			}
		} else {
			// PERCENT
			if (!Price.min) {
				reference = parseFloat(Number(Price.reference)).toFixed(2);
				finalPrice = parseFloat(Number(Price.reference) * Number(Price.value) / 100).toFixed(2);
			} else {
				reference = parseFloat(Number(denom) / Number(Price.reference)).toFixed(2);
				finalPrice = parseFloat(Number(denom) / Number(Price.reference) * Number(Price.value) / 100).toFixed(2);
			}
		}

		return {
			status: "OK",
			finalPrice: finalPrice,
			reference: reference,
			valid_denom: denom,
		};
	}

	async sellingPriceByID(product_code, sub_id, denom) {
		// get product price list
		const [ PriceOrigin, PriceSuggest ] = await Promise.all([
			CatalogDetail.query()
				.with("catalog")
				.where("product_code", product_code)
				.where("sub_id", sub_id)
				.where("status", "ENABLE")
				.where(function() {
					this.where(function() {
						this.where("denom", Number(denom)).whereNull("min");
					}).orWhere(function() {
						this.where("min", "<=", Number(denom)).where("denom", ">=", Number(denom));
					});
				})
				.first(),
			CatalogDetail.query()
				.with("catalog")
				.where("product_code", product_code)
				.where("sub_id", sub_id)
				.where("status", "ENABLE")
				.where("denom", ">=", Number(denom))
				.orderBy("denom", "asc")
				.first(),
		]);

		let Price = PriceOrigin !== null ? PriceOrigin : PriceSuggest;

		if (Price === null) {
			return {
				status: "FAIL",
				error: "Product is not available in catalog",
			};
		}

		denom = PriceOrigin !== null ? denom : PriceSuggest.min ? PriceSuggest.min : PriceSuggest.denom;

		// denom validator
		const schema = Price.toJSON().catalog.validator === null ? null : Price.toJSON().catalog.validator;
		if (schema !== null) {
			const validate = ajv.compile(schema);
			if (
				!validate({
					denom: denom,
				})
			) {
				// invalid denom, round up
				denom = Math.ceil(denom);
			}
		}

		let finalPrice = "";
		let reference;
		Price = Price.toJSON();
		// calculate reference and final price
		if (Price.method === "ABSOLUTE") {
			if (!Price.min) {
				finalPrice = parseFloat(Price.value).toFixed(2); //static
				reference = parseFloat(Price.reference).toFixed(2);
			} else {
				finalPrice = parseFloat(Number(denom) / Number(Price.reference) + Number(Price.value)).toFixed(2); // dynamic
				reference = parseFloat(Number(denom) / Number(Price.reference)).toFixed(2);
			}
		} else {
			// PERCENT
			if (!Price.min) {
				reference = parseFloat(Number(Price.reference)).toFixed(2);
				finalPrice = parseFloat(Number(Price.reference) * Number(Price.value) / 100).toFixed(2);
			} else {
				reference = parseFloat(Number(denom) / Number(Price.reference)).toFixed(2);
				finalPrice = parseFloat(Number(denom) / Number(Price.reference) * Number(Price.value) / 100).toFixed(2);
			}
		}

		return {
			status: "OK",
			finalPrice: finalPrice,
			reference: reference,
			valid_denom: denom,
			sub_id: sub_id,
			label: Price.label,
			poin: Price.poin,
		};
	}

	async sellingPriceB2B(product_code, sub_id, denom, partner_id) {
		try {
			let Price = await CatalogDetail.query()
				.with("catalog")
				.where("product_code", product_code)
				.where("sub_id", sub_id)
				.where("status", "ENABLE")
				.where(function() {
					this.where(function() {
						this.where("denom", Number(denom)).whereNull("min");
					}).orWhere(function() {
						this.where("min", "<=", Number(denom)).where("denom", ">=", Number(denom));
					});
				})
				.first();
			if (Price.b2b === null) {
				return {
					status: "25",
					error: "Product is not available in catalog",
				};
			}
			// denom validator
			const schema = Price.toJSON().catalog.validator === null ? null : Price.toJSON().catalog.validator;
			if (schema !== null) {
				const validate = ajv.compile(schema);
				if (
					!validate({
						denom: denom,
					})
				) {
					// invalid denom, round up
					denom = Math.ceil(denom);
				}
			}

			let finalPrice = "";
			let reference;
			//let b2b = partner_id;
			Price = Price.toJSON();
			console.log("Price :"+Price.min)
			// calculate reference and final price
			if (Price.b2b[partner_id].type === "ABSOLUTE") {
				if (!Price.b2b[partner_id].min) {
					finalPrice = parseFloat(Price.b2b[partner_id].value).toFixed(2); //static
					reference = parseFloat(Price.reference).toFixed(2);
				} else {
					finalPrice = parseFloat(
						Number(denom) / Number(Price.reference) + Number(Price.b2b[partner_id].value),
					).toFixed(2); // dynamic
					reference = parseFloat(Number(denom) / Number(Price.reference)).toFixed(2);
				}
			} else {
				// PERCENT
				if (!Price.b2b[partner_id].min) {
					reference = parseFloat(Number(Price.reference)).toFixed(2);
					finalPrice = parseFloat(
						Number(Price.reference) * Number(Price.b2b[partner_id].value) / 100,
					).toFixed(2);
				} else {
					reference = parseFloat(Number(denom) / Number(Price.reference)).toFixed(2);
					finalPrice = parseFloat(
						Number(denom) / Number(Price.reference) * Number(Price.b2b[partner_id].value) / 100,
					).toFixed(2);
				}
			}
			return {
				status: "OK",
				finalPrice: finalPrice,
				reference: reference,
				valid_denom: denom,
				sub_id: sub_id,
				label: Price.label,
			};
		} catch (error) {
			return {
				response_code: "21",
				message: "product not exist",
			};
		}
	}

	async findMargin(product_code, denom, catalogPrice) {
		// get product price list
		let ProductList = (await Supply.query()
			.where("product_code", product_code)
			.where("status", "ENABLE")
			.where(function() {
				this.where(function() {
					this.where("denom", denom).whereNull("min_denom");
				}).orWhere(function() {
					this.where("min_denom", "<=", denom).where("denom", ">=", denom);
				});
			})
			.fetch()).toJSON();

		// calculate margins and prices.
		let marginData = new Array();
		ProductList.map((val) => {
			if (!val.min_denom) {
				// static
				if (Number(catalogPrice) < Number(val.sell_hjs)) {
					marginData.push({
						supplier_id: val.id,
						price: parseFloat(val.buy_hbs).toFixed(2),
						hbs: parseFloat(val.buy_hbs).toFixed(2),
						hjs: parseFloat(val.sell_hjs).toFixed(2),
						preMargin: parseFloat(Number(catalogPrice) - Number(val.buy_hbs)).toFixed(2),
						postMargin: Number(0.0),
						supplier_product_id: val.supplier_product_id,
						supplier_code: val.supplier_code,
					});
				} else {
					marginData.push({
						supplier_id: val.id,
						price: parseFloat(val.buy_hbs).toFixed(2),
						hbs: parseFloat(val.buy_hbs).toFixed(2),
						hjs: parseFloat(val.sell_hjs).toFixed(2),
						preMargin: parseFloat(Number(val.sell_hjs) - Number(val.buy_hbs)).toFixed(2),
						postMargin: parseFloat(Number(catalogPrice) - Number(val.sell_hjs)).toFixed(2),
						supplier_product_id: val.supplier_product_id,
						supplier_code: val.supplier_code,
					});
				}
			} else {
				// dynamic
				let hjs = 0;
				let hbs = 0;
				switch (val.method) { // define hbs & hjs
					case "ABSOLUTE-GROSS":
						hjs = parseFloat(denom / val.reference).toFixed(2);
						hbs = parseFloat(Number(denom / val.reference) - Number(val.margin)).toFixed(2);
						break;

					case "ABSOLUTE-NETT":
						hjs = parseFloat(Number(denom / val.reference) + Number(val.margin)).toFixed(2);
						hbs = parseFloat(denom / val.reference).toFixed(2);
						break;

					case "PERCENT-GROSS":
						hjs = parseFloat(denom / val.reference).toFixed(2);
						hbs = parseFloat(
							Number(denom / val.reference) - Number(val.margin) * Number(denom / val.reference) / 100,
						).toFixed(2);
						break;

					case "PERCENT-NETT":
						hjs = parseFloat(
							Number(denom / val.reference) + Number(val.margin) * Number(denom / val.reference) / 100,
						).toFixed(2);
						hbs = parseFloat(denom / val.reference).toFixed(2);
						break;
				}

				if (Number(catalogPrice) < Number(hjs)) {
					marginData.push({
						supplier_id: val.id,
						hbs: hbs,
						hjs: hjs,
						preMargin: parseFloat(Number(catalogPrice) - Number(hbs)).toFixed(2),
						postMargin: Number(0.0),
						supplier_product_id: val.supplier_product_id,
						supplier_code: val.supplier_code,
					});
				} else {
					marginData.push({
						supplier_id: val.id,
						hbs: hbs,
						hjs: hjs,
						preMargin: parseFloat(Number(hjs) - Number(hbs)).toFixed(2),
						postMargin: parseFloat(Number(catalogPrice) - Number(hjs)).toFixed(2),
						supplier_product_id: val.supplier_product_id,
						supplier_code: val.supplier_code,
					});
				}
			}
		});
		// sort by hbs. Return the results.
		marginData.sort((a, b) => (a.hbs < b.hbs ? -1 : b.hbs < a.hbs ? 1 : 0));
		return marginData;
	}

	async findMarginByID(product_code, sub_id, denom, catalogPrice) {
		// get product price list
		let ProductList = (await Supply.query()
			.where("product_code", product_code)
			.where("sub_id", sub_id)
			.where("status", "ENABLE")
			.where(function() {
				this.where(function() {
					this.where("denom", denom).whereNull("min_denom");
				}).orWhere(function() {
					this.where("min_denom", "<=", denom).where("denom", ">=", denom);
				});
			})
			.fetch()).toJSON();

		// calculate margins and prices.
		let marginData = new Array();
		ProductList.map((val) => {
			if (!val.min_denom) {
				// static
				if (Number(catalogPrice) < Number(val.sell_hjs)) {
					marginData.push({
						supplier_id: val.id,
						price: parseFloat(val.buy_hbs).toFixed(2),
						hbs: parseFloat(val.buy_hbs).toFixed(2),
						hjs: parseFloat(val.sell_hjs).toFixed(2),
						preMargin: parseFloat(Number(catalogPrice) - Number(val.buy_hbs)).toFixed(2),
						postMargin: Number(0.0),
						supplier_product_id: val.supplier_product_id,
						supplier_code: val.supplier_code,
					});
				} else {
					marginData.push({
						supplier_id: val.id,
						price: parseFloat(val.buy_hbs).toFixed(2),
						hbs: parseFloat(val.buy_hbs).toFixed(2),
						hjs: parseFloat(val.sell_hjs).toFixed(2),
						preMargin: parseFloat(Number(val.sell_hjs) - Number(val.buy_hbs)).toFixed(2),
						postMargin: parseFloat(Number(catalogPrice) - Number(val.sell_hjs)).toFixed(2),
						supplier_product_id: val.supplier_product_id,
						supplier_code: val.supplier_code,
					});
				}
			} else {
				// dynamic
				let hjs = 0;
				let hbs = 0;
				switch (val.method) { // define hbs & hjs
					case "ABSOLUTE-GROSS":
						hjs = parseFloat(denom / val.reference).toFixed(2);
						hbs = parseFloat(Number(denom / val.reference) - Number(val.margin)).toFixed(2);
						break;

					case "ABSOLUTE-NETT":
						hjs = parseFloat(Number(denom / val.reference) + Number(val.margin)).toFixed(2);
						hbs = parseFloat(denom / val.reference).toFixed(2);
						break;

					case "PERCENT-GROSS":
						hjs = parseFloat(denom / val.reference).toFixed(2);
						hbs = parseFloat(
							Number(denom / val.reference) - Number(val.margin) * Number(denom / val.reference) / 100,
						).toFixed(2);
						break;

					case "PERCENT-NETT":
						hjs = parseFloat(
							Number(denom / val.reference) + Number(val.margin) * Number(denom / val.reference) / 100,
						).toFixed(2);
						hbs = parseFloat(denom / val.reference).toFixed(2);
						break;
				}

				if (Number(catalogPrice) < Number(hjs)) {
					marginData.push({
						supplier_id: val.id,
						hbs: hbs,
						hjs: hjs,
						preMargin: parseFloat(Number(catalogPrice) - Number(hbs)).toFixed(2),
						postMargin: Number(0.0),
						supplier_product_id: val.supplier_product_id,
						supplier_code: val.supplier_code,
					});
				} else {
					marginData.push({
						supplier_id: val.id,
						hbs: hbs,
						hjs: hjs,
						preMargin: parseFloat(Number(hjs) - Number(hbs)).toFixed(2),
						postMargin: parseFloat(Number(catalogPrice) - Number(hjs)).toFixed(2),
						supplier_product_id: val.supplier_product_id,
						supplier_code: val.supplier_code,
					});
				}
			}
		});
		// sort by hbs. Return the results.
		marginData.sort((a, b) => (a.hbs < b.hbs ? -1 : b.hbs < a.hbs ? 1 : 0));
		console.log(marginData);
		return marginData;
	}

	async findMarginB2B() {}
}

module.exports = new PurchaseValidation();
