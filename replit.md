# AI-Based Knowledge Graph Builder for Enterprise Intelligence

## Overview
A two-milestone AI pipeline built on the Enron Email Dataset that extracts named entities and relationships, stores them in Neo4j, and provides a Hybrid RAG query interface.

## Architecture
- **Milestone-2.py**: Reads email nodes from Neo4j, uses an LLM to extract entities/relationships, and writes them back to Neo4j.
- **MIlestone-3.py**: Hybrid RAG query pipeline — combines Pinecone vector search and Neo4j graph retrieval with an LLM to answer questions interactively.

## Tech Stack
- **Language**: Python 3.12
- **Knowledge Graph**: Neo4j (AuraDB or local)
- **Vector Store**: Pinecone
- **LLM Orchestration**: LangChain (langchain-groq, langchain-pinecone)
- **HTTP**: requests (for OpenRouter API calls in Milestone 2)
- **Data**: pandas (CSV loading)

## Environment Variables Required
Set these in Replit Secrets:
- `LLAMA_API_KEY` — API key for the LLM used in Milestone 2
- `NEO4J_URI` — Neo4j connection URI (e.g., `neo4j+s://xxx.databases.neo4j.io`)
- `NEO4J_USERNAME` or `NEO4J_USER` — Neo4j username (default: `neo4j`)
- `NEO4J_PASSWORD` — Neo4j password
- `NEO4J_DATABASE` — Neo4j database name (default: `neo4j`)
- `PINECONE_API_KEY` — Pinecone API key

## Workflow
- **Start application**: Runs `python MIlestone-3.py` (interactive Hybrid RAG query console)

## Running the Pipeline
1. Load email data into Neo4j as Email nodes.
2. Run `python Milestone-2.py` to extract entities/relationships (sets up the knowledge graph).
3. Run `python MIlestone-3.py` once with `build_vector_index()` uncommented to index emails in Pinecone.
4. Run `python MIlestone-3.py` for interactive Hybrid RAG queries.

## Dependencies
Installed via `pip install -r requirements.txt`. Key packages:
- neo4j, pinecone, langchain-pinecone, langchain-groq, langchain-text-splitters, langchain-core, python-dotenv, requests, pandas, jupyter, ipykernel
