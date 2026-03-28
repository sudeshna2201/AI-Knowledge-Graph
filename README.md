# AI-Based Knowledge Graph Builder for Enterprise Intelligence

A two-milestone AI pipeline built on the Enron Email Dataset:

1. Milestone 2 extracts named entities and semantic relationships from emails and stores them in Neo4j.
2. Milestone 3 provides Hybrid RAG question answering by combining Neo4j graph retrieval, Pinecone semantic retrieval, and LLM generation for grounded responses.

---

## Project Structure

- Milestone-2.py  
  Entity and relationship extraction pipeline (Neo4j -> LLM -> Neo4j)
- MIlestone-3.py  
  Hybrid RAG query pipeline (Pinecone + Neo4j + LLM)
- requirements.txt  
  Python dependencies
- result.txt  
  Sample output logs

---

## Prerequisites

1. Python 3.10 or newer
2. Neo4j instance (AuraDB or local)
3. Pinecone account and API key
4. LLAMA API key
5. Email dataset CSV with columns:
   - message_id
   - body or body_cleaned
   - subject

---

## Setup

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure environment variables

Use the project .env file in the root with these keys:

```env
LLAMA_API_KEY=your_llama_api_key_here
NEO4J_URI=neo4j+s://your-instance.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_neo4j_password_here
NEO4J_DATABASE=neo4j
PINECONE_API_KEY=your_pinecone_api_key_here
```

Notes:

1. Never commit .env to git.
2. Keep .env.example free of real secrets.

---

## Milestone 2: Knowledge Graph Builder

File: Milestone-2.py

### What it does

1. Reads unprocessed Email nodes from Neo4j.
2. Cleans and preprocesses email text.
3. Sends cleaned content to LLM for structured extraction.
4. Parses JSON entities and relationships.
5. Validates and normalizes extracted values.
6. Writes Entity nodes and typed relationships into Neo4j.
7. Marks emails as processed with entity_extracted = true.

### Entity types used

1. Person
2. Organization
3. Location
4. FinancialTerm
5. Project
6. EnergyTerm
7. Regulation
8. Event

### Key Milestone 2 config values

1. BATCH_SIZE = 10
2. MAX_BODY_CHARS = 3500
3. MAX_RETRIES = 2
4. MODEL_NAME = ministral-3:14b

### Run Milestone 2

```bash
python Milestone-2.py
```

---

## Milestone 3: Hybrid RAG Query Interface

File: MIlestone-3.py

### What it does

For each user question:

1. Vector retrieval:
   - Searches Pinecone for top semantic email chunks.
2. Graph retrieval:
   - Queries Neo4j for structured relationship facts.
3. Hybrid context:
   - Combines graph facts and email snippets into one context block.
4. LLM generation:
   - Sends context + question to model for grounded answer output.

### Current Milestone 3 config values

1. PINECONE_INDEX = email-knowledge-graph
2. EMBED_MODEL = multilingual-e5-large
3. EMBED_DIM = 1024
4. VECTOR_TOP_K = 5
5. GRAPH_FACTS_LIMIT = 5
6. CHUNK_SIZE = 500
7. CHUNK_OVERLAP = 50
8. MODEL_NAME = gpt-oss:120b-cloud

### One-time vector indexing

In MIlestone-3.py, set EMAIL_CSV path and uncomment build_vector_index call.

### Run Milestone 3

```bash
python MIlestone-3.py
```

You will get an interactive prompt. Type exit to quit.

---

## Full Pipeline Order

1. Load email data into Neo4j Email nodes.
2. Run Milestone 2 to extract entities and relationships.
3. Run Milestone 3 one time with vector index build enabled.
4. Run Milestone 3 for interactive Hybrid RAG queries.

---

## Dependencies

From requirements.txt:

1. neo4j
2. python-dotenv
3. requests
4. pinecone
5. langchain-pinecone
6. langchain-core
7. langchain-text-splitters
8. langchain-groq
9. pandas
10. jupyter
11. ipykernel

---

## Troubleshooting

1. Missing NEO4J_PASSWORD:
   - Set NEO4J_PASSWORD in .env
2. Missing LLAMA_API_KEY:
   - Set LLAMA_API_KEY in .env
3. Missing PINECONE_API_KEY:
   - Set PINECONE_API_KEY in .env
4. No vector results:
   - Confirm Pinecone index was built from CSV
5. Neo4j retrieval issues:
   - Verify NEO4J_URI, username, password, and database name

---

## Example Milestone 3 questions

1. Who communicated most about natural gas trading?
2. What relationships involve FERC?
3. Who sent the most emails about a given entity?
4. What entities are linked to EnronOnline?

---

Built with Neo4j, Pinecone, LLM APIs, LangChain, and Python.
