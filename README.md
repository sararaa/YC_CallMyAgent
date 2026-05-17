# YC_CallMyAgent
Y-Combinator CallMyAgent Hackathon

How to use Supermemory for PDF RAG
1. Add your PDFs
Drop any .pdf files into Data_RAG/.

2. Run the ingestion script

cd /Users/suhanishokeen/YC_CallMyAgent
npm run ingest
This reads your .env.local automatically, uploads every PDF in Data_RAG/ to Supermemory, and tags them with rag_data so you can filter queries later.

3. Query from your RAG agent

import Supermemory from 'supermemory';

const client = new Supermemory({ apiKey: process.env.SUPERMEMORY_API_KEY });

const results = await client.search.execute({
  q: "your question here",
  containerTags: ["rag_data"],
});

// results.results[0].content has the relevant chunks
Key things to know:

Supermemory uses Mistral OCR + Gemini to parse PDFs automatically — no manual chunking needed.
containerTags acts like a namespace/collection, so your RAG data is isolated from other memories.
Your SUPERMEMORY_API_KEY is the one starting with sm_uAH611... (not the CLAUDE_SUPERMEMORY one — that appears to be a second key, possibly for a different container).
