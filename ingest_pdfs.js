import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Supermemory, { toFile } from 'supermemory';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

const client = new Supermemory({ apiKey: process.env.SUPERMEMORY_API_KEY });
const DATA_DIR = path.join(__dirname, 'Data_RAG');
const CONTAINER_TAG = 'rag_data';

async function getExistingDocs() {
  const existing = { done: new Set(), failedIds: [] };
  let page = 1;

  while (true) {
    const res = await client.documents.list({
      containerTags: [CONTAINER_TAG],
      limit: 100,
      page,
    });

    for (const doc of res.memories) {
      const source = doc.metadata?.source;
      if (!source) continue;
      if (doc.status === 'done') {
        existing.done.add(source);
      } else if (doc.status === 'failed') {
        existing.failedIds.push({ id: doc.id, source });
      }
    }

    if (res.memories.length < 100) break;
    page++;
  }

  return existing;
}

async function ingest() {
  const files = fs.readdirSync(DATA_DIR).filter(f => f.toLowerCase().endsWith('.pdf'));

  if (files.length === 0) {
    console.log('No PDFs found in Data_RAG/. Add PDFs there and re-run.');
    return;
  }

  console.log('Checking existing documents in Supermemory...');
  const { done: alreadyUploaded, failedIds } = await getExistingDocs();

  // Delete failed docs so they can be re-uploaded cleanly
  if (failedIds.length > 0) {
    console.log(`Cleaning up ${failedIds.length} previously failed doc(s)...`);
    for (const { id, source } of failedIds) {
      try {
        await client.documents.delete(id);
        console.log(`  Deleted failed: ${source}`);
      } catch (err) {
        console.warn(`  Could not delete ${id}: ${err.message}`);
      }
    }
  }

  const toUpload = files.filter(f => !alreadyUploaded.has(f));
  const skipped = files.length - toUpload.length;

  if (skipped > 0) console.log(`Skipping ${skipped} already-uploaded PDF(s).`);
  if (toUpload.length === 0) {
    console.log('All PDFs already in Supermemory. Nothing to do.');
    return;
  }

  console.log(`Uploading ${toUpload.length} new PDF(s)...`);

  for (const filename of toUpload) {
    const filePath = path.join(DATA_DIR, filename);
    process.stdout.write(`  ${filename} ... `);
    try {
      // toFile with explicit MIME type is required — raw ReadStream has no type info
      const file = await toFile(fs.createReadStream(filePath), filename, {
        type: 'application/pdf',
      });
      const response = await client.documents.uploadFile({
        file,
        fileType: 'pdf',
        containerTags: CONTAINER_TAG,
        metadata: JSON.stringify({ source: filename }),
      });
      console.log(`✓ id: ${response.id}`);
    } catch (err) {
      console.log(`✗ ${err.message}`);
    }
  }

  console.log('\nDone.');
}

ingest();
