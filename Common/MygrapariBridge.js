const axios = require("axios");
const crypto = require("crypto");
const Env = use("Env");
//
class MygrapariBridge {
  constructor() {
    this._uri = Env.get("BRIDGE_URI", "https://bridge.telinmy.hash.id");
    this._baseKey = Env.get("BRIDGE_KEY", "7vCBZ69V");
  }

  async queryAccount(email, password) {
    try {
      const validSecureToken = crypto
        .createHash("sha256")
        .update(this._baseKey + email)
        .digest("hex");
      const { data } = await axios.post(
        `${this._uri}/dealer/verify/${validSecureToken}`,
        {
          email,
          password
        }
      );
      return data;
    } catch (e) {
      console.log("ERROR_QUERY_MYGP ==> " + e.message);
      return { error: e.message };
    }
  }
}

module.exports = new MygrapariBridge();
