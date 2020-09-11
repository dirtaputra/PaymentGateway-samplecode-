//@ts-check
"use strict";
//@ts-ignore
const User = use("App/Models/User");

class AuthController {
  async getLogin({
    view,
    auth,
    response
  }) {
    if (!auth.user) {
      return view.render("pages/login");
    } else {
      return response.route("index");
    }
  }

  async postLogin({
    request,
    response,
    auth,
    view
  }) {
    const {
      email,
      password,
      type
    } = request.all();
    const UserData = await User.findBy("email", email);
    // console.log(UserData.enable)
    try {
      if (!UserData) {
        return view.render("pages.login", {
          error: "Your email does not registered"
        });
      } else if (UserData.enable) {
        const test = await auth.attempt(email, password, type);
        return response.route("index");
      } else {
        return view.render("pages.login", {
          error: "Your Account is Disable"
        });
      }
    } catch (error) {
      return view.render("pages.login", {
        error: "Please try again"
      });
    }
  }

  async postLogout({
    auth,
    response
  }) {
    await auth.logout();
    return response.route("login");
  }

  async getProfile({
    auth,
    view,
    response
  }) {
    if (!auth.user) {
      return response.route("login");
    }
    const user = auth.user.toJSON();
    return view.render("profile", {
      user: user
    });
  }

  async dashboard({
    auth,
    view,
    response
  }) {
    const user = auth.user.toJSON();
    return view.render("pages.index", {
      data: user
    });
  }

  /**
   * Social Auth
   */
  async redirectToProvider({
    ally,
    params
  }) {
    await ally.driver(params.provider).redirect();
  }

  async handleProviderCallback({
    params,
    ally,
    auth,
    response
  }) {
    const provider = params.provider;
    try {
      const userData = await ally.driver(params.provider).getUser();

      // console.dir(userData);
      // console.log([userData.getId(), userData.getName(), userData.getEmail()]);

      if (userData.getEmail()) {
        const authUser = await User.findBy("email", userData.getEmail());
        if (!(authUser === null)) {
          await auth.authenticator("session").loginViaId(authUser.id);
          return response.redirect("/");
        }
      }
      return response.redirect("/");
      ///
    } catch (e) {
      console.log(e);
      response.redirect("/auth/" + provider);
    }
  }
}

module.exports = AuthController;
