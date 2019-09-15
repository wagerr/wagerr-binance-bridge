/* A table for mapping a client address to a generated account. */
create table if not exists client_accounts (
  uuid char(36) primary key,

  /* The type of address. wagerr or bnb */
  address_type text,

  /*
    A clients address.
    This is the address we pay out to.
   */
  address text,

  /* The type of generated account. wagerr or bnb */
  account_type text,

  /* An id to a generated account. account_wagerr or account_bnb */
  account_uuid char(36),

  created timestamp
);

/*
  Wagerr accounts.
  We don't generate any wagerr accounts because we only have 1 wallet-rpc running.
  Instead what we do is generate a new sub-address and store that instead, this acts the same way as making a new wallet.
*/
create table if not exists accounts_wagerr (
  uuid char(36) primary key,
  address text, -- This is just a unique sub-address for a wallet
  address_index text, -- The sub-address index
  created timestamp
);

/*
  BNB account.
  We don't generate any wallets, instead we store a random generated memo.
  This memo is used by the user when they make transactions.
*/
create table if not exists accounts_bnb (
  uuid char(36) primary key,
  memo text,
  created timestamp
);

/* A table of all swaps */
create table if not exists swaps (
  uuid char(36) primary key,

  /* The type of swap: wagerr_to_bwagerr or bwagerr_to_wagerr */
  type text,

  /*
    The amount to swap represented as 1e9 values.
    String instead of numeric to preserve the precise value.
  */
  amount text,
  client_account_uuid char(36),

  /* The transaction hash of the client deposit */
  deposit_transaction_hash text,

  /* The transaction hash of our transfer to the client */
  transfer_transaction_hash text,

  processed timestamp,
  created timestamp
);

/* Migrations */
alter table swaps add column if not exists deposit_transaction_created timestamp;
update swaps set deposit_transaction_created = COALESCE(created) where deposit_transaction_created is null;
