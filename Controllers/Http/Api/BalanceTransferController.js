"use strict";

/** @typedef {import('@adonisjs/framework/src/Request')} Request */
/** @typedef {import('@adonisjs/framework/src/Response')} Response */

const Logger = use("Logger");
const User = use("App/Models/User");
const BalanceKeeper = use("App/Common/BalanceKeeper");
const Allowed = use("App/Models/OverrideDeposit");

/**
 *  controller for balancetransfers
 */
class BalanceTransferController {
  /**
   *
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Response} ctx.response
   */
  async inquiry({
    request,
    params,
    response
  }) {
    const knownUser = await request.buyerAccount;
    console.log([knownUser.email, knownUser.msisdn, knownUser.allow_transfer]);
    // if (knownUser.allow_transfer === 0) {
    //   response.send({
    //     status: "FAIL",
    //     error: "E403: Request is not allowed"
    //   });
    //   return;
    // }
    const {
      target
    } = params;
    console.log([target]);
    ///
    try {
      const targetInfo = await User.query()
        .where("email", target)
        .orWhere("msisdn", target)
        .first();

      // console.log(targetInfo.toJSON());
      if (!targetInfo) {
        response.send({
          status: "FAIL",
          error: "E404: Account not found"
        });
        return;
      }
      response.send({
        status: "OK",
        data: {
          id: targetInfo.id,
          name: targetInfo.fullname
        }
      });
    } catch (e) {
      ///
      Logger.error(e);
      response.send({
        status: "FAIL",
        error: "E500: Something went wrong"
      });
    }
  }

  /**
   *
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Response} ctx.response
   */
  async create({
    request,
    params,
    response
  }) {
    const knownUser = await request.buyerAccount;
    const is_sf = knownUser.is_salesforce
    // if (knownUser.allow_transfer === 0) {
    //   response.send({
    //     status: "FAIL",
    //     error: "E403: Request is not allowed"
    //   });
    //   return;
    // }
    const {
      target,
      amount
    } = params;
    try {
      /// ensure balance is sufficient
      const availableBalance = await BalanceKeeper.balance(knownUser.id);
      if (availableBalance < amount) {
        response.send({
          status: "FAIL",
          error: "E403: Insufficient balance"
        });
        return;
      }
      /// ensure target exist
      const targetInfo = await User.query()
        .where("id", target)
        .first();
      if (!targetInfo) {
        response.send({
          status: "FAIL",
          error: "E404: Account not found"
        });
        return;
      } else if (targetInfo.id === knownUser.id) {
        response.send({
          status: "FAIL",
          error: "E403: Request on own account is not allowed"
        });
        return;
      }
      await BalanceKeeper.transfer(knownUser.id, target, amount, is_sf);
      response.send({
        status: "OK",
        data: "Balance has been transfered"
      });
    } catch (e) {
      ///
      Logger.error(e);
      response.send({
        status: "FAIL",
        error: "E500: Something went wrong"
      });
    }
  }

  async requestPermission({
    params,
    auth,
    response,
    request
  }) {
    const knownUser = await request.buyerAccount;
    if (knownUser.allow_transfer === 1) {
      response.send({
        status: "FAIL",
        error: "Transfer Balance is Enable"
      });
      return;
    }
    try {
      const reqData = new Allowed();
      reqData.user_id = params.user_id;
      reqData.remark = "Allowed Transfer Balance";
      reqData.validator = '{"val1":"final","val2":""}';
      reqData.validate_by = '{"val1":"","val2":""}';
      reqData.created_by = params.user_id;
      reqData.status = 0;
      reqData.amount = 0;
      reqData.type = "transfer";
      await reqData.save();
      response.send({
        status: "OK",
        data: "Wait For Allowed Transfer Balance"
      });
    } catch (error) {
      response.send({
        status: "FAIL",
        error: "E500: Something went wrong"
      });
    }
  }
}

module.exports = BalanceTransferController;
