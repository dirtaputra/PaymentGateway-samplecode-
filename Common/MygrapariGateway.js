const axios = require("axios");
const crypto = require("crypto");
const Env = use("Env");
//
class MygrapariGateway {
  constructor() {
    this._uri = Env.get("GW_URI", "https://mygrapari-gateway.telinmy.hash.id");
  }

  async queryAccount(email, password) {
    try {
      const {
        data
      } = await axios.post(`${this._uri}/dealer/auth/login`, {
        email,
        password
      });
      return data;
    } catch (e) {
      console.log("ERROR_QUERY_MYGP ==> " + e.message);
      return {
        error: e.message
      };
    }
  }
}

module.exports = new MygrapariGateway();
