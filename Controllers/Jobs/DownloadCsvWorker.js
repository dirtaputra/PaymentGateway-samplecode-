const Event = use("Event");
const StoragePlugin = use("App/Common/StorageKeeper");
const CsvPlugin = use("App/Common/DepositDownload");
const Download = use('App/Models/Download');
const Logger = use("Logger");
const serializeError = require("serialize-error");

class DownloadCsvWorker {
  get concurrency() {
    return 1;
  }

  /**
   * Query to Payment Gateway to check status
   */
  async handler(job) {
    try {
      if (job.data.state === "ADD") return await this.initiate(job);
      if (job.data.state === "PROCESS") return await this.processing(job);
    } catch (e) {
      Logger.warning("DownloadCsvWorker", serializeError(e));
      throw e;
    }
  }

  async initiate(job) {
    const {
      id,
      filename,
      schema,
    } = job.data;

    // update downloads table, set status to BUILDING
    const downloads = await Download.findBy("id", id);
    downloads.id = id;
    downloads.status = "BUILDING";
    downloads.save();
    // 
    Event.fire("DOWNLOAD::PROCESS", {
      id,
      filename,
      schema,
      state: "PROCESS"
    });
  }

  async processing(job) {
    const {
      id,
      filename,
      schema
    } = job.data;
    // generate a .csv file
    // let csv = await CsvPlugin.GenerateDeposit(id);
    let csv;
    switch (schema) {
      case "Transactions":
        csv = await CsvPlugin.GenerateTransaction(id);
        break;
      case "deposit_logs":
        csv = await CsvPlugin.GenerateDeposit(id);
        break;
      case "Statements":
        csv = await CsvPlugin.GenerateStatement(id);
        break;
      case "users":
        csv = await CsvPlugin.GenerateUser(id);
        break;
      case "transfer-balance":
        csv = await CsvPlugin.GenerateTransferBalance(id);
        break;
      case "poins":
          csv = await CsvPlugin.GeneratePoin(id);
          break;
    }
    // save to Azure Storage
    const {
      status,
      data,
      error
    } = await StoragePlugin.saveBlob(filename, csv);
    // update downloads table
    const downloads = await Download.findBy("id", id);
    downloads.id = id;
    if (status !== "FAIL") {
      downloads.status = "SUCCESS";
      downloads.url = data;
    } else {
      downloads.status = "FAIL";
      downloads.data = error;
    }
    downloads.save();
    Logger.info('DownloadCsvWorker:processing', downloads);
    return downloads;
  }
}

module.exports = DownloadCsvWorker;
