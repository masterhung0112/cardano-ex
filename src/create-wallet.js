const CardanoCliJs = require("cardanocli-js");
const shelleyGenesisPath = "./testnet-shelley-genesis.json";
const options = {};
options.shelleyGenesisPath = shelleyGenesisPath;
options.network = "testnet-magic 1097911063";

const cardanocliJs = new CardanoCliJs(options);

const createWallet = (account) => {
  const paymentKeys = cardanocliJs.addressKeyGen(account);
  const stakeKeys = cardanocliJs.stakeAddressKeyGen(account);
  const stakeAddr = cardanocliJs.stakeAddressBuild(account);
  const paymentAddr = cardanocliJs.addressBuild(account, {
    paymentVkey: paymentKeys.vkey,
    stakeVkey: stakeKeys.vkey,
  });
  return cardanocliJs.wallet(account);
};

const createPool = (name) => {
  cardanocliJs.nodeKeyGenKES(name);
  cardanocliJs.nodeKeyGen(name);
  cardanocliJs.nodeIssueOpCert(name);
  cardanocliJs.nodeKeyGenVRF(name);
  return cardanocliJs.pool(name);
};

const wallet = createWallet("Ada");
const pool = createPool("berry");

console.log(wallet.paymentAddr);
console.log(pool.vrf.vkey);
