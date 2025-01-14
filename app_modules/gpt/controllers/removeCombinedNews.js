const express = require('express')
const router = express.Router()
const __constants = require('../../../config/constants')
const validationOfAPI = require('../../../middlewares/validation')
const cache = require('../../../middlewares/requestCacheMiddleware')
const gptServices = require('../../../services/gpt/GptService')

/**
 * @namespace -GPT-MODULE-
 * @description API’s related to GPT module.
 */

/**
 * @memberof -GPT-module-
 * @name getAnsFromGPT
 * @path {POST} /api/gpt/getAnsFromGPT
 * @description Bussiness Logic :- In getAnsFromGPT API, we get answers of the question from gpt.
 * @response {string} ContentType=application/json - Response content type.
 * @response {string} metadata.msg=Success  - Response got successfully.
 * @response {string} metadata.data - It will return the data.
 * @code {200} if the msg is success the api returns the answer.
 * @author Bilal Sani, 3rd March 2023
 * *** Last-Updated :- Bilal Sani, 3rd March 2023 ***
 */

const validationSchema = {
  type: 'object',
  required: true,
  properties: {
    gnewsTitle: {
      type: 'string',
      required: true
    }
  }
}
const validation = (req, res, next) => {
  return validationOfAPI(req, res, next, validationSchema, 'body')
}
const removeCombinedNews = async (req, res) => {
  try {
    const result = await gptServices.removeCombinedNews(req.body.gnewsTitle)
    res.sendJson({ type: __constants.RESPONSE_MESSAGES.SUCCESS, data: { data: result } })
  } catch (err) {
    console.log('removeCombinedNews Error', err)
    return res.sendJson({ type: err.type || __constants.RESPONSE_MESSAGES.SERVER_ERROR, err: err.err || err })
  }
}

router.post('/removeCombinedNews', validation, removeCombinedNews)
module.exports = router
