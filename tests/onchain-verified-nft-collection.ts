import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { OnchainVerifiedNftCollection } from "../target/types/onchain_verified_nft_collection";
import { PublicKey, Keypair, Transaction } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { assert } from "chai";
import * as fs from "fs";

describe("onchain-verified-nft-collection", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const authority = provider.wallet as anchor.Wallet;
  console.log("Wallet:", authority.publicKey.toString());
  const program = anchor.workspace.OnchainVerifiedNftCollection as Program<OnchainVerifiedNftCollection>;

  // Store collection details for use across tests
  let collectionMint: PublicKey;
  let collectionMetadata: PublicKey;
  let collectionMasterEdition: PublicKey;
  let collectionPda: PublicKey;

  before(async () => {
    // Request airdrop for authority if needed
    const balance = await provider.connection.getBalance(authority.publicKey);
    if (balance < 1_000_000_000) { // Less than 1 SOL
      console.log("Requesting airdrop for authority...");
      const signature = await provider.connection.requestAirdrop(authority.publicKey, 2_000_000_000); // 2 SOL
      await provider.connection.confirmTransaction(signature);
    }
  });

  describe("Collection", () => {
    it("Initializes a collection", async () => {
      // Create collection mint
      collectionMint = await createMint(
        provider.connection, // Connection
        authority.payer, // Mint payer
        authority.publicKey, // Mint authority
        authority.publicKey, // Freeze authority
        0, // Decimals, 0 usually for NFTs
        undefined,
        undefined,
        TOKEN_PROGRAM_ID
      );
      console.log("Collection Mint:", collectionMint.toString());

      // Get collection metadata PDA
      [collectionMetadata] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s").toBuffer(),
          collectionMint.toBuffer(),
        ],
        new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s")
      );
      console.log("Collection Metadata:", collectionMetadata.toString());

      // Get collection master edition PDA
      [collectionMasterEdition] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s").toBuffer(),
          collectionMint.toBuffer(),
          Buffer.from("edition"),
        ],
        new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s")
      );
      console.log("Collection Master Edition:", collectionMasterEdition.toString());

      // Get collection PDA
      [collectionPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("collection"), collectionMint.toBuffer()],
        program.programId
      );
      console.log("Collection PDA:", collectionPda.toString());

      // Create collection token account
      const collectionTokenAccount = await getAssociatedTokenAddressSync(
        collectionMint,
        authority.publicKey,
        true,
        TOKEN_PROGRAM_ID
      );
      console.log("Collection Token Account:", collectionTokenAccount.toString());

      // Create the token account if it doesn't exist
      try {
        await provider.connection.getAccountInfo(collectionTokenAccount);
      } catch (error) {
        const createAtaIx = createAssociatedTokenAccountInstruction(
          authority.publicKey,
          collectionTokenAccount,
          authority.publicKey,
          collectionMint,
          TOKEN_PROGRAM_ID
        );
        
        const tx = new Transaction().add(createAtaIx);
        await provider.sendAndConfirm(tx, [authority.payer]);
        console.log("Created new collection token account");
      }

      // Initialize collection
      const tx = await program.methods
        .initializeCollection(
          "My Collection",
          "MC",
          "https://arweave.net/your-collection-metadata-uri"
        )
        .accountsPartial({
          authority: authority.publicKey,
          collection: collectionPda,
          collectionMint: collectionMint,
          collectionMetadata: collectionMetadata,
          collectionMasterEdition: collectionMasterEdition,
          collectionTokenAccount: collectionTokenAccount,
          tokenMetadataProgram: new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"),
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          sysvarInstructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
        })
        .signers([authority.payer])
        .rpc();

      console.log("Collection initialization transaction:", tx);

      // Wait for confirmation and add a small delay
      await provider.connection.confirmTransaction(tx);
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay

      // Verify the collection was initialized correctly
      const collectionAccount = await program.account.collectionState.fetch(collectionPda);
      assert.ok(collectionAccount.authority.equals(authority.publicKey), "Collection authority should match");
      assert.ok(collectionAccount.mint.equals(collectionMint), "Collection mint should match");
      assert.ok(collectionAccount.metadata.equals(collectionMetadata), "Collection metadata should match");
      assert.ok(collectionAccount.masterEdition.equals(collectionMasterEdition), "Collection master edition should match");
    });

    it("Mints an NFT and adds it to the collection", async () => {
      // Create NFT mint
      const nftMintKeypair = Keypair.generate();
      const nftMint = nftMintKeypair.publicKey;
      console.log("NFT Mint:", nftMint.toString());

      // Get NFT metadata PDA
      const [nftMetadata] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s").toBuffer(),
          nftMint.toBuffer(),
        ],
        new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s")
      );
      console.log("NFT Metadata:", nftMetadata.toString());

      // Get NFT master edition PDA
      const [nftMasterEdition] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s").toBuffer(),
          nftMint.toBuffer(),
          Buffer.from("edition"),
        ],
        new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s")
      );
      console.log("NFT Master Edition:", nftMasterEdition.toString());

      // Create NFT token account
      const nftTokenAccount = await getAssociatedTokenAddressSync(
        nftMint,
        authority.publicKey,
        true,
        TOKEN_PROGRAM_ID
      );
      console.log("NFT Token Account:", nftTokenAccount.toString());

      // Create the token account if it doesn't exist
      try {
        await provider.connection.getAccountInfo(nftTokenAccount);
      } catch (error) {
        const createAtaIx = createAssociatedTokenAccountInstruction(
          authority.publicKey,
          nftTokenAccount,
          authority.publicKey,
          nftMint,
          TOKEN_PROGRAM_ID
        );
        
        const tx = new Transaction().add(createAtaIx);
        await provider.sendAndConfirm(tx, [authority.payer]);
        console.log("Created new token account");
      }

      // Create the mint account
      const createMintIx = anchor.web3.SystemProgram.createAccount({
        fromPubkey: authority.publicKey,
        newAccountPubkey: nftMint,
        space: 82, // Size of a mint account
        lamports: await provider.connection.getMinimumBalanceForRentExemption(82),
        programId: TOKEN_PROGRAM_ID,
      });

      // Initialize the mint
      const initMintIx = await createInitializeMintInstruction(
        nftMint,
        0,
        authority.publicKey,
        authority.publicKey,
        TOKEN_PROGRAM_ID
      );

      // Create and send the transaction
      const createMintTx = new Transaction()
        .add(createMintIx)
        .add(initMintIx);
      
      await provider.sendAndConfirm(createMintTx, [nftMintKeypair, authority.payer]);
      console.log("Created and initialized NFT mint");

      // Define account roles clearly
      const accounts = {
        // The authority who is minting the NFT
        authority: authority.publicKey,  // This account will:
        // 1. Pay for the NFT creation
        // 2. Own the NFT
        // 3. Be the authority for minting
        
        // Collection accounts
        collection: collectionPda,  // The collection PDA that contains collection info
        collectionMint: collectionMint,  // The collection mint
        collectionMetadata: collectionMetadata,  // The collection metadata
        collectionMasterEdition: collectionMasterEdition,  // The collection master edition
        
        // NFT accounts
        mint: nftMint,  // The new NFT mint being created
        metadata: nftMetadata,  // The metadata account for the NFT
        masterEdition: nftMasterEdition,  // The master edition account for the NFT
        nftTokenAccount: nftTokenAccount,  // The token account that will hold the NFT
        
        // Program accounts
        tokenProgram: TOKEN_PROGRAM_ID,
        tokenMetadataProgram: new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"),
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        sysvarInstructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
      };

      // Verify account relationships before transaction
      console.log("\n=== Verifying Account Relationships ===");
      console.log("1. Collection Authority Check:");
      const collectionAccount = await program.account.collectionState.fetch(collectionPda);
      console.log("   Collection Authority in State:", collectionAccount.authority.toString());
      console.log("   Authority:", accounts.authority.toString());
      assert.ok(
        collectionAccount.authority.equals(accounts.authority),
        "Collection authority must match authority"
      );

      console.log("\n2. Collection Accounts Check:");
      console.log("   Collection Mint:", accounts.collectionMint.toString());
      console.log("   Collection Metadata:", accounts.collectionMetadata.toString());
      console.log("   Collection Master Edition:", accounts.collectionMasterEdition.toString());
      console.log("=== End Account Verification ===\n");

      // Mint NFT
      const mintTx = await program.methods
        .mintNft(
          "NFT 1",
          "https://arweave.net/your-nft-metadata-uri"
        )
        .accountsPartial(accounts)
        .preInstructions([
          anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({ units: 400000 })
        ])
        .signers([authority.payer, nftMintKeypair])
        .rpc({
          skipPreflight: false,
          commitment: "confirmed",
          maxRetries: 3,
          preflightCommitment: "confirmed"
        });

      console.log("NFT minting transaction:", mintTx);

      // Wait for confirmation
      await provider.connection.confirmTransaction(mintTx);

      // Verify NFT collection status
      console.log("\n=== Verifying NFT Collection Status ===");
      const nftMetadataAccount = await provider.connection.getAccountInfo(nftMetadata);
      if (!nftMetadataAccount) {
        throw new Error("NFT metadata account not found");
      }

      console.log("NFT Mint:", nftMint.toString());
      console.log("Collection Mint:", collectionMint.toString());
      console.log("Collection Metadata:", collectionMetadata.toString());
      console.log("Collection Master Edition:", collectionMasterEdition.toString());
      console.log("=== End NFT Collection Verification ===\n");
    });
  });
}); 