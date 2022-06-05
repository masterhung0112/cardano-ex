## Environment variables

```sh
export CARDANO_ROOT=/mnt/hungdata/home/hung/cardano
export CARDANO_NODE_SOCKET_PATH="$CARDANO_ROOT/db/node.socket"
export NETWORK_ID="--testnet-magic 1097911063"

export KEYNAME=payment1 
export STAKE_KEYNAME=stake1
export VOTING_KEYNAME=vote1
```

## Run cardano node for testnet

```sh
cardano-node run \
--config $CARDANO_ROOT/testnet-config.json \
--database-path $CARDANO_ROOT/db/ \
--socket-path $CARDANO_ROOT/db/node.socket \
--host-addr 127.0.0.1 \
--port 1337 \
--topology $CARDANO_ROOT/testnet-topology.json
```

## Generate all key

- Generate payment key
- Generate stake key
- Generate Voting key

### Generate payment key-pair
Use cardano-cli to generate key

```sh
cardano-cli address key-gen \
--verification-key-file $CARDANO_ROOT/keys/$KEYNAME.vkey \
--signing-key-file $CARDANO_ROOT/keys/KEYNAME.skey
```

Get the wallet address

```sh
cardano-cli address build \
--payment-verification-key-file $CARDANO_ROOT/keys/$KEYNAME.vkey \
--out-file $CARDANO_ROOT/keys/$KEYNAME.addr \
--testnet-magic 1097911063
```

### Generate stake address
```sh
cardano-cli stake-address key-gen \
    --verification-key-file $CARDANO_ROOT/keys/$STAKE_KEYNAME.vkey \
    --signing-key-file $CARDANO_ROOT/keys/$STAKE_KEYNAME.skey
cardano-cli stake-address build \
    --stake-verification-key-file $CARDANO_ROOT/keys/$STAKE_KEYNAME.vkey \
    --out-file $CARDANO_ROOT/keys/$STAKE_KEYNAME.addr \
    --testnet-magic 1097911063
```
### Generate Voting key

```sh
jcli key generate \
    --type ed25519extended \
    > $VOTING_KEYNAME.skey
jcli key to-public \
    < $VOTING_KEYNAME.skey \
    > $VOTING_KEYNAME.pub
```

## Check if the address have ADA

```sh
cardano-cli query utxo --testnet-magic 1097911063 --address $(cat $CARDANO_ROOT/keys/$KEYNAME.addr)
```

# Generating vote registration transaction metadata
Firstly, you need to generate key and address for staking and payment.

From here, we generate our vote registration, encoded in transaction metadata:
```sh
export SLOT_TIP=$(cardano-cli query tip $NETWORK_ID | jq '.slot')
export PAYMENT_ADDR=$(cat $CARDANO_ROOT/keys/$KEYNAME.addr)

voter-registration \
    --rewards-address $(cat $CARDANO_ROOT/keys/$STAKE_KEYNAME.addr) \
    --vote-public-key-file $CARDANO_ROOT/keys/$VOTING_KEYNAME.pub \
    --stake-signing-key-file $CARDANO_ROOT/keys/$STAKE_KEYNAME.skey \
    --slot-no $SLOT_TIP \
    --json > voting-registration-metadata.json
```

# Submission of vote registration
Here we're just using the first TxHash and TxIx we find, you should choose an appropriate UTxO and TxIx.
```sh
export AMT=$(cardano-cli query utxo $NETWORK_ID --address $PAYMENT_ADDR | tail -n1 | awk '{print $3;}')
export UTXO=$(cardano-cli query utxo $NETWORK_ID --address $PAYMENT_ADDR | tail -n1 | awk '{print $1;}')
export UTXO_TXIX=$(cardano-cli query utxo $NETWORK_ID --address $PAYMENT_ADDR | tail -n1 | awk '{print $2;}')
echo "UTxO: $UTXO#$UTXO_TXIX"
```

```sh
cardano-cli transaction build  \
	$NETWORK_ID \
	--tx-in $UTXO#$UTXO_TXIX \
	--change-address $PAYMENT_ADDR \
	--metadata-json-file voting-registration-metadata.json \
	--protocol-params-file protocol.json  \
	--out-file ${KEYNAME}_tx.raw
```

Sign the transaction

```sh
cardano-cli transaction sign \
    --tx-body-file ${KEYNAME}_tx.raw \
    --signing-key-file $CARDANO_ROOT/keys/$KEYNAME.skey \
    $NETWORK_ID \
    --out-file ${KEYNAME}_tx.signed
```

Submit the transaction
```sh
cardano-cli transaction submit \
    --tx-file ${KEYNAME}_tx.signed \
    $NETWORK_ID
```

Check the transaction in the ledger

```sh
cardano-cli transaction txid --tx-file ${KEYNAME}_tx.signed
```

# Get voting power

```sh
voting-tools $NETWORK_ID \
    --db $(cat ./config/secrets/postgres_db) \
    --db-user $(cat ./config/secrets/postgres_user) \
    --db-pass $(cat ./config/secrets/postgres_password) \
    --db-host localhost \
    --slot-no $SLOT_TIP \
    --out-file voting-snaphot.metadata-json-file
```

Generate QR Code

```sh
catalyst-toolbox qr-code encode --pin 1234 --input ./vote.skey img
```
