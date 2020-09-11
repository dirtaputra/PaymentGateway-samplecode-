"use strict";

/** @type {import('@adonisjs/framework/src/Env')} */
const Env = use("Env");
const moment = require("moment");
const Logger = use("Logger");
const AutoCheckStub = use("App/Common/Supplier/AutoCheckStub");
const Supply = use("App/Models/Supply");
const CatalogDetail = use("App/Models/CatalogDetail");
const Cache = use("Cache");

class AutoCheck {
  async enableProduct(data) {
    const productDetail =
      data.min_denom === null ?
      await CatalogDetail.query()
      .where("product_code", data.product_code)
      .where("sub_id", data.sub_id)
      .where("denom", data.denom)
      .where("status", "DISABLE")
      .where("is_check", true)
      .first() :
      await CatalogDetail.query()
      .where("product_code", data.product_code)
      .where("sub_id", data.sub_id)
      .where("status", "DISABLE")
      .where("is_check", true)
      .first();
    //
    if (productDetail) {
      const changedData = {
        ...productDetail.toJSON(),
        newStatus: data.newStatus,
      };
      productDetail.status = data.newStatus;
      await productDetail.save();
      await Cache.forget(`${data.product_code}_v1`);
      await Cache.forget(`${data.product_code}_v2`);
      return changedData;
    }
    return {};
  }

  async disableProduct(data) {
    // check suppliers availability
    const supplierAvail =
      data.min_denom === null ?
      await Supply.query()
      .where("product_code", data.product_code)
      .where("sub_id", data.sub_id)
      .where("denom", data.denom)
      .where("status", "ENABLE")
      .first() :
      await Supply.query()
      .where("product_code", data.product_code)
      .where("sub_id", data.sub_id)
      .where("status", "ENABLE")
      .first();
    // supplier not available
    if (!supplierAvail) {
      // check product catalog
      const productDetail =
        data.min_denom === null ?
        await CatalogDetail.query()
        .where("product_code", data.product_code)
        .where("sub_id", data.sub_id)
        .where("denom", data.denom)
        .where("status", "ENABLE")
        .where("is_check", true)
        .first() :
        await CatalogDetail.query()
        .where("product_code", data.product_code)
        .where("sub_id", data.sub_id)
        .where("status", "ENABLE")
        .where("is_check", true)
        .first();
      // disable product
      if (productDetail) {
        const changedData = {
          ...productDetail.toJSON(),
          newStatus: data.newStatus,
        };
        productDetail.status = data.newStatus;
        await productDetail.save();
        await Cache.forget(`${data.product_code}_v1`);
        await Cache.forget(`${data.product_code}_v2`);
        return changedData;
      }
      return {};
    }
    return {};
  }

  async updateAlterra(id, status) {
    const supply = await Supply.find(id);
    const productStatus = status === "1" ? "ENABLE" : "DISABLE";
    if (productStatus !== supply.status) {
      const data = {
        supplier_id: supply.id,
        product_code: supply.product_code,
        sub_id: supply.sub_id,
        min_denom: supply.min_denom,
        denom: supply.denom,
        oldStatus: supply.status,
        newStatus: productStatus,
      };
      supply.supplier_product_id = JSON.stringify(supply.supplier_product_id);
      supply.status = productStatus;
      await supply.save();
      //
      Logger.info("updateAlterra:changeSupplierCatalog", data);
      return data;
    } else return null;
  }

  async trangloProduct(id) {}

  async updateTranglo() {}

  async srsProduct() {}

  async updateSrs(id) {}
}

module.exports = new AutoCheck();
