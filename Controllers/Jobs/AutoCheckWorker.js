const Logger = use("Logger");
const Event = use("Event");
const check = use("App/Common/Supplier/AutoCheck");
const supply = use("App/Models/Supply");
const AP = use("App/Common/Supplier/AlterraPlugin");
const serializeError = require("serialize-error");
const bbPromise = require("bluebird");
//
const catalogDetail = use("App/Models/CatalogDetail");

class AutoCheckWorker {
  get concurrency() {
    return 1;
  }
  get onBoot() {
    return {
      duplicate: false, //
      ///
      jobData: {
        state: "ALTERRA_CHECK",
      },
      jobConfig: {
        delay: 0,
        jobId: "onBoot",
        repeat: {
          cron: " 0 */15 * * * *",
        }, // every 15 minutes
      },
    };
  }
  async handler(job) {
    try {
      console.log(`AutoCheckWorker: ${job.data.state}`);
      if (job.data.state === "ALTERRA_CHECK") return await this.alterraCheck();
      if (job.data.state === "PRODUCT_CATALOG_CHECK") return await this.productCatalogChecks(job);
    } catch (e) {
      Logger.warning("AutoCheckWorker", serializeError(e));
      throw e;
    }
  }

  async alterraCheck() {
    try {
      const {
        data: alterraData,
        error
      } = await AP.getProducts();
      const supplyData = await supply.query().where("supplier_code", "ALTERRA").where("is_check", true).fetch();
      const supplierCatalogs = supplyData.toJSON().map((x) => {
        return {
          id: x.id,
          product_id: x.supplier_product_id.product_id,
          status: x.status,
        };
      });

      if (error) {
        Logger.info("Autocheck:alterraCheck:error", error);
        return error;
      }
      //find alterra data
      let changedStatus = [];
      for (let i = 0; i < alterraData.length; i++) {
        for (let j = 0; j < supplierCatalogs.length; j++) {
          if (supplierCatalogs[j].product_id == alterraData[i].product_id) {
            const returnData = await check.updateAlterra(supplierCatalogs[j].id, alterraData[i].enabled);
            if (returnData !== null) changedStatus.push(returnData);
          }
        }
      }
      Logger.info("Autocheck:alterraCheck", changedStatus);
      //
      Event.fire("AUTOCHECK::PRODUCT_CATALOG", {
        listOfProduct: changedStatus,
      });

      return {
        message: "success",
        data: changedStatus,
      };
    } catch (error) {
      Logger.warning("Autocheck:alterraCheck:Failed", error);
      return {
        error: error.message,
      };
    }
  }

  async productCatalogChecks(job) {
    const {
      listOfProduct
    } = job.data;
    const data = await bbPromise.map(listOfProduct, (productX) => {
      if (productX.newStatus === "ENABLE") {
        return check.enableProduct(productX);
      } else {
        return check.disableProduct(productX);
      }
    });
    return data;
  }
}
module.exports = AutoCheckWorker;
