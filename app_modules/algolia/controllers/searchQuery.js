const express = require('express')
const router = express.Router()
const __constants = require('../../../config/constants')
const validationOfAPI = require('../../../middlewares/validation')
// const cache = require('../../../middlewares/requestCacheMiddleware')
const AlgoliaService = require('../../../services/algolia/AlgoliaService')

/**
 * @namespace -GNEWS-MODULE-
 * @description API’s related to GNEWS module.
 */

/**
 * @memberof -algolia-module-
 * @name searchQuery
 * @path {POST} /api/algolia/searchQuery
 * @description Bussiness Logic :- In searchQuery API, we get all the news based on the search query
 * @response {string} ContentType=application/json - Response content type.
 * @response {string} metadata.msg=Success  - Response got successfully.
 * @response {string} metadata.data - It will return the news based on search query.
 * @code {200} if the msg is success the api returns the news based on the search query.
 * @author Bilal Sani, 29rd March 2023
 * *** Last-Updated :- Bilal Sani, 29rd March 2023 ***
 */

const validationSchema = {
  type: 'object',
  required: true,
  properties: {
    page: {
      type: 'number',
      required: true
    },
    userId: {
      type: 'string',
      required: true
    },
    language: {
      type: 'string',
      required: true
    }
  }
}
const validation = (req, res, next) => {
  return validationOfAPI(req, res, next, validationSchema, 'body')
}
const algoliaSearchQuery = async (req, res) => {
  try {
    const result = await AlgoliaService.searchQueryAlgolia(req.body.searchData, req.body.page, req.body.language, req.body.userId, req.body.blockedSources, req.body.categories, req.body.isVideo, req.body.viewedNews, req.body.todayNews)
    res.sendJson({ type: __constants.RESPONSE_MESSAGES.SUCCESS, data: result })
  } catch (err) {
    console.log('algoliaSearchQuery Error', err)
    return res.sendJson({
      type: err.type || __constants.RESPONSE_MESSAGES.SERVER_ERROR,
      err: err.err || err
    })
  }
}

router.post('/algoliaSearchQuery', validation, algoliaSearchQuery)
module.exports = router
