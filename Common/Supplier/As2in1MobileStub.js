const sinon = use("sinon");

class As2in1MobileStub {
	constructor(stubTarget) {
		sinon.stub(stubTarget, "checkBalance").callsFake(async (inputData) => {
			return {
				checkBalanceResponse: {
					balance: 31.06,
					return: "000000:Success",
				},
			};
		});

		sinon.stub(stubTarget, "checkWalletBalance").callsFake(async (transaction_id) => {
			return {
				statusCode: 200,
				data: {
					balance: 460.7844,
					return: "000000:Success",
				},
			};
		});

		sinon.stub(stubTarget, "updateBalance").callsFake(async (transaction_id) => {
			return {
				statusCode: 200,
				data: {
					return: "000000:Success",
				},
			};
		});
	}
}

module.exports = As2in1MobileStub;
