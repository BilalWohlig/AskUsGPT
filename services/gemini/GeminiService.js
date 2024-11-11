const {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold
} = require('@google/generative-ai')

const MODEL_NAME = 'gemini-pro'
const API_KEY = process.env.GOOGLE_AI_STUDIO_API_KEY

const genAI = new GoogleGenerativeAI(API_KEY)

const model = genAI.getGenerativeModel({ model: MODEL_NAME })

const generationConfig = {
  temperature: 0,
  topK: 1,
  topP: 1,
  maxOutputTokens: 2048
}

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH
  }
]

class GeminiService {
  async getAnsFromGPT (context, question) {
    console.log('Sending Question to GPT')
    const chat = model.startChat({
      generationConfig,
      // safetySettings,
      history: []
    })
    const userInput = `Your name is AskUs and you are a helpful chatbot. AskUs answers any question within the scope of the below news article. If the question is outside the scope of the news article, AskUs will respond with "I apologize, but I am unable to provide a response at this time as I do not possess the necessary information. Please ask a question related to this news article. Is there anything else I can assist you with?". If the user acknowledges the answer or writes any form of 'okay' slang, AskUs will respond with 👍. Do not generate questions and answers on your own. This is the context of the article: ${context}
    Question: ${question}
    Answer:`
    const result = await chat.sendMessage(userInput)
    const response = result.response
    console.log(response.text())
    return response.text()
  }

  async getContentFromGPT (context, language, trends) {
    console.log('Sending News to GPT', language)
    try {
      let prompt = ''
      if (language == 'English') {
        prompt = `You are a helpful assistant. First give the summary, label it as "Summary:", then the headline, label it as "Headline:" then the tweet, label it as "Tweet:", then the tags, label it as "Tags:", then the bullet points, label it as "Bullets:", then similarity scores, label them as "Similarities:" and finally suggested question and answer, label them as "SuggestedQnA:".
      Content: ${context}
      1. Provide a summary of the key points from the article above. The summary should be 80 - 100 words in length. Focus on capturing the main ideas and key details in a clear and concise way. Summarize the essence of the article accurately regardless of its length.
        2. Create a headline in under 20 words for the summary.
        3. Create a tweet for the news article.
        4. Create tags for the above article.
        5. Give the same summary created above in bullet points.
        6. Compare the news article provided above with each array from the trending tags provided below and then give a similarity score (no decimal scores) out of 10 for every array from the trending tags. A high similarity score means that the array from trending tags is highly related to the news article and a low similarity score means that the array from trending tags is not too related to the news article. Provide only the similarity scores/score in a single line removing any preceding serial numbers or letters.
        ${trends}
        7. Create ${process.env.NUMBER_OF_SUGGESTION_QNA} suggested questions and their answers, label them as "SuggestedQnA".`
      } else {
        prompt = `You are a helpful assistant. First give the summary, label it as "Summary:", then the headline, label it as "Headline:", then the tags, label it as "Tags:", then the similarity scores, label them as "Similarities:" and finally suggested question and answer, label them as "SuggestedQnA:".
      Content: ${context}
      1. Provide a summary strictly in ${language} language of the key points from the article above. The summary should be 80 - 100 words in length. Focus on capturing the main ideas and key details in a clear and concise way. Summarize the essence of the article accurately regardless of its length.
        2. Create a headline in under 20 words for the summary strictly in ${language} language.
        3. Create tags for the above article strictly in ${language} language.
        4. Compare the news article provided above with each array from the trending tags provided below and then give a similarity score (no decimal scores) out of 10 for every array from the trending tags. A high similarity score means that the array from trending tags is highly related to the news article and a low similarity score means that the array from trending tags is not too related to the news article. Provide only the similarity scores/score in a single line removing any preceding serial numbers or letters.
        ${trends}
        5. Create ${process.env.NUMBER_OF_SUGGESTION_QNA} suggested questions and their answers strictly in ${language}, label them as "SuggestedQnA:".`
      }
      const parts = [
        { text: prompt }
      ]
      const result = await model.generateContent({
        contents: [{ role: 'user', parts }],
        generationConfig
        // safetySettings,
      })
      const response = result.response
      console.log("********", response.text())
      const promptTokens = await model.countTokens(prompt)
      const completionTokens = await model.countTokens(response.text())
      return {
        classification: response.text(),
        totalTokens: {
          prompt_tokens: promptTokens.totalTokens,
          completion_tokens: completionTokens.totalTokens,
          total_tokens: promptTokens.totalTokens + completionTokens.totalTokens
        }
      }
    } catch (error) {
      console.error('Error in getContentFromGPT', error)
      return error
    }
  }

  async getAdvancedClassificationGPT (summary, headline, updatedCategories) {
    console.log('Sending Summary & Headline to GPT')
    try {
      const prompt = `You are a helpful assistant. First give the categories, label it as "Categories:", then the sentiment, label it as "Sentiment:" and finally the Advanced Sentiment, label it as "AdvancedSentiment:".
        Summary: ${summary}
        Headline: ${headline}
        1. Analyze the provided summary and headline and categorize it using the following predefined categories. Each article may have multiple assigned categories, but ensure that all assigned categories are selected from the list below. Do not include any new categories that are not part of the provided list. The category 'nation' provided below pertains to news about India. The category 'advertisement' provided below pertains to any news that promotes the sale, discounts, features, price of any product be it a car, or a technology device, etc. Also, news related to games will come under 'advertisement' category. Provide only the category names in lowercase format and in a single line, removing any preceding numbers.
        ${updatedCategories}
        2. Analyse the above summary and headline and return the sentiment of that article. The sentiments you possess are [Positive, Negative, Neutral]. Give the answer in 1 word only.
        3. Next, analyze the news and provide an advanced sentiment for the news. Choose one of the following advanced sentiments only from the below list also having its description and return only the name of the sentiment in one word.
        - Optimism: Positive developments, success stories, or improvements.
        - Jubilation: Celebrating achievements, milestones, or positive events.
        - Hope: Encouraging or inspiring news that offers hope for the future.
        - Relief: Reporting on the resolution of a crisis or the prevention of a negative event.
        - Progress: News about advancements, innovations, or positive changes.
        - Alarm: News that raises concern, often related to urgent or alarming situations.
        - Anger: Stories that provoke anger or outrage due to injustices or negative outcomes.
        - Grief: Reporting on tragedies, disasters, or loss that evokes sadness and sympathy.
        - Disappointment: News that falls short of expectations or results in letdowns.
        - Frustration: Reporting on persistent problems or issues that cause annoyance.
        - Informational: Reporting facts without emotional bias or opinion.
        - Matter-of-fact: Unbiased presentation of events, often in a straightforward manner.
        - Educational: News that aims to inform and educate without a particular emotional tone.
        - Reporting: Neutral coverage of events, typically with minimal emotional expression.
        - Statistic-based: News presenting data and statistics without a clear emotional tone.
        - Ambivalence: News that includes both positive and negative aspects.
        - Balanced: Reporting that provides a fair representation of contrasting views.
        - Bittersweet: News that combines elements of both joy and sorrow.
        - Compassion: News expressing empathy for those facing hardships or suffering.
        - Support: Stories that offer encouragement and assistance to affected individuals or communities.
        - Solidarity: News that unites people in shared understanding or support for a cause.`

      const parts = [
        { text: prompt }
      ]
      const result = await model.generateContent({
        contents: [{ role: 'user', parts }],
        generationConfig
        // safetySettings,
      })
      const response = result.response
      const promptTokens = await model.countTokens(prompt)
      const completionTokens = await model.countTokens(response.text())
      return {
        classification: response.text(),
        totalTokens: {
          prompt_tokens: promptTokens.totalTokens,
          completion_tokens: completionTokens.totalTokens,
          total_tokens: promptTokens.totalTokens + completionTokens.totalTokens
        }
      }
    } catch (error) {
      console.error('Error in getClassificationGPT', error)
      return error
    }
  }

  async getFullContentGPT (transcript) {
    console.log('Generating full content from GPT')
    try {
      const prompt = `You are a helpful assistant. Give the Full Content and label it as "Full Content:".
        Transcript: ${transcript}
        Generate a news article for the above content`

      const parts = [
        { text: prompt }
      ]
      const result = await model.generateContent({
        contents: [{ role: 'user', parts }],
        generationConfig
        // safetySettings,
      })
      const response = result.response
      const promptTokens = await model.countTokens(prompt)
      const completionTokens = await model.countTokens(response.text())
      return {
        classification: response.text(),
        totalTokens: {
          prompt_tokens: promptTokens.totalTokens,
          completion_tokens: completionTokens.totalTokens,
          total_tokens: promptTokens.totalTokens + completionTokens.totalTokens
        }
      }
    } catch (error) {
      console.error('getFullContentGPT', error)
      return error
    }
  }
}

module.exports = new GeminiService()
