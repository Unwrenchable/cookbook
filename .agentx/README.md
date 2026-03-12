# .agentx – GoonForge / TokenForge Agent Registry

This directory contains the merged agent registry and access profiles for the
`Unwrenchable/cookbook` (GoonForge) project, following the `Unwrenchable/agent-tools`
agentx standard.

The registry merges:
- **13 GoonForge domain agents** (domain-specific: Solana, EVM, cross-chain, frontend, security, marketing)
- **3 Cookbook-specific meta-agents** (orchestrator, implementation pilot, repo architect)
- **46 generic agency agents** imported from the `Unwrenchable/ATOMIC-FIZZ-CAPS-VAULT-77-WASTELAND-GPS`
  agency pack (covers analytics, DevOps, UX, product, mobile, XR, legal, finance, etc.)

**Total: 62 agents registered.**

## Quick usage

```bash
# Install agent-tools (optional – registry is also readable as plain JSON)
pip install -e /path/to/agent-tools

# List all registered agents
python -m agent_tools.cli list

# Find an agent by capability
python -m agent_tools.cli find cross-chain
python -m agent_tools.cli find solana
python -m agent_tools.cli find testing

# Check access profile
python -m agent_tools.cli check goon-solidity-master --profile balanced
python -m agent_tools.cli recommend tokenforge-agent
```

## GoonForge domain agents

| ID | Role | Profile | Risk |
|----|------|---------|------|
| `tokenforge-agent` | Full-stack TokenForge builder | power | medium |
| `solana-specialist` | Anchor/SPL/Metaplex developer | balanced | medium |
| `evm-contract-engineer` | Solidity + Hardhat developer | balanced | medium |
| `cross-chain-orchestrator` | Wormhole bridge flow coordinator | power | medium |
| `security-auditor` | Smart contract security review | safe | low |
| `goon-solidity-master` | EVM Solidity Contract God | balanced | medium |
| `fren-frontend-goon` | Next.js 15 + wagmi Frontend Degen | balanced | medium |
| `trench-tester` | Paranoid Test and Security Goon | balanced | low |
| `meme-lord-agent` | Viral Meme and AI Content Goon | balanced | low |
| `goon-overlord` | Squad Leader and Repo Coordinator | power | medium |
| `cookbook-orchestrator` | Cookbook Multi-Agent Orchestrator | power | medium |
| `cookbook-implementation-pilot` | Cookbook Implementation Pilot | balanced | medium |
| `cookbook-repo-architect` | Cookbook Repository Architect | safe | low |

## Goon squad shorthand (rules.md)

```
@GoonSolidityMaster  → EVM contracts + Hardhat tests
@FrenFrontendGoon    → Next.js 15 / wagmi v2 UI
@TrenchTester        → Test coverage + Slither audits
@MemeLordAgent       → Token copy + X launch threads
@GoonOverlord        → Full squad coordination
```

## Full agent table (62 agents)

| ID | Role | Profile | Risk |
|----|------|---------|------|
| `tokenforge-agent` | TokenForge Full-Stack Builder | power | medium |
| `solana-specialist` | Solana Program Specialist | balanced | medium |
| `evm-contract-engineer` | EVM Smart Contract Engineer | balanced | medium |
| `cross-chain-orchestrator` | Cross-Chain Flow Orchestrator | power | medium |
| `security-auditor` | Smart Contract Security Auditor | safe | low |
| `orchestrator` | Workflow Orchestrator | power | medium |
| `implementation-engineer` | Implementation Engineer | balanced | medium |
| `capability-guardian` | Capability Guardian | safe | low |
| `goon-solidity-master` | EVM Solidity Contract God | balanced | medium |
| `fren-frontend-goon` | Next.js 15 + wagmi Frontend Degen | balanced | medium |
| `trench-tester` | Paranoid Test and Security Goon | balanced | low |
| `meme-lord-agent` | Viral Meme and AI Content Goon | balanced | low |
| `goon-overlord` | Squad Leader and Repo Coordinator | power | medium |
| `agents-orchestrator` | agents-orchestrator | power | medium |
| `analytics-reporter` | Analytics Reporter | balanced | medium |
| `api-tester` | API Tester | balanced | medium |
| `app-store-optimizer` | App Store Optimizer | balanced | medium |
| `architectux` | ArchitectUX | power | medium |
| `backend-architect` | Backend Architect | balanced | medium |
| `brand-guardian` | Brand Guardian | balanced | medium |
| `data-analytics-reporter` | data-analytics-reporter | balanced | medium |
| `design-visual-storyteller` | design-visual-storyteller | balanced | medium |
| `devops-automator` | DevOps Automator | power | medium |
| `engineering-ai-engineer` | engineering-ai-engineer | balanced | medium |
| `engineering-senior-developer` | engineering-senior-developer | balanced | medium |
| `evidenceqa` | EvidenceQA | balanced | medium |
| `executive-summary-generator` | Executive Summary Generator | balanced | medium |
| `experiment-tracker` | Experiment Tracker | balanced | medium |
| `finance-tracker` | Finance Tracker | balanced | medium |
| `frontend-developer` | Frontend Developer | balanced | medium |
| `infrastructure-maintainer` | Infrastructure Maintainer | balanced | medium |
| `legal-compliance-checker` | Legal Compliance Checker | balanced | medium |
| `lsp-index-engineer` | LSP/Index Engineer | balanced | medium |
| `macos-spatial-metal-engineer` | macOS Spatial/Metal Engineer | balanced | medium |
| `marketing-content-creator` | marketing-content-creator | safe | low |
| `marketing-growth-hacker` | marketing-growth-hacker | balanced | medium |
| `marketing-social-media-strategist` | marketing-social-media-strategist | safe | low |
| `mobile-app-builder` | Mobile App Builder | power | medium |
| `performance-benchmarker` | Performance Benchmarker | balanced | medium |
| `product-feedback-synthesizer` | product-feedback-synthesizer | safe | low |
| `product-sprint-prioritizer` | product-sprint-prioritizer | balanced | medium |
| `product-trend-researcher` | product-trend-researcher | balanced | medium |
| `project-manager-senior` | project-manager-senior | balanced | medium |
| `project-shepherd` | Project Shepherd | power | medium |
| `rapid-prototyper` | Rapid Prototyper | balanced | medium |
| `repo-auditor` | Repository Auditor | safe | low |
| `studio-operations` | Studio Operations | balanced | medium |
| `studio-producer` | Studio Producer | balanced | medium |
| `support-responder` | Support Responder | balanced | medium |
| `test-results-analyzer` | Test Results Analyzer | balanced | medium |
| `testing-reality-checker` | testing-reality-checker | balanced | medium |
| `tool-evaluator` | Tool Evaluator | balanced | medium |
| `ui-designer` | UI Designer | balanced | medium |
| `ux-researcher` | UX Researcher | power | medium |
| `whimsy-injector` | Whimsy Injector | balanced | medium |
| `workflow-optimizer` | Workflow Optimizer | balanced | medium |
| `xr-cockpit-interaction-specialist` | XR Cockpit Interaction Specialist | balanced | medium |
| `xr-immersive-developer` | XR Immersive Developer | balanced | medium |
| `xr-interface-architect` | XR Interface Architect | safe | low |
| `cookbook-orchestrator` | Cookbook Multi-Agent Orchestrator | power | medium |
| `cookbook-implementation-pilot` | Cookbook Implementation Pilot | balanced | medium |
| `cookbook-repo-architect` | Cookbook Repository Architect | safe | low |

## Import from other repos

```bash
# Pull latest agency pack from ATOMIC-FIZZ-CAPS
git clone --depth 1 https://github.com/Unwrenchable/ATOMIC-FIZZ-CAPS-VAULT-77-WASTELAND-GPS.git /tmp/fizz-agents
python -m agent_tools.cli import-agency /tmp/fizz-agents --merge --merge-target .agentx/agents.json

# Pull from agent-tools core
git clone --depth 1 https://github.com/Unwrenchable/agent-tools.git /tmp/agent-tools
python -m agent_tools.cli import-agency /tmp/agent-tools --merge --merge-target .agentx/agents.json
```

## Access profiles

| Profile | Write | Network | Secrets | Notes |
|---------|-------|---------|---------|-------|
| `safe` | ✗ | ✗ | none | Read-only analysis |
| `balanced` | ✓ | ✗ | masked | Default coding |
| `power` | ✓ | ✓ | scoped | Cross-repo orchestration |
