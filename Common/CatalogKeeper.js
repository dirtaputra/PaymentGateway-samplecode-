const Catalog = use("App/Models/Catalog");
const CatalogDetail = use("App/Models/CatalogDetail");
const _ = require("lodash");
const shortId = require("shortid");
const moment = require("moment");
const millify = require("millify");

class CatalogKeeper {
  /**
   * retrieve pricing list. given code
   */
  async findPriceList(code) {
    //
    // QUERY for exact DENOM
    const feasiblePacks = await CatalogDetail.query()
      .where("product_code", code)
      .where("status", "ENABLE")
      .orderBy("min", "asc")
      .fetch();
    /// no records
    if (feasiblePacks.length === 0) {
      return null;
    }
    // console.log(feasiblePacks);
    // record exists
    const formattedSet = feasiblePacks.toJSON().map((val) => {
      // In DB, if val.min is NULL, then reference = denom in MY. Else, reference = kurs.
      let finalPrice = "";
      let reference = "";
      if (val.method === "ABSOLUTE") {
        if (!val.min) {
          finalPrice = parseFloat(val.value).toFixed(2);
          reference = parseFloat(val.reference).toFixed(2);
        } else {
          finalPrice = `${Number(val.min / val.reference) + Number(val.value)} - ${Number(
						val.denom / val.reference,
					) + Number(val.value)}`;
          reference = `${Number(val.min / val.reference)} - ${Number(val.denom / val.reference)}`;
        }
      } else {
        if (!val.min) {
          finalPrice = parseFloat(val.value * val.reference / 100).toFixed(2);
          reference = parseFloat(val.reference).toFixed(2);
        } else {
          const lower = val.value * (val.min / val.reference) / 100;
          const upper = val.value * (val.denom / val.reference) / 100;
          const lower_ref = val.min / val.reference;
          const upper_ref = val.denom / val.reference;
          finalPrice = `${lower.toFixed(2)} - ${upper.toFixed(2)}`;
          reference = `${lower_ref.toFixed(2)} - ${upper_ref.toFixed(2)}`;
        }
      }
      return {
        denomination: val.min ? `${val.min} - ${val.denom}` : val.denom,
        price: finalPrice,
        rrp: reference,
      };
    });
    formattedSet.sort(
      (a, b) =>
      Number(a.denomination) < Number(b.denomination) ?
      -1 :
      Number(b.denomination) < Number(a.denomination) ? 1 : 0,
    );
    return formattedSet;
  }

  async findPriceListWithID(code) {
    //
    // QUERY for exact DENOM
    const feasiblePacks = await CatalogDetail.query()
      .where("product_code", code)
      .where("status", "ENABLE")
      .orderBy("min", "asc")
      .fetch();
    /// no records
    if (feasiblePacks.length === 0) {
      return null;
    }
    // console.log(feasiblePacks);
    // record exists
    const formattedSet = feasiblePacks.toJSON().map((val) => {
      // In DB, if val.min is NULL, then reference = denom in MY. Else, reference = kurs.
      let finalPrice = "";
      let reference = "";
      if (val.method === "ABSOLUTE") {
        if (!val.min) {
          finalPrice = parseFloat(val.value).toFixed(2);
          reference = parseFloat(val.reference).toFixed(2);
        } else {
          finalPrice = `${Number(val.min / val.reference) + Number(val.value)} - ${Number(
						val.denom / val.reference,
					) + Number(val.value)}`;
          reference = `${Number(val.min / val.reference)} - ${Number(val.denom / val.reference)}`;
        }
      } else {
        if (!val.min) {
          finalPrice = parseFloat(val.value * val.reference / 100).toFixed(2);
          reference = parseFloat(val.reference).toFixed(2);
        } else {
          const lower = val.value * (val.min / val.reference) / 100;
          const upper = val.value * (val.denom / val.reference) / 100;
          const lower_ref = val.min / val.reference;
          const upper_ref = val.denom / val.reference;
          finalPrice = `${lower.toFixed(2)} - ${upper.toFixed(2)}`;
          reference = `${lower_ref.toFixed(2)} - ${upper_ref.toFixed(2)}`;
        }
      }
      return {
        itemID: `${code}:${val.sub_id}:${millify(val.denom)}`,
        denomination: val.min ? `${val.min} - ${val.denom}` : val.denom,
        price: finalPrice,
        rrp: reference,
        label: val.label,
      };
    });
    // sort by DENOM
    formattedSet.sort(
      (a, b) =>
      Number(a.denomination) < Number(b.denomination) ?
      -1 :
      Number(b.denomination) < Number(a.denomination) ? 1 : 0,
    );
    // sort by LABEL
    if (code.endsWith("DATA")) formattedSet.sort((a, b) => (a.label < b.label ? -1 : b.label < a.label ? 1 : 0));

    return formattedSet;
  }

  // generate transaction id
  generateTrxId() {
    // ~ generate trx_id
    let x = moment().diff(moment("2017-07-01"), "hours").toString(16);
    // ~ last 6 string is random char
    let y = shortId.generate().replace(/[-_]/gi, "0").slice(0, 6);
    let trxid = (x + y).toUpperCase();
    trxid = "TRX" + _.padStart(trxid, 13, "X");
    return trxid;
  }

  //generate refID Mereload
  generateRefID() {
    let x = moment().diff(moment("2017-07-01"), "hours").toString(16);
    // ~ last 6 string is random char
    let y = shortId.generate().replace(/[-_]/gi, "0").slice(0, 6);
    let trxid = (x + y).toUpperCase();
    return y;
  }
}

module.exports = new CatalogKeeper();
