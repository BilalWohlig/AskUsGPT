
const OpenAI = require('openai')
const { z } = require('zod')
const { StructuredOutputParser } = require('openai', 'langchain/output_parsers')
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const axios = require('axios')
const fs = require('fs')
const { response } = require('express')

class GptService {
  async removeCombinedNews (gnewsTitle) {
    console.log('Removing combined news')
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            "Analyze the news title provided and determine if it constitutes a news digest. A news digest is characterized by a phrase that suggests a compilation of recent news, followed by mentions of multiple, distinct, and unrelated news stories. To assess this, look for an introductory phrase like 'Digest,' 'Briefing,' 'Top Stories,' 'Morning/Evening/Afternoon Digest,' or similar terms indicating a compilation. Verify that the title includes at least two summaries of news items that are not topically related to each other. Respond with 'Yes' if the title meets these criteria (i.e., it mentions multiple unrelated news summaries); otherwise, respond with 'No' (i.e., it covers a single topic or related topics). Provide a clear 'Yes' or 'No' answer based on these criteria. Here are examples of titles that meet these criteria: - 'News18 Afternoon Digest: Sam Pitroda In Soup Again; Modi Says India Will Not Tolerate And More Top Stories' - 'Morning briefing: Another Cong leader questions Poonch attack; Google ex-AI chief praises Microsoft's Nadella, and more' - 'News18 Evening Digest: SC Stays Calcultta HC's Order on Teacher's Recruitment, Kejriwal Interim Bail Plea' - 'Afternoon brief: KL Sharma on why Rahul Gandhi lost to Smriti Irani in 2019; US to India on Nijjar's killing, and more'"
        },
        {
          role: 'user',
          content: `This is the content of the article title: ${gnewsTitle}`
        },
        {
          role: 'assistant',
          content: 'Answer: '
        }
      ],
      temperature: 0,
      max_tokens: 256,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0
    })
    return response
  }

  async getAnsFromGPT (context, question) {
    console.log('Sending Question to GPT')
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Your name is AskUs and you are a helpful chatbot. AskUs answers any question within the scope of the below news article. If the question is outside the scope of the news article, AskUs will respond with "I apologize, but I am unable to provide a response at this time as I do not possess the necessary information. Please ask a question related to this news article. Is there anything else I can assist you with?". If the user acknowledges the answer or writes any form of 'okay' slang, AskUs will respond with 👍. Do not generate questions and answers on your own. This is the context of the article: ${context}`
        },
        {
          role: 'user',
          content: `Question: ${question}`
        },
        {
          role: 'assistant',
          content: 'Answer: '
        }
      ],
      temperature: 0,
      max_tokens: 256,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0
    })
    return response
  }

  async getContentFromGPT (context, language, type, trends, max_tokens = 2000, model = 'gpt-4o-mini') {
    if (type === 'YouTube') {
      max_tokens = 3000
      model = 'gpt-4o-mini'
    }

    console.log('Sending News to GPT', language)

    const gptResponseSchema = z.object({
      choices: z.array(z.object({
        message: z.object({
          content: z.string().transform(content => {
            const sections = ['Summary:', 'Headline:', 'Tweet:', 'Tags:', 'Bullets:', 'Similarities:', 'SuggestedQnA:']
            const result = {}

            sections.forEach(section => {
              const regex = new RegExp(`${section}\\s*(.*?)(?=${sections.filter(sec => sec !== section).join('|')}|$)`, 's')
              const match = content.match(regex)
              result[section.toLowerCase().slice(0, -1)] = match ? match[1].trim() : null
            })
            if (result.bullets) {
              result.bullets = result.bullets.split('\n').map(line => line.trim()).filter(line => line)
              result.bullets = result.bullets.map(data => data.replace(/[-\n]/g, '').trim())
            }

            if (result.suggestedqna) {
              result.suggestedqna = result.suggestedqna.split('\n')
                .filter(line => line.trim())
                .map(line => {
                  const match = line.match(/^(\d+)\.\s*(.*?)(?:\?\s*(.*?))$/s)
                  if (match) {
                    const question = match[2].trim() + '?'
                    const answer = match[3] ? match[3].trim() : ''
                    return { question, answer }
                  } else {
                    return { question: line, answer: '' }
                  }
                })
            }

            if (result.similarities) {
              result.similarities = result.similarities.split(', ').map(score => score.trim()).filter(score => score).map(Number)
            }
            return result
          })
        })
      }))
    })

    try {
      console.log('trends', trends)
      const messages = [
        {
          role: 'system',
          content:
            'You are a helpful assistant. First give the summary, label it as "Summary:", then the headline, label it as "Headline:" then the tweet, label it as "Tweet:", then the tags, label it as "Tags:", then the bullet points, label it as "Bullets:", then similarity scores, label them as "Similarities:" and finally suggested question and answer, label them as "SuggestedQnA". Ensure the "SuggestedQnA" section follows this format: "1. question1? answer1. 2. question2? answer2. 3. question3? answer3."'
        },
        {
          role: 'user',
          content: `${context}
        1. Provide a summary of the key points from the article above strictly in ${language} language. The summary should be 80-100 words in length. Focus on capturing the main ideas and key details in a clear and concise way. Summarize the essence of the article accurately regardless of its length.
        2. Create a headline in under 20 words for the summary strictly in ${language} language.
        3. Create a tweet for the news article strictly in ${language} language.
        4. Create tags for the above article strictly in ${language} language.
        5. Give the same summary created above in bullet points strictly in ${language} language.
        6. the numerical similarity scores in a single line, removing any preceding serial numbers or letters.Compare the news article provided above with each array from the trending tags below. Assign a similarity score out of 10 for each array based on any related connections, such as themes, locations, events, or individuals. A high similarity score should be given if the array is strongly related to the news article, and a low similarity score should be given if it is not very related. Even weak or indirect connections should be considered when assigning scores. Also, ensure that strong, direct connections receive appropriately higher scores.
          Provide only
          Trending Tags: ${trends}
        7. Create ${process.env.NUMBER_OF_SUGGESTION_QNA} suggested questions and their answers, label them as "SuggestedQnA". Ensure the "SuggestedQnA" section follows this format: "1. question1? answer1. 2. question2? answer2. 3. question3? answer3.And Provide the \n between lists"
        8.Provide the response in clean format and avoid using special characters like '*' or '\n'.`
        }
      ]

      const response = await openai.chat.completions.create({
        model: model,
        messages: messages,
        temperature: 0,
        max_tokens: max_tokens,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
      })
      const usage = response.usage

      const parsedResponse = gptResponseSchema.parse(response)
      const result = parsedResponse.choices[0].message

      return { result, usage }
    } catch (error) {
      console.error('Error in getContentFromGPT', error)
      return error
    }
  }

  async getClassificationGPT (summary, headline, updatedCategories) {
    console.log('Sending Summary & Headline to GPT')
    try {
      const messages = [
        {
          role: 'system',
          content:
            'You are a helpful assistant. First give the categories, label it as "Categories:" and finally the Sentiment, label it as "Sentiment:".'
        },
        {
          role: 'user',
          content: `Summary: ${summary}
          Headline: ${headline}
        1. Analyze the provided summary and headline and categorize it using the following predefined categories. Each article may have multiple assigned categories, but ensure that all assigned categories are selected from the list below. Do not include any new categories that are not part of the provided list. The category 'nation' provided below pertains to news about India. The category 'advertisement' provided below pertains to any news that promotes the sale, discounts, features, price of any product be it a car, or a technology device, etc. Also, news related to games will come under 'advertisement' category. Provide only the category names in lowercase format and in a single line, removing any preceding numbers.
        ${updatedCategories}
        2. Analyse the above summary and headline and return the sentiment of that article. The sentiments you possess are [Positive, Negative, Neutral]. Give the answer in 1 word only.`
        }
      ]
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo-0125',
        messages: messages,
        temperature: 0,
        max_tokens: 1000,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
      })
      return response
    } catch (error) {
      console.error('Error in getClassificationGPT', error)
      return error
    }
  }

  async getAdvancedClassificationGPT (summary, headline, updatedCategories) {
    console.log('Sending Summary & Headline to GPT')

    try {
      const messages = [
        {
          role: 'system',
          content:
            'You are a helpful assistant. First give the categories, label it as "Categories:", then the sentiment, label it as "Sentiment:" and finally the Advanced Sentiment, label it as "AdvancedSentiment:".'
        },
        {
          role: 'user',
          content: `Summary: ${summary}
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
          - Solidarity: News that unites people in shared understanding or support for a cause.
           4.Ensure that all generated news content is entirely free of unnecessary characters such as \n, *, extra spaces, or any other extraneous symbols. The content must be precise, clean, and meticulously formatted to maintain a high standard of readability and professionalism. Every element should be concise and well-structured, leaving no room for any formatting errors or irrelevant details.`
        }
      ]
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: messages,
        temperature: 0,
        max_tokens: 1000,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
      })

      const responseText = response.choices[0].message.content.trim()
      const outputSchema = z.object({
        Categories: z.string().min(1),
        Sentiment: z.enum(['Positive', 'Negative', 'Neutral']),
        AdvancedSentiment: z.enum([
          'Optimism', 'Jubilation', 'Hope', 'Relief', 'Progress',
          'Alarm', 'Anger', 'Grief', 'Disappointment', 'Frustration',
          'Informational', 'Matter-of-fact', 'Educational', 'Reporting',
          'Statistic-based', 'Ambivalence', 'Balanced', 'Bittersweet',
          'Compassion', 'Support', 'Solidarity'
        ])
      })

      const [categoriesPart, sentimentPart, advancedSentimentPart] = responseText
        .split(/Categories:|Sentiment:|AdvancedSentiment:/)
        .map(part => part.trim())
        .filter(part => part !== '')

      const parsedOutput = outputSchema.parse({
        Categories: categoriesPart,
        Sentiment: sentimentPart,
        AdvancedSentiment: advancedSentimentPart
      })
      return parsedOutput
    } catch (error) {
      console.error('Error in getAdvancedClassificationGPT', error)
      return error
    }
  }

  async chatGPTAns (context, question) {
    console.log('Sending Question to GPT')
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Answer the question based on the context below'
        },
        {
          role: 'user',
          content: `Context: ${context}
                    Question: ${question}`
        },
        {
          role: 'assistant',
          content: 'Answer: '
        }
      ],
      temperature: 0,
      max_tokens: 256,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0
    })
    return response
  }

  async getFullContentGPT (transcript, language) {
    console.log('Generating full content from GPT')
    try {
      const messages = [
        {
          role: 'system',
          content: `You are a helpful assistant. Give the Full Content in ${language} language and label it as "Full Content:".`
        },
        {
          role: 'user',
          content: `${transcript}
          Generate a news article for the above content`
        }
      ]
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: messages,
        temperature: 0,
        max_tokens: 2000,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
      })
      return response
      return response
    } catch (error) {
      console.error('getFullContentGPT', error)
      return error
      console.error('getFullContentGPT', error)
      return error
    }
  }

  async adDetectorFineTunedModel (news) {
    try {
      const messages = [
        {
          role: 'system',
          content: 'You classify articles into news and ads'
        },
        {
          role: 'user',
          content: `Is this article an ad? Title: ${news.headline}, Article: ${news.summary}?`
        }
      ]
      console.log('Sending News to GPT', messages)
      const fineTunedModel = await openai.chat.completions.create({
        model: process.env.AD_DETECTOR_FINE_TUNED_MODEL_ID,
        messages: messages,
        temperature: 0,
        max_tokens: 1000,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
      })
      return fineTunedModel
    } catch (error) {
      console.error('Error in fineTunedModel', error)
    }
  }

  async getTrendingTitlesFromGpt(topics,trendingData,interval = 3000, maxAttempts = 15) {
    try{
      let dbTopics=[]
      trendingData.map((data)=>{
        if(data.data && data.data!='') dbTopics.push(data.data)
        })
      let filteredTopics = []
      topics.map(group => {
        for(let item of dbTopics){
          if(!group.includes(item)){
              filteredTopics.push(group)
              break
        }
        }}
      )
      const prompt = `
      You are given a list of restricted topics (previously generated or related content). For each item in the filtered list, generate one short topic (maximum 2 words) **only if** it is **not** related in any way to the restricted topics. A topic is considered "related" if it overlaps in meaning, context, or keywords with any of the restricted topics.
      
      Restricted topics:
      ${dbTopics.join(", ")}
      
      Filtered topics:
      ${filteredTopics.join("\n")}
      
      Instructions:
      1. Compare each filtered topic against the restricted topics.
      2. If a filtered topic is related to any restricted topic in meaning, context, or content (even if it is partially related), skip it and **do not** generate a short topic for it.
      3. If a filtered topic is **not** related to any restricted topics, generate one short topic (maximum 2 words).
      4. Avoid all special characters like '**', '-', or any punctuation in the generated topics.
      5. Ensure no duplicate topics are generated.
      6. If **all** filtered topics are related to restricted topics, provide 'No response' in response.
      7.Also check the short topic you are providing is related to any restricted topics
      8.Ensure that all generated news content is entirely free of unnecessary characters such as \n, *, extra spaces, or any other extraneous symbols. The content must be precise, clean, and meticulously formatted to maintain a high standard of readability and professionalism. Every element should be concise and well-structured, leaving no room for any formatting errors or irrelevant details. 
      `;
  

      const message = {
          role: "system",
          content: prompt
        };
      let response
      if(filteredTopics.length>0){
         response = await openai.chat.completions.create({
         model: "gpt-4o-mini",
         messages : [
          { 
            role: "system",
            content: "You are a helpful assistant."
          },
          {
            role: "user",
            content: prompt
          }
        ],   
          max_tokens: 150
        })
      }
      let titles
      let finalData
      if(response && !response.choices[0].message.content.trim().includes('No response')){
        titles = response.choices[0].message.content.trim()
        finalData=titles.split(",")
        return finalData
      }
      else
        titles=""
      
      return titles
  }catch(error){
    console.log("Error while getting Trending topics",error)
  }}

}

module.exports = new GptService();
