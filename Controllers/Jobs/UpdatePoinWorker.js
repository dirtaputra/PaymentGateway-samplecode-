const Logger = use("Logger");
const serializeError = require("serialize-error");
const moment = require("moment");
const catalogDetail = use("App/Models/CatalogDetail");
const Database = use("Database");
const Env = use("Env");
class UpdatePoinWorker {
  get concurrency() {
    return 1;
  }

  get onBoot() {
    return {
      duplicate: false,
      jobData: {
        state: "UPDATE_POIN"
      },
      jobConfig: {
        delay: 0,
        jobId: "onBoot",
        repeat: {
          cron: " 0 */60 * * * *" //setiap 1 jam
        }
      }
    };
  }

  async handler(job) {
    try {
      if (job.data.state === "UPDATE_POIN") return await this.updatePoin();
    } catch (e) {
      Logger.warning("UpdatePoinWorker", serializeError(e));
      throw e;
    }
  }

  async updatePoin() {
    try {
      const curDate = moment().format("YYYY-MM-DD");
      const dayOfEvent = moment("2019-08-31").format("YYYY-MM-DD");
      const tmpData = await catalogDetail.all();
      const arrData = tmpData.toJSON();
      const idData = arrData.map(el => {
        return el.id;
      });
      //console.log(idData[0])
      for (let index = 0; index < idData.length; index++) {
        const productCatalog = await catalogDetail.find(idData[index]);
        if (curDate === dayOfEvent) {
          //console.log(productCatalog.poin)
          if (productCatalog.poin.divider !== "5") {
            console.log(curDate, dayOfEvent);
            productCatalog.poin = `{"poin": "1", "value": "0.02", "divider": "5"}`;
            await productCatalog.save();
            // return {
            //   status: "SUCCESS",
            //   dateEvent: dayOfEvent
            // }
          } else {
            productCatalog.poin = `{"poin": "1", "value": "0.02", "divider": "10"}`;
            await productCatalog.save();
          }
        } else {
          console.log(curDate, dayOfEvent);
          console.log("not day of event");
          // return {
          //   status: "BYPASS"
          // }
        }
      }
    } catch (e) {
      Logger.warning("UpdatePoinWorker", serializeError(e));
      throw e;
    }
  }
}

module.exports = UpdatePoinWorker;
