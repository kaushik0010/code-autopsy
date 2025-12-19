# 🚑 CodeAutopsy: The Self-Healing CI/CD Agent

> **"Don't just log the error. Fix it."**

CodeAutopsy is an intelligent AI Agent that monitors your CI/CD pipelines. When a build fails, it doesn't just send an alert—it **diagnoses the root cause**, **reads your source code**, and **automatically opens a Pull Request** with the fix.

[![Powered by Gemini](https://img.shields.io/badge/AI-Google%20Gemini-blue)](https://deepmind.google/technologies/gemini/)
[![Built with Motia](https://img.shields.io/badge/Agent-Motia-purple)](https://motia.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[CodeAutopsy Demo](https://youtu.be/V_pziwbWW0U)

---

## 🌟 Features

### 🧠 Context-Aware Diagnosis (V2.0)
Unlike basic tools that only read error logs, CodeAutopsy uses **GenAI Vision** to:
1.  **Scout:** Identify exactly which file caused the crash.
2.  **Retrieve:** Download the actual source code from the repository.
3.  **Analyze:** detailed comparison of the code vs. the error log to generate a precise surgical fix.

### ⚡ Support for Any Stack
Works out-of-the-box with:
* ⚛️ **React / Next.js** (Syntax errors, missing components)
* 🐍 **Python / Django** (Indentation errors, typos)
* 🐳 **Docker / Shell** (Misconfigured build steps)
* 🦀 **Rust, Go, Java, and more...**

### 🛡️ Infinite Loop Protection
Includes a **Recursion Guard** that detects if its own fixes fail. It automatically stops operation to prevent spamming your repository with bad Pull Requests.

### 📢 Real-Time Notifications
Receive rich, actionable alerts directly in **Discord** or Slack the moment a fix is deployed.

---

## 🏗️ Architecture

[Github Webhook] --> [Motia Server] --> [Gemini AI Analysis] --> [Octokit Surgeon] --> [Pull Request]

1.  **Listener:** Intercepts `workflow_job.failure` webhooks from GitHub.
2.  **The Scout:** Gemini Flash scans logs to identify the broken file path.
3.  **The Retriever:** Fetches the *current* file content via GitHub API.
4.  **The Surgeon:** Gemini generates a corrected version of the code.
5.  **The Operator:** Opens a new branch (e.g., `autopsy/fix-123`) and creates a PR.
6.  **The Broadcaster:** Sends a "Fix Deployed" card to Discord.

---

## 🚀 Getting Started

### Prerequisites
* Node.js v18+
* A GitHub Repository (to monitor)
* Google Gemini API Key
* Discord Webhook URL

### Installation

1.  **Clone the repo**
    ```bash
    git clone https://github.com/kaushik0010/code-autopsy.git
    cd code-autopsy
    npm install
    ```

2.  **Configure Environment**
    Create a `.env` file:
    ```env
    GITHUB_TOKEN=ghp_your_token_here
    GEMINI_API_KEY=your_gemini_key_here
    DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
    ```

3.  **Start the Agent**
    ```bash
    npm run dev
    ```

4.  **Expose to Internet**
    Use ngrok to make your local server reachable by GitHub:
    ```bash
    ngrok http 3000
    ```

5.  **Connect GitHub**
    * Go to your target repo -> **Settings** -> **Webhooks**.
    * Add Payload URL: `https://<your-ngrok-url>/webhooks/github`
    * Select events: **Workflow jobs**.

---

## 📸 Demo Scenarios

### Scenario 1: Broken Python Script
* **Error:** `SyntaxError: '(' was never closed`
* **Agent Action:** Detects `src/app.py`, identifies missing parenthesis, pushes fix.

### Scenario 2: React Build Fail
* **Error:** `Module not found: Can't resolve './Headre'`
* **Agent Action:** Detects typo in `import`, corrects it to `./Header`.

---

## 🔮 Roadmap & Monetization

### Business Model: The "BYOK" Strategy
CodeAutopsy operates on a **Bring Your Own Key (BYOK)** model. This ensures infinite scalability with near-zero overhead.
* **Open Source (Free):** Developers use their own Gemini API Keys. We provide the "Scout & Surgeon" architecture for free on public repositories.
* **Pro Tier:** Adds "Team Features" like Discord/Slack integration, Private Repo support, and Custom Linting Rules.
* **Enterprise:** Self-hosted docker containers for VPC deployment (Banks/Healthcare) with centralized billing and Audit Logs.

### Future Vision (V3.0)
* **Auto-Merge:** Automatically merge high-confidence fixes (e.g., typos, formatting) without human review.
* **Preventative Medicine:** Analyze code *before* it is pushed to predict potential CI failures.
* **CTO Dashboard:** An analytics frontend to track "Developer Hours Saved" and "Most Frequent Bugs."

---

*Built for the Motia Backend Reloaded Hackathon 2025.*