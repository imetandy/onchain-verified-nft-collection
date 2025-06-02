# Onchain Verified NFT Collection

A Solana program that demonstrates best practices for creating and managing on-chain verified NFT collections using Anchor framework.

## Overview

This project provides a reference implementation for creating verified NFT collections on Solana, ensuring proper metadata handling and collection verification. It uses the Anchor framework and integrates with the Metaplex Token Metadata program.

## Prerequisites

- [Node.js](https://nodejs.org/) (v16 or later)
- [Yarn](https://yarnpkg.com/) package manager
- [Anchor](https://www.anchor-lang.com/) framework
- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools)

## Getting Started

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd onchain-verified-nft-collection
   ```

2. Install dependencies:
   ```bash
   yarn install
   ```
   Note: If you're using corepack, ensure you run `corepack enable` first.

3. Edit Anchor.toml provider details to add your key for deployment to devnet (requires 2+ SOL)
    ```
    [provider]
    cluster = "devnet"
    wallet = "~/.config/solana/id.json"
    ```

4. Build the program (the first time you may need to also run anchor keys sync to align all keys for programID):
   ```bash
   anchor build
   anchor keys sync
   anchor build && anchor deploy
   ```

5. Run test script:
   ```bash
   anchor run test-nft-collection
   ```
