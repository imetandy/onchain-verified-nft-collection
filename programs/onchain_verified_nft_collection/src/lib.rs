use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{mpl_token_metadata, Metadata},
    token::Token,
};
use mpl_token_metadata::{
    instructions::{CreateV1CpiBuilder, MintV1CpiBuilder, SetAndVerifyCollectionCpiBuilder},
    types::{Collection, PrintSupply, TokenStandard},
};

declare_id!("HdSXhd8wmPH9VsTxSAaNyaw3CCXMcCHis9SH3CZtELdJ");

#[program]
pub mod onchain_verified_nft_collection {
    use super::*;

    pub fn initialize_collection(
        ctx: Context<InitializeCollection>,
        name: String,
        symbol: String,
        uri: String,
    ) -> Result<()> {
        msg!("Initializing collection: {}", name);
        
        let collection = &mut ctx.accounts.collection;
        collection.authority = ctx.accounts.authority.key();
        collection.mint = ctx.accounts.collection_mint.key();
        collection.metadata = ctx.accounts.collection_metadata.key();
        collection.master_edition = ctx.accounts.collection_master_edition.key();

        let token_metadata_program = ctx.accounts.token_metadata_program.to_account_info();
        let collection_metadata = ctx.accounts.collection_metadata.to_account_info();
        let collection_mint = ctx.accounts.collection_mint.to_account_info();
        let authority = ctx.accounts.authority.to_account_info();
        let collection_master_edition = ctx.accounts.collection_master_edition.to_account_info();
        let system_program = ctx.accounts.system_program.to_account_info();
        let token_program = ctx.accounts.token_program.to_account_info();
        let collection_token_account = ctx.accounts.collection_token_account.to_account_info();
        let associated_token_program = ctx.accounts.associated_token_program.to_account_info();

        msg!("Creating collection NFT metadata");
        let mut create_collection_cpi = CreateV1CpiBuilder::new(&token_metadata_program);
        create_collection_cpi
            .metadata(&collection_metadata)
            .mint(&collection_mint, false)
            .authority(&authority)
            .payer(&authority)
            .update_authority(&authority, true)
            .master_edition(Some(&collection_master_edition))
            .system_program(&system_program)
            .sysvar_instructions(&ctx.accounts.sysvar_instructions)
            .spl_token_program(Some(&token_program))
            .token_standard(TokenStandard::NonFungible)
            .name(name)
            .symbol(symbol)
            .uri(uri)
            .seller_fee_basis_points(0)
            .primary_sale_happened(false)
            .is_mutable(true)
            .print_supply(PrintSupply::Zero);

        create_collection_cpi.invoke()?;
        msg!("Collection NFT metadata created successfully");

        msg!("Minting collection NFT");
        let mut mint_collection_cpi = MintV1CpiBuilder::new(&token_metadata_program);
        mint_collection_cpi
            .token(&collection_token_account)
            .token_owner(Some(&authority))
            .metadata(&collection_metadata)
            .master_edition(Some(&collection_master_edition))
            .mint(&collection_mint)
            .payer(&authority)
            .authority(&authority)
            .system_program(&system_program)
            .spl_token_program(&token_program)
            .spl_ata_program(&associated_token_program)
            .sysvar_instructions(&ctx.accounts.sysvar_instructions)
            .amount(1);

        mint_collection_cpi.invoke()?;
        msg!("Collection NFT minted successfully");

        Ok(())
    }

    pub fn mint_nft(
        ctx: Context<MintNft>,
        name: String,
        uri: String,
    ) -> Result<()> {
        msg!("Minting new NFT: {}", name);

        let token_metadata_program = ctx.accounts.token_metadata_program.to_account_info();
        let metadata = ctx.accounts.metadata.to_account_info();
        let mint = ctx.accounts.mint.to_account_info();
        let authority = ctx.accounts.authority.to_account_info();
        let master_edition = ctx.accounts.master_edition.to_account_info();
        let system_program = ctx.accounts.system_program.to_account_info();
        let token_program = ctx.accounts.token_program.to_account_info();
        let nft_token_account = ctx.accounts.nft_token_account.to_account_info();
        let associated_token_program = ctx.accounts.associated_token_program.to_account_info();

        msg!("Creating NFT metadata");
        let mut create_cpi = CreateV1CpiBuilder::new(&token_metadata_program);
        create_cpi
            .metadata(&metadata)
            .mint(&mint, true)
            .authority(&authority)
            .payer(&authority)
            .update_authority(&authority, true)
            .master_edition(Some(&master_edition))
            .system_program(&system_program)
            .sysvar_instructions(&ctx.accounts.sysvar_instructions)
            .spl_token_program(Some(&token_program))
            .name(name)
            .uri(uri)
            .seller_fee_basis_points(550)
            .token_standard(TokenStandard::NonFungible)
            .print_supply(PrintSupply::Zero)
            .collection(Collection {
                verified: false,
                key: ctx.accounts.collection_mint.key(),
            });

        create_cpi.invoke()?;
        msg!("NFT metadata created successfully");

        msg!("Minting NFT");
        let mut mint_cpi = MintV1CpiBuilder::new(&token_metadata_program);
        mint_cpi
            .token(&nft_token_account)
            .token_owner(Some(&authority))
            .metadata(&metadata)
            .master_edition(Some(&master_edition))
            .mint(&mint)
            .payer(&authority)
            .authority(&authority)
            .system_program(&system_program)
            .spl_token_program(&token_program)
            .spl_ata_program(&associated_token_program)
            .sysvar_instructions(&ctx.accounts.sysvar_instructions)
            .amount(1);

        mint_cpi.invoke()?;
        msg!("NFT minted successfully");

        msg!("Verifying collection");
        let mut verify_cpi = SetAndVerifyCollectionCpiBuilder::new(&token_metadata_program);
        verify_cpi
            .metadata(&metadata)
            .collection_authority(&authority)
            .payer(&authority)
            .update_authority(&authority)
            .collection_mint(&ctx.accounts.collection_mint)
            .collection(&ctx.accounts.collection_metadata)
            .collection_master_edition_account(&ctx.accounts.collection_master_edition)
            .collection_authority_record(None);
            
        verify_cpi.invoke()?;
        msg!("Collection verification completed");

        Ok(())
    }
}

#[account]
pub struct CollectionState {
    pub authority: Pubkey,
    pub mint: Pubkey,
    pub metadata: Pubkey,
    pub master_edition: Pubkey,
}

#[derive(Accounts)]
pub struct InitializeCollection<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 32 + 32,
        seeds = [b"collection", collection_mint.key().as_ref()],
        bump
    )]
    pub collection: Account<'info, CollectionState>,

    /// CHECK: This is the collection mint account
    #[account(mut)]
    pub collection_mint: AccountInfo<'info>,

    /// CHECK: This is the collection metadata account
    #[account(mut)]
    pub collection_metadata: AccountInfo<'info>,

    /// CHECK: This is the collection master edition account
    #[account(mut)]
    pub collection_master_edition: UncheckedAccount<'info>,

    /// CHECK: This is the collection token account
    #[account(mut)]
    pub collection_token_account: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub token_metadata_program: Program<'info, Metadata>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    /// CHECK: This is the instructions sysvar
    pub sysvar_instructions: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct MintNft<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        constraint = collection.authority == authority.key() @ ErrorCode::Unauthorized
    )]
    pub collection: Account<'info, CollectionState>,

    /// CHECK: mint needs to be a signer to create the NFT
    #[account(mut)]
    pub mint: Signer<'info>,

    /// CHECK: We create it using metaplex
    #[account(mut)]
    pub metadata: AccountInfo<'info>,

    /// CHECK: We create it using metaplex
    #[account(mut)]
    pub master_edition: UncheckedAccount<'info>,

    /// CHECK: We create it using anchor-spl
    #[account(mut)]
    pub nft_token_account: AccountInfo<'info>,

    /// CHECK: Collection mint account
    #[account(mut)]
    pub collection_mint: AccountInfo<'info>,

    /// CHECK: Collection metadata account
    #[account(mut)]
    pub collection_metadata: AccountInfo<'info>,

    /// CHECK: Collection master edition account
    #[account(mut)]
    pub collection_master_edition: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub token_metadata_program: Program<'info, Metadata>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    /// CHECK: This is the instructions sysvar
    pub sysvar_instructions: AccountInfo<'info>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("You are not authorized to perform this action")]
    Unauthorized,
} 