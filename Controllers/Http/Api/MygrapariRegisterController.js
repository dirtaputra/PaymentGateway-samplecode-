"use strict";
// const User = use("App/Models/User")
const User = use("App/Models/UserApi");

class MygrapariRegisterController {
  async store({ request, response, auth }) {
    const fullname = request.input("fullname");
    const password = request.input("password");
    const msisdn = request.input("msisdn");
    try {
      const register = new User();
      register.fullname = fullname;
      register.password = password;
      register.msisdn = msisdn;
      register.email = msisdn + "@telin.com.my";
      await register.save();
      let token = await auth.authenticator("api").generate(register);
      Object.assign(register, token);
      return response.send({
        status: "OK"
      });
    } catch (err) {
      return response.send({
        status: "FAIL",
        error: err.detail
      });
    }
  }
}

module.exports = MygrapariRegisterController;
