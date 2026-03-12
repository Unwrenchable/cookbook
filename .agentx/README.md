# .agentx – TokenForge Agent Registry

This directory contains the agent registry and access profiles for the TokenForge project, following the `Unwrenchable/agent-tools` agentx standard.

## Usage

```bash
# Install agent-tools
pip install -e /path/to/agent-tools

# List all registered agents
python -m agent_tools.cli list

# Find an agent by capability
python -m agent_tools.cli find cross-chain

# Check if tokenforge-agent has correct access
python -m agent_tools.cli check tokenforge-agent --profile power

# Get profile recommendation
python -m agent_tools.cli recommend tokenforge-agent
```

## Agents in this repo

| ID | Role | Profile |
|----|------|---------|
| `tokenforge-agent` | Full-stack TokenForge builder | power |
| `solana-specialist` | Anchor/SPL/Metaplex developer | balanced |
| `evm-contract-engineer` | Solidity + Hardhat developer | balanced |
| `cross-chain-orchestrator` | Wormhole bridge flow coordinator | power |
| `security-auditor` | Smart contract security review | safe |

## Merge upstream agents

```bash
git clone --depth 1 https://github.com/Unwrenchable/agent-tools.git /tmp/agent-tools
python -m agent_tools.cli import-agency /tmp/agent-tools --merge --merge-target .agentx/agents.json
```
