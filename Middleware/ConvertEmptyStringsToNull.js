'use strict'

class ConvertEmptyStringsToNull {
  async handle({
    request
  }, next) {
    try {
      if (Object.keys(request.body).length) {
        request.body = Object.assign(
          ...Object.keys(request.body).map(key => ({
            [key]: request.body[key] !== '' ? request.body[key] : null
          }))
        )
      }
    } catch (error) {
      console.log('ConvertEmptyStringsToNull', error)
    }

    await next()
  }
}

module.exports = ConvertEmptyStringsToNull
