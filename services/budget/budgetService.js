
const pdf_parse = require("pdf-parse");
// const { CSVLoader } = require("@langchain/community/document_loaders/fs/csv");
// const __constants = require("../../config/constants");
const OpenAI = require("openai");
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY2,
});
const langsmith_trace = require("langsmith/traceable");
const langchainTextSplitter = require("langchain/text_splitter");
const langchainDocument = require("langchain/document");
const chatGpt = require("@langchain/openai");
const chains = require("langchain/chains");
const promptTemplate = require("@langchain/core/prompts");
// const langchainOpenAI = require("@langchain/openai");
// const { loadSummarizationChain } = require("langchain/chains");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
// const fs = require("fs");
const { uuid } = require("uuidv4");
const { Pinecone } = require("@pinecone-database/pinecone");

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY2,
});

// const RagDocs = require("../../mongooseSchema/RagDocs");
// const { compile } = require("html-to-text");
// const {
//   RecursiveUrlLoader,
// } = require("@langchain/community/document_loaders/web/recursive_url");

const index = pinecone.index("budget-rag");

class BudgetService {
  async getPdfText(pdf) {
    try {
      let pdfData = await pdf_parse(pdf);
      return pdfData.text;
    } catch (error) {
      console.log(error);
    }
  }
  async createInsights(persona, text, language) {
    try {
      console.log("Creating Insights");
      const llm_tracer = await langsmith_trace;
      const text_splitter = await langchainTextSplitter;
      const doc_worker = await langchainDocument;
      const chat_gpt = await chatGpt;
      const insight_chain = await chains;
      const prompt_template = await promptTemplate;
      // extract text from pdf file
      // let pdfData = await pdf_parse(pdf);
      const docs = [new doc_worker.Document({ pageContent: text })];
      const splitter = new text_splitter.TokenTextSplitter({
        chunkSize: 10000,
        chunkOverlap: 250,
      });
      const docsSummary = await splitter.splitDocuments(docs);
      let summary_logs;
      const llmSummary = new chat_gpt.ChatOpenAI({
        modelName: "gpt-4o",
        temperature: 0,
        callbacks: [
          {
            async handleLLMEnd(output) {
              summary_logs = output;
            },
          },
        ],
      });

      // summary template for creating useful insights as per the persona
      const summaryTemplate = `
        You are an expert in creating insights from national budget documents. Your goal is to create insights based on the persona provided. 
        Ensure that the insights are relevant to the persona and cover all significant points mentioned in the document. 
  
        Persona: ${persona}
  
        Instructions:
        1. Highlight the key points that are specifically relevant to the persona.
        2. Avoid general information unless it has a significant impact on the persona.
        3. Provide actionable insights and implications for the persona.
        4. Use clear and concise language.
        5. Where applicable, include examples to illustrate points.
  
        Below you find the content of the national budget document:
        -------- {text} --------
  
        Total output will be useful insights based on the persona provided.
  
        INSIGHTS:
        `;

      const SUMMARY_PROMPT =
        prompt_template.PromptTemplate.fromTemplate(summaryTemplate);

      const summaryRefineTemplate = `
        You are an expert in creating insights from national budget documents. Your goal is to create insights based on the persona provided. 
        Ensure that the insights are relevant to the persona and cover all significant points mentioned in the document. 
  
        Persona: ${persona}
  
        Instructions:
        1. Highlight the key points that are specifically relevant to the persona.
        2. Avoid general information unless it has a significant impact on the persona.
        3. Provide actionable insights and implications for the persona.
        4. Use clear and concise language.
        5. Where applicable, include examples to illustrate points.
  
        We have provided an existing insight up to a certain point:
        {existing_answer}
  
        Below you find the content of the national budget document:
        -------- {text} --------
  
        Given the new context, refine the insights. If the context isn't useful, return the original insights.
  
        Total output will be useful insights based on the persona provided.
  
        INSIGHTS:
        `;

      const INSIGHTS_REFINE_PROMPT =
        prompt_template.PromptTemplate.fromTemplate(summaryRefineTemplate);
      let summary = "";
      const llm_summariser = llm_tracer.traceable(async function callOpenAi(
        llm,
        summary_prompt,
        summary_refine_prompt
      ) {
        const summarizeChain = insight_chain.loadSummarizationChain(llm, {
          type: "refine",
          verbose: true,
          questionPrompt: summary_prompt,
          refinePrompt: summary_refine_prompt,
        });
        summary = await summarizeChain.run(docsSummary);
      });
      await llm_summariser(llmSummary, SUMMARY_PROMPT, INSIGHTS_REFINE_PROMPT);
      if (language == "English") {
        return summary;
      }
      const translation = await this.translateText(summary, language);
      return translation;
    } catch (error) {
      console.log(error);
    }
  }

  async pushDocumentsToPinecone(files) {
    // await this.deleteVectorsFromPinecone()
    // return "Doneeee"
    const fileData = files;
    // await index.deleteAll();
    let count = 1;
    for (const file of fileData) {
      const pdfData = await pdf_parse(file.buffer);
      let formattedText = pdfData.text;
      const originalDocName = file.originalname;
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });
      const docs = await splitter.createDocuments([formattedText]);
      docs.forEach((doc) => {
        doc.id = uuid();
      });
      const batch_size = 100;
      let embeddings = [];
      for (let i = 0; i < docs.length; i += batch_size) {
        const i_end = Math.min(docs.length, i + batch_size);
        const meta_batch = docs.slice(i, i_end);
        const ids_batch = meta_batch.map((x) => x.id);
        const texts_batch = meta_batch.map((x) => x.pageContent);
        let response;
        try {
          response = await openai.embeddings.create({
            model: "text-embedding-3-large",
            input: texts_batch,
          });
        } catch (error) {
          console.log(error);
        }
        embeddings = response.data.map((record) => record.embedding);
        for (let j = 0; j < embeddings.length; j++) {
          docs[j + i].embeddings = embeddings[j];
        }
        const meta_batch_cleaned = meta_batch.map((x) => ({
          context: x.pageContent,
          // docIdInDb:
          source: originalDocName,
        }));
        const to_upsert = ids_batch.map((id, i) => ({
          id: id,
          values: embeddings[i],
          metadata: meta_batch_cleaned[i],
        }));
        await index.upsert(to_upsert);
        console.log("Successfully uploaded", i / 100);
      }
      // console.log("Saving in DB", originalDocName)
      // try {
      //     ragDoc.docChunks = docs
      //     await ragDoc.save()
      // } catch (error) {
      //     console.log(error)
      // }
      console.log("File Doneee", count);
      count++;
    }
    return "Doneeeeeeee";
  }
  async getRelevantContexts(question) {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-large",
      input: question,
    });
    const questionEmbedding = response.data[0].embedding;
    const queryResponse = await index.query({
      vector: questionEmbedding,
      //   filter: {
      //     docIdInDb: { $eq: docId.toString() },
      //   },
      topK: 5,
      includeMetadata: true,
    });
    const contexts = queryResponse.matches.map(
      (match) => match.metadata.context
    );
    const allSources = queryResponse.matches.map(
      (match) => match.metadata.source
    );
    // console.log("Contextsssss", queryResponse.matches)
    const finalContext = contexts
      .filter(function (str) {
        return str !== undefined;
      })
      .join("");
    const uniqueSources = [...new Set(allSources)];
    const finalSources = uniqueSources.join(", ");
    console.log("Final Sources", finalSources);
    const finalObj = {
      contexts: finalContext,
      sources: finalSources,
    };
    return finalObj;
  }
  async askQna(question, prompt) {
    try {
      const context = await this.getRelevantContexts(question);
      let response = await this.askGPT(question, context.contexts, prompt);
      response = JSON.parse(response);
      // let sourcesArray = [];
      // if (context.sources != "") {
      //   sourcesArray = context.sources.split(", ");
      //   response.sources = sourcesArray;
      // }
      return response;
    } catch (error) {
      console.log(error);
      return error;
    }
  }
  async askGPT(question, context, promptBody) {
    let prompt = `You are a helpful assistant that answers the given question accurately based on the context provided to you. Make sure you answer the question in as much detail as possible, providing a comprehensive explanation. Do not hallucinate or answer the question by yourself. Give the final answer in the following JSON format: {\n  \"answer\": final answer of the question based on the context provided to you,\n}`;
    if (promptBody) {
      prompt = promptBody;
      prompt +=
        ' Give the final answer in the following JSON format: {\n  "answer": final answer of the question based on the context provided to you,\n}';
    }
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: prompt,
        },
        {
          role: "user",
          content: `Context: ${context}
                Question: ${question} and if possible explain the answer in detail`,
        },
      ],
      temperature: 0,
      response_format: {
        type: "json_object",
      },
    });
    return response.choices[0].message.content;
  }
  async formatTextOpenAI(text) {
    const response = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that formats the given text properly. You will add proper punctuation, spaces between words and other necessary things to make the text more readable.",
        },
        {
          role: "user",
          content: `This is the text to be formatted
                Text: ${text}
                Return only the formatted text, nothing else extra`,
        },
        {
          role: "assistant",
          content: "Answer: ",
        },
      ],
      model: "gpt-4o",
    });
    return response.choices[0].message.content;
  }
  async translateText(text, language) {
    const response = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a translation expert. Translate the following text to ${language}:`,
        },
        {
          role: "user",
          content: `Text: ${text}`,
        },
        {
          role: "assistant",
          content: "Translation: ",
        },
      ],
      model: "gpt-4o",
    });
    return response.choices[0].message.content;
  }
}
module.exports = new BudgetService();
