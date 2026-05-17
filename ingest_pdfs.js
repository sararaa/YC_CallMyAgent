import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Supermemory from 'supermemory';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read .env.local
function loadEnv() {
  const envPath = path.join(__dirname, '.env.local');
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, 'utf-8')
    .split('\n')
    .forEach(line => {
      const [key, ...rest] = line.replace(/^export\s+/, '').split('=');
      if (key && rest.length) {
        process.env[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
      }
    });
}

loadEnv();

const client = new Supermemory({
  apiKey: process.env.SUPERMEMORY_API_KEY,
});

const DATA_DIR = path.join(__dirname, 'Data_RAG');
const CONTAINER_TAG = 'rag_data'; // tag all docs for easy retrieval

async function ingest() {
  const files = fs.readdirSync(DATA_DIR).filter(f => f.toLowerCase().endsWith('.pdf'));

  if (files.length === 0) {
    console.log('No PDFs found in Data_RAG/. Add PDFs there and re-run.');
    return;
  }

  console.log(`Found ${files.length} PDF(s). Uploading to Supermemory...`);

  for (const filename of files) {
    const filePath = path.join(DATA_DIR, filename);
    console.log(`  Uploading: ${filename}`);
    try {
      const response = await client.documents.uploadFile({
        file: fs.createReadStream(filePath),
        fileType: 'pdf',
        containerTags: CONTAINER_TAG,
        metadata: JSON.stringify({ source: filename }),
      });
      console.log(`  ✓ ${filename} → id: ${response.id}`);
    } catch (err) {
      console.error(`  ✗ ${filename} failed: ${err.message}`);
    }
  }

  console.log('\nDone. Search your docs like this:');
  console.log('  const results = await client.search.execute({ q: "your query", containerTags: ["rag_data"] });');
}

ingest();
