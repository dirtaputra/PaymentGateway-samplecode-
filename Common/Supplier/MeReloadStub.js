const sinon = use("sinon");

class MeReloadStub {
	constructor(stubTarget) {
		/**
     * Stub query balance
     */
		sinon.stub(stubTarget, "requestTopup").callsFake(async (inputData) => {
			return {
				status: "1"
			};
		});

		sinon.stub(stubTarget, "checkStatus").callsFake(async (inputData) => {
			return {
				Date: "20190814",
				Time: "100852",
				RefNum: inputData.ref,
				Status: "S",
				Balance: "8.04",
				ServerMessage: "REF:UM98226085372BAL:8.04",
				StatusMessage: "SUCCESS"
			};

			// return {
			// 	Date: "20190917",
			// 	Time: "172405",
			// 	RefNum: "03j55m",
			// 	Status: "F",
			// 	reason: "RELOAD FAILED",
			// 	Balance: "3102.36",
			// 	ServerMessage: "REF:UM98260240665BAL:3102.36",
			// 	StatusMessage: "RELOAD FAILED"
			// };
		});
	}
}

module.exports = MeReloadStub;
