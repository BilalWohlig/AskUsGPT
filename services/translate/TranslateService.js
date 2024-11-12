const cache = require('../../middlewares/requestCacheMiddleware')
const { TranslationServiceClient } = require('@google-cloud/translate')
if (process.env.GOOGLE_TRANSLATE_CREDENTIALS) {
  try {
    var translateKey = JSON.parse(process.env.GOOGLE_TRANSLATE_CREDENTIALS)
  } catch (error) {
    console.error('Error reading the JSON file:', error)
  }
}
class TranslateService {
  async getTranslation (text, lang) {
    try {
      const dataFromRedis = await cache.get(text + lang)
      if (!dataFromRedis) {
        const translationClient = new TranslationServiceClient(
          translateKey
            ? {
              credentials: translateKey,
              projectId: translateKey.project_id
            }
            : {}
        )
        const request = {
          parent: `projects/${process.env.PROJECT_ID}/locations/${process.env.PROJECT_LOCATION}`,
          contents: [text],
          mimeType: 'text/plain', // mime types: text/plain, text/html
          sourceLanguageCode: 'en',
          targetLanguageCode: lang
        }

        // Run request
        const [response] = await translationClient.translateText(request)
        await cache.setWithoutEx(
          text + lang,
          response.translations[0].translatedText
        )
        return response.translations[0].translatedText
      }
      return dataFromRedis
    } catch (error) {
      console.error(error)
    }
  }

  convertToHindiNumbers (inputString) {
    const hindiDigits = {
      0: '०',
      1: '१',
      2: '२',
      3: '३',
      4: '४',
      5: '५',
      6: '६',
      7: '७',
      8: '८',
      9: '९'
    }

    return this.convertNumbers(inputString, hindiDigits)
  }

  convertToGujaratiNumbers (inputString) {
    const gujaratiDigits = {
      0: '૦',
      1: '૧',
      2: '૨',
      3: '૩',
      4: '૪',
      5: '૫',
      6: '૬',
      7: '૭',
      8: '૮',
      9: '૯'
    }

    return this.convertNumbers(inputString, gujaratiDigits)
  }

  convertNumbers (inputString, digitMap) {
    return inputString.replace(/\d/g, function (match) {
      return digitMap[match]
    })
  }

  async predictionTranslation (predictionObj, lang) {
    const birth_moon_sign = await this.getTranslation(
      predictionObj.birth_moon_sign,
      lang
    )
    const birth_moon_nakshatra = await this.getTranslation(
      predictionObj.birth_moon_nakshatra,
      lang
    )
    const name = await this.getTranslation(predictionObj.name, lang)
    const sunsign = await this.getTranslation(predictionObj.sunsign, lang)
    const health = await this.getTranslation(
      predictionObj.prediction.health,
      lang
    )
    const emotions = await this.getTranslation(
      predictionObj.prediction.emotions,
      lang
    )
    const profession = await this.getTranslation(
      predictionObj.prediction.profession,
      lang
    )
    const luck = await this.getTranslation(predictionObj.prediction.luck, lang)
    const personal_life = await this.getTranslation(
      predictionObj.prediction.personal_life,
      lang
    )
    const travel = await this.getTranslation(
      predictionObj.prediction.travel,
      lang
    )
    const prediction_date = await this.getTranslation(predictionObj.prediction_date, lang)
    const healthText = await this.getTranslation('Health', lang)
    const emotionsText = await this.getTranslation('Emotions', lang)
    const professionText = await this.getTranslation('Profession', lang)
    const luckText = await this.getTranslation('Luck', lang)
    const personal_lifeText = await this.getTranslation('Personal Life', lang)
    const travelText = await this.getTranslation('Travel', lang)
    const finalTranslatedPredicitonObj = {
      health: health,
      emotions: emotions,
      profession: profession,
      luck: luck,
      personal_life: personal_life,
      travel: travel
    }
    const translatedTitles = [
      healthText,
      emotionsText,
      professionText,
      luckText,
      personal_lifeText,
      travelText
    ]
    predictionObj.birth_moon_sign = birth_moon_sign
    predictionObj.birth_moon_nakshatra = birth_moon_nakshatra
    predictionObj.name = name
    predictionObj.sunSignName = sunsign
    predictionObj.prediction = finalTranslatedPredicitonObj
    predictionObj.translatedTitles = translatedTitles
    let trandslatedPredictionDate = prediction_date
    if (lang == 'hi') {
      trandslatedPredictionDate = this.convertToHindiNumbers(prediction_date)
    } else if (lang == 'gu') {
      trandslatedPredictionDate = this.convertToHindiNumbers(prediction_date)
    }
    predictionObj.prediction_date = trandslatedPredictionDate

    return predictionObj
  }
}

module.exports = new TranslateService()
