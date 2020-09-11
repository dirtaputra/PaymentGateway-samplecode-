const sinon = use("sinon");

class MkiosStub {
	constructor(stubTarget) {
		/**
     * Stub requestTransactionRM
     */
		sinon.stub(stubTarget, "requestTransactionRM").callsFake(async (denom, target) => {
			console.log("stubhere");
			console.log([ denom, target ]);
			return {
				id: Date.now(),
				data: {
					rc: "0",
					message: "Stub OK"
				}
			};
		});

		/**
     * Stub requestTransactionRP
     */
		sinon.stub(stubTarget, "requestTransactionRP").callsFake(async (denom, target) => {
			console.log("stubhere");
			console.log([ denom, target ]);
			if (target === "628123456789") {
				return {
					id: Date.now(),
					data: {
						rc: "1",
						message: "Stub OK"
					},
					error: "Stub Fail Transaction"
				};
			} else if (target === "6281234567891") {
				return {
					id: Date.now(),
					data: {
						rc: "13",
						message: "Stub OK"
					},
					error: "Stub Fail Transaction with RC 13"
				};
			}
			return {
				id: Date.now(),
				data: {
					rc: "0",
					message: "Stub OK"
				}
			};
		});

		/**
     * Stub queryStatusRM
     */
		sinon.stub(stubTarget, "queryStatusRM").callsFake(async () => {
			throw new Error("Stub enforce to Pending");
		});

		/**
     * Stub queryStatusRP
     */
		sinon.stub(stubTarget, "queryStatusRP").callsFake(async () => {
			throw new Error("Stub enforce to Pending");
		});

		/**
     * Stub query balance
     */
		sinon.stub(stubTarget, "queryBalance").callsFake(async () => {
			return {
				id: Date.now(),
				status: "OK",
				balanceRM: "150000"
			};
		});
	}
}

module.exports = MkiosStub;
