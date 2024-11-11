const express = require('express')
const router = express.Router()
const __constants = require('../../../config/constants')
const validationOfAPI = require('../../../middlewares/validation')
// const cache = require('../../../middlewares/requestCacheMiddleware')
const geminiServices = require('../../../services/gemini/GeminiService')

/**
 * @namespace -GPT-MODULE-
 * @description API’s related to GPT module.
 */

/**
 * @memberof -GPT-module-
 * @name getContentFromGPT
 * @path {POST} /api/gpt/getContentFromGPT
 * @description Bussiness Logic :- In getContentFromGPT API, we get summary, headline, tweet and tags of the context from gpt
 * @response {string} ContentType=application/json - Response content type.
 * @response {string} metadata.msg=Success  - Response got successfully.
 * @response {string} metadata.data - It will return the data.
 * @code {200} if the msg is success the api returns the summary, headline, tweet and tags of the context.
 * @author Bilal Sani, 3rd March 2023
 * *** Last-Updated :- Bilal Sani, 3rd March 2023 ***
 */

const validationSchema = {
  type: 'object',
  required: true,
  properties: {
    context: {
      type: 'string',
      required: true
    }
  }
}
const validation = (req, res, next) => {
  return validationOfAPI(req, res, next, validationSchema, 'body')
}
const getNewsFromGPT = async (req, res) => {
  try {
    const result = await geminiServices.getContentFromGPT(req.body.context, req.body.lang, req.body.trends)
    console.log('result', result)
    res.sendJson({
      type: __constants.RESPONSE_MESSAGES.SUCCESS,
      data: { gpt: result.classification, usage: result.totalTokens }
    })
  } catch (err) {
    console.log('getContentFromGPT Error', err)
    return res.sendJson({
      type: err.type || __constants.RESPONSE_MESSAGES.SERVER_ERROR,
      err: err.err || err
    })
  }
}

router.post('/getNewsFromGPT', validation, getNewsFromGPT)
module.exports = router
