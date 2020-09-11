const Override = use("App/Models/OverrideDeposit");
const deposit = use("App/Models/DepositLogHook");
const ledger = use("App/Models/LedgerHook");


class DepositAttr {
  async reqDeposit(inputData) {
    const depositData = new deposit();
    depositData.user_id = inputData.user_id;
    depositData.payment_id = inputData.payment_id;
    depositData.amount = inputData.amount;
    depositData.status = inputData.status;
    depositData.detail = inputData.detail;
    depositData.data = inputData.data;
    const dataDeposit = await depositData.save();
    console.log(dataDeposit.id)
    return dataDeposit
  }

  async reqLedger(inputData) {
    const ledgerData = new ledger();
    ledgerData.user_id = inputData.user_id;
    ledgerData.credit = inputData.credit;
    ledgerData.remark = inputData.remark;
    ledgerData.deposit_ref = inputData.deposit_ref;
    ledgerData.self_references = inputData.self_references;
    const dataLedger = await ledgerData.save();
    return dataLedger
  }

  async reqOverride(inputData) {
    const overrideData = new Override();
    overrideData.user_id = inputData.user_id;
    overrideData.remark = inputData.remark;
    overrideData.amount = inputData.amount;
    overrideData.status = inputData.status;
    overrideData.validator = inputData.validator;
    overrideData.url = inputData.url;
    overrideData.validate_by = inputData.validate_by;
    overrideData.created_by = inputData.created_by;
    overrideData.type = inputData.type;
    const asd = await overrideData.save();
    return asd;
  }

  async testing() {
    return Response.send({
      status: "OK",
      remark: "Testing"
    })
  }

}
module.exports = new DepositAttr;
