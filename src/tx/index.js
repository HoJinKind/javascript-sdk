const sig = require("@tendermint/sig");
const _ = require("lodash");
const axios = require("axios");

const api = {
  getAccount: "/auth/accounts",
  postTx: "/txs"
};

async function getTx(path, base) {
  return await axios.get(new URL(path, base).toString());
}

async function postTx(chainID, base, wallet, tx) {
  const metaData = await loadMetaData(chainID, wallet.address, base);
  tx = signTx(tx, metaData, wallet);
  return await broadcastTx(tx, base);
}

async function loadMetaData(chainID, address, base) {
  const path = api.getAccount + "/" + address;
  const res = await getTx(path, base);

  accNum = _.get(res, "data.result.value.account_number");
  seqNum = _.get(res, "data.result.value.sequence");
  if (!(accNum || seqNum)) {
    throw new Error(
      "account number or sequence number from rest server are undefined"
    );
  }

  const signMetaData = {
    chain_id: chainID,
    account_number: accNum,
    sequence: seqNum
  };

  return signMetaData;
}

function signTx(tx, signMetaData, wallet) {
  tx = sig.signTx(tx, signMetaData, wallet);
  if (!sig.verifyTx(tx, signMetaData)) {
    throw new Error("problem signing tx, generated signature is invalid");
  }
  return tx;
}

async function broadcastTx(tx, base) {
  let txRes;
  // Send transaction to Kava
  try {
    const url = new URL(api.postTx, base).toString();
    txRes = await axios.post(url, sig.createBroadcastTx(tx, "block"));
  } catch (err) {
    throw new Error("tx broadcast:", err);
  }

  // Check for and handle any tendermint errors
  try {
    if (_.get(txRes, "data.code")) {
      throw new Error(
        `tx not accepted by chain: ${_.get(txRes, "data.raw_log")}`
      );
    }
  } catch (err) {
    return err;
  }

  return _.get(txRes, "data.txhash");
}

module.exports.tx = {
  getTx,
  postTx
};
