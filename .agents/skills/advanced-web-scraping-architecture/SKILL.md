---
name: advanced-web-scraping-architecture
description: >-
  Use this skill when developing, designing, or architecting advanced distributed web scraping applications. It provides the architectural blueprint, technology stack, anti-bot evasion strategies, MCP integration guidelines, and documentation standards for building scalable AI-ready scraping platforms.
---

# Advanced Web Scraping Architecture and Implementation

This skill provides the architectural guidelines, technology stack, and best practices for developing a production-ready, distributed web scraping application designed to function as an AI agent skill (via MCP).

## 1. System Architecture (Control Plane & Data Plane)

The system must be decoupled into two distinct planes to ensure high availability and fault tolerance.

*   **Control Plane (API Web):**
    *   **Technology:** FastAPI.
    *   **Responsibility:** Fast, stateless ingestion of requests, schema validation (Pydantic), API-Key authentication.
    *   **Action:** Validates and immediately pushes the task to the message broker, returning a Job ID. Does NOT execute heavy scraping logic.
*   **Data Plane (Workers):**
    *   **Technology:** Celery (Worker Manager) + Redis/RabbitMQ (Broker & Result Backend).
    *   **Responsibility:** Heavy lifting, DOM rendering, network requests.
    *   **Action:** Pulls tasks from the queue, executes extraction, handles retries, and stores the result (PENDING, SUCCESS, FAILURE).
*   **Queue Design:** Implement logical routing (dedicated queues per domain or urgency level) to avoid the "noisy neighbor" problem.
*   **Process Isolation:** Use Celery's `--max-tasks-per-child` to kill and restart workers after a set number of tasks, preventing zombie processes and memory leaks. Use Playwright "Browser Contexts" for isolated sessions without the overhead of launching full browsers per request.

## 2. Core Technologies & Extraction Engine

*   **Engine:** Crawlee (Python) or Playwright.
*   **Strategy:** Use `AdaptivePlaywrightCrawler` to dynamically choose between fast HTTP requests (`httpx`) for static content and full browser rendering for SPAs.

## 3. Anti-Bot Evasion & Network Mimicry

Do not rely solely on IP rotation or simple User-Agent spoofing.

*   **TLS Fingerprinting (JA3/JA4 Evasion):** Avoid standard `requests` or `httpx` for heavily protected sites. Use `curl_cffi` to mimic the exact TLS ClientHello structure (Cipher Suites, extensions, curves) of modern browsers (e.g., Chrome).
*   **Browser Fingerprinting:** For sites executing complex JS challenges or checking WebGL/Canvas/AudioContext, use **Camoufox** (integrated with Playwright) to actively spoof browser fingerprints and hide `navigator.webdriver`.
*   **Rate Limiting:** Implement global rate limiting using Distributed Locks or Token Bucket algorithms via Redis to respect target domains and avoid aggressive blocking. Use Exponential Backoff for retries.

## 4. Model Context Protocol (MCP) Integration

The scraping platform must act as an AI tool by exposing an MCP server (JSON-RPC 2.0 over SSE).

*   **Required Tools to Expose:**
    *   `scrape_url`: Synchronous detailed extraction of a specific URL (returns Markdown).
    *   `batch_scrape`: Enqueues an array of URLs and returns a Batch ID immediately.
    *   `discover_links` / `map`: Analyzes domain topology without downloading full bodies.
    *   `check_batch_status`: Retrieves the status/results of a previously enqueued Batch ID.
*   **Context Efficiency:** Clean the DOM and convert HTML to pristine Markdown before returning data to the LLM to prevent context bloat. For massive datasets, return statistical summaries or data pointers instead of raw data.

## 5. UI & Dashboard Design

For human operators managing the system:

*   **Stack:** Next.js + Tailwind CSS + Shadcn/UI (or Convex templates).
*   **Required Views:**
    *   **Telemetry Overview:** Worker load, queue health, error rates.
    *   **Extraction Configurator:** Dynamic forms for URL input, Pydantic schema visual builder, toggles for advanced evasion (`curl_cffi`, `Camoufox`).
    *   **Async Job Monitor:** Live, filterable table showing extraction progress (via WebSockets/SSE) with download options (JSON, CSV, JSONLines).
    *   **API Management:** Issuance and revocation of API keys.

## 6. Advanced Use Case: Spatial Grid Search (e.g., Google Maps)

To bypass hard limits on search results (e.g., 120 results max):

*   Implement **Grid Search** using the **H3 spatial index**.
*   Subdivide the target Bounding Box into small hexagonal cells.
*   Enqueue each coordinate as an independent task in Celery to ensure the density of results per cell falls below the platform's limit.
*   Aggregate, cross-reference, and deduplicate the extracted entities in the Result Backend.

## 7. Documentation Standards (Diátaxis Framework)

Documentation must be strictly organized into the four quadrants of the Diátaxis framework to prevent "Content Drift":

1.  **Tutorials:** Hand-holding for beginners (e.g., "Your first scraping task").
2.  **How-To Guides:** Problem-oriented steps (e.g., "How to configure rotating proxies").
3.  **Reference:** Information-oriented, austere facts (e.g., "MCP API schema definitions").
4.  **Explanation:** Understanding-oriented background (e.g., "Why we decoupled ingestion from workers").
