const express = require('express')
const router = express.Router()
const __constants = require('../../../config/constants')
const validationOfAPI = require('../../../middlewares/validation')
// const cache = require('../../../middlewares/requestCacheMiddleware')
// const GptService = require('../../../services/gpt/GptService')
const geminiServices = require('../../../services/gemini/GeminiService')

/**
 * @namespace -GPT-MODULE-
 * @description API’s related to GPT module.
 */

/**
 * @memberof -GPT-module-
 * @name getAdvancedClassificationGPT
 * @path {POST} /api/gpt/getAdvancedClassificationGPT
 * @description Bussiness Logic :- In getAdvancedClassificationGPT API, we get summary, headline, tweet and tags of the context from gpt
 * @response {string} ContentType=application/json - Response content type.
 * @response {string} metadata.msg=Success  - Response got successfully.
 * @response {string} metadata.data - It will return the data.
 * @code {200} if the msg is success the api returns the summary, headline, tweet and tags of the context.
 * @author Samay Gada, 25th October 2023
 * *** Last-Updated :- Samay Gada, 25th October 2023 ***
 */

const validationSchema = {
  type: 'object',
  required: true,
  properties: {
    summary: {
      type: 'string',
      required: true
    },
    headline: {
      type: 'string',
      required: true
    }
  }
}
const validation = (req, res, next) => {
  return validationOfAPI(req, res, next, validationSchema, 'body')
}
const getAdvancedClassificationGPT = async (req, res) => {
  try {
    const result = await geminiServices.getAdvancedClassificationGPT(req.body.summary, req.body.headline, req.body.categories)

    res.sendJson({
      type: __constants.RESPONSE_MESSAGES.SUCCESS,
      data: { gpt: result.classification, usage: result.totalTokens }
    })
  } catch (err) {
    console.log('getAdvancedClassificationGPT Error', err)
    return res.sendJson({
      type: err.type || __constants.RESPONSE_MESSAGES.SERVER_ERROR,
      err: err.err || err
    })
  }
}

router.post('/getAdvancedClassificationGPT', validation, getAdvancedClassificationGPT)
module.exports = router
