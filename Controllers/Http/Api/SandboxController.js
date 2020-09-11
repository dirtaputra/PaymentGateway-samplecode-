"use strict";

/** @typedef {import('@adonisjs/framework/src/Request')} Request */
/** @typedef {import('@adonisjs/framework/src/Response')} Response */
/** @typedef {import('@adonisjs/framework/src/View')} View */

const Encryption = use('Encryption');
const Logger = use("Logger");
const User = use("App/Models/User");
const Transaction = use("App/Models/Transaction");
const TransactionHistory = use("App/Models/TransactionHistory");
const DepositLog = use("App/Models/DepositLog");
const btoa = require("btoa");

const BalanceKeeper = use("App/Common/BalanceKeeper");

const serializeError = require("serialize-error");

/**
 * Resourceful controller for interacting with sandboxes
 */
class SandboxController {
  /**
   * GET token given email
   *
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Response} ctx.response
   * @param {View} ctx.view
   */
  async queryToken({
    params,
    response
  }) {
    try {
      const email = (params.email || "").toUpperCase();
      if (!email) {
        throw new Error("Missing email");
      }
      const userData = await User.query()
        .where("email", email.toLowerCase())
        .with("tokens")
        .first();
      const tokenList = userData.toJSON().tokens;
      // Hash.make ON unrevoked token IN TokenList
      const token = btoa(tokenList.find(t => !t.is_revoked)["token"]);
      ///
      response.send({
        status: "OK",
        data: {
          email,
          token
        }
      });
    } catch (e) {
      Logger.warning("Sandbox:queryToken", serializeError(e));
      response.send({
        status: "FAIL",
        error: `E995: ${e.message}`
      });
    }
  }

  /**
   * override trx
   *
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Response} ctx.response
   * @param {View} ctx.view
   */
  async overrideTransaction({
    params,
    response
  }) {
    try {
      const trxId = (params.trx_id || "").toUpperCase();
      const newStatus = (params.new_status || "").toUpperCase();
      /// ensure newStatus is valid
      if (["FAILED", "SUCCESS", "PENDING"].includes(newStatus) === false) {
        throw new Error("Invalid Status");
      }
      /// find and validate existing history
      const lastHistory = await TransactionHistory.query()
        .where("trx_id", trxId)
        .orderBy("created_at", "desc")
        .first();
      if (!lastHistory) {
        throw new Error("Invalid Transaction ID");
      }
      /// ensure no backward status
      if (["FAILED", "SUCCESS"].includes(lastHistory.status)) {
        throw new Error(
          `Override on Final State is not allowed. Current status is ${lastHistory.status}`
        );
      }
      /// otherwise, insert
      const newHistory = await TransactionHistory.create({
        trx_id: trxId,
        status: newStatus
      });

      // add to Balance if status is FAILED
      if (newStatus === "FAILED") {
        // findout whether it has directpay_id
        const trxRoot = await Transaction.query()
          .where("id", trxId)
          .first();
        if (trxRoot && trxRoot.directpay_id) {
          /// refund balance
          BalanceKeeper.add({
            userId: trxRoot.buyer_id,
            amount: trxRoot.cost,
            trxRef: newHistory.id,
            depositRef: null
          });
        }
      }

      response.send({
        status: "OK",
        data: trxId
      });
    } catch (e) {
      Logger.warning("Sandbox:overrideTransaction", serializeError(e));
      response.send({
        status: "FAIL",
        error: `E995: ${e.message}`
      });
    }
  }

  /**
   * payment link
   *
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Response} ctx.response
   */
  async paymentView({
    params,
    response,
    view
  }) {
    try {
      const payId = (params.pay_id || "").toUpperCase();
      const {
        type,
        model
      } = await findTrxOrDeposit(payId);
      if (!type) {
        throw new Error("Payment url not valid.");
      }
      return view.render("sandboxpay", {
        payId,
        payStatus: model.status
      });
    } catch (e) {
      Logger.warning("Sandbox:paymentView", serializeError(e));
      response.send({
        status: "FAIL",
        error: `E995: ${e.message}`
      });
    }
  }

  /**
   * Display a single sandbox.
   * GET sandboxes/:id
   *
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Response} ctx.response
   * @param {View} ctx.view
   */
  async paymentUpdate({
    params,
    request,
    response,
    view
  }) {
    const payId = (params.pay_id || "").toUpperCase();
    const payStatus = (params.status || "").toUpperCase();
    console.log([payId, payStatus]);
    try {
      const {
        type,
        model
      } = await findTrxOrDeposit(payId);
      if (type === "direct") {
        ///
        await TransactionHistory.create({
          trx_id: model.trx_id,
          status: payStatus === "PAID" ? "PENDING" : "FAILED"
        });
      } else if (type === "deposit") {
        /// add to balance
        const depositEntry = await DepositLog.create({
          user_id: model.user_id,
          amount: model.amount,
          payment_id: payId,
          status: payStatus
        });
        /// add to balance
        if (payStatus === "PAID") {
          BalanceKeeper.add({
            userId: model.user_id,
            amount: model.amount,
            trxRef: null,
            depositRef: depositEntry.id
          });
        }
      }
    } catch (e) {
      ///
      Logger.warning("Sandbox:paymentUpdate", serializeError(e));
      response.send({
        status: "FAIL",
        error: `E995: ${e.message}`
      });
    }
  }
}

module.exports = SandboxController;

/**
 *
 * HELPER to findTrxOrDeposit
 *
 */
async function findTrxOrDeposit(id) {
  const txHistory = Transaction.query()
    .with("histories")
    .where("directpay_id", id)
    .orderBy("created_at", "desc")
    .first();
  const dpLog = DepositLog.query()
    .where("payment_id", id)
    .orderBy("created_at", "desc")
    .first();
  const [trxData, depositData] = await Promise.all([txHistory, dpLog]);
  if (trxData) {
    const trxDataObjHist = trxData.toJSON().histories;
    const validHist = trxDataObjHist[trxDataObjHist.length - 1];
    return {
      type: "direct",
      model: validHist
    };
  }
  if (depositData) {
    return {
      type: "deposit",
      model: depositData
    };
  }
  return {
    type: null,
    model: null
  };
}
