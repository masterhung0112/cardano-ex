## Environment variables

```sh
export CARDANO_ROOT=/mnt/hungdata/home/hung/cardano
export CARDANO_NODE_SOCKET_PATH="$CARDANO_ROOT/db/node.socket"
export NETWORK_ID="--testnet-magic 1097911063"

export KEYNAME=payment1 
export STAKE_KEYNAME=stake1
export VOTING_KEYNAME=vote1
export PAYMENT_ADDR=$(cat $CARDANO_ROOT/keys/$KEYNAME.addr)

cd $CARDANO_ROOT/keys
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


```sh
cardano-wallet serve --port 8090 \
  --node-socket $CARDANO_ROOT/db/node.socket \
  --testnet $CARDANO_ROOT/testnet-byron-genesis.json \
  --database $CARDANO_ROOT/db \
  --token-metadata-server https://metadata.cardano-testnet.iohkdev.io/
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
cardano-cli query utxo $NETWORK_ID --address $(cat $CARDANO_ROOT/keys/$KEYNAME.addr)
```

# Generating vote registration transaction metadata
Firstly, you need to generate key and address for staking and payment.

From here, we generate our vote registration, encoded in transaction metadata:
```sh
export SLOT_TIP=$(cardano-cli query tip $NETWORK_ID | jq '.slot')

voter-registration \
    --rewards-address $(cat $CARDANO_ROOT/keys/$STAKE_KEYNAME.addr) \
    --vote-public-key-file $CARDANO_ROOT/keys/$VOTING_KEYNAME.pub \
    --stake-signing-key-file $CARDANO_ROOT/keys/$STAKE_KEYNAME.skey \
    --slot-no $SLOT_TIP \
    --json > voting-registration-metadata.json


voter-registration \
    --rewards-address $(cat $CARDANO_ROOT/keys/$STAKE_KEYNAME.addr) \
    --vote-public-key-file $CARDANO_ROOT/keys/$VOTING_KEYNAME.pub \
    --stake-signing-key-file $CARDANO_ROOT/keys/$STAKE_KEYNAME.skey \
    --slot-no $SLOT_TIP \
    --time-to-live $(expr $SLOT_TIP + 3500)\
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

# Generate the Staking pool

## Register stake address on the blockchain

- Create a registration certificate
- Submit the certifcate with a tranasction

```sh
cardano-cli stake-address registration-certificate \
--stake-verification-key-file $STAKE_KEYNAME.vkey \
--out-file $STAKE_KEYNAME.cert
```

Get the transaction hash and amount
```sh
cardano-cli query utxo $NETWORK_ID --address $(cat $CARDANO_ROOT/keys/$KEYNAME.addr)
```

Copy the transaction hash and replace in the following

```sh
cardano-cli transaction build-raw \
--tx-in 7cb6b68ec8e950453abf439393d8f23ce79680a3302dce3a6fad9fe7a553b71a#1 \
--tx-out $(cat $KEYNAME.addr)+0 \
--invalid-hereafter 0 \
--fee 0 \
--out-file tx.draft \
--certificate-file $STAKE_KEYNAME.cert

# Get lovelace value (178085)
cardano-cli transaction calculate-min-fee \
--tx-body-file tx.draft \
--tx-in-count 1 \
--tx-out-count 1 \
--witness-count 2 \
--byron-witness-count 0 \
$NETWORK_ID \
--protocol-params-file protocol.json
```

### Submit the certificate with tranasction

Relace the value from `query utxo` and `fee`
```sh
cardano-cli transaction build-raw \
--tx-in 7cb6b68ec8e950453abf439393d8f23ce79680a3302dce3a6fad9fe7a553b71a#1 \
--tx-out $(cat $KEYNAME.addr)+1997583106 \
--invalid-hereafter 987654 \
--fee 178085 \
--out-file tx.raw \
--certificate-file $STAKE_KEYNAME.cert

# This step need two private keys
cardano-cli transaction sign \
--tx-body-file tx.raw \
--signing-key-file $KEYNAME.skey \
--signing-key-file $STAKE_KEYNAME.skey \
$NETWORK_ID \
--out-file tx.signed

cardano-cli transaction submit \
--tx-file tx.signed \
$NETWORK_ID
```
Your stake key is now registered on the blockchain.


## Generate pool keys

Generate Cold Keys and a Cold_counter
```sh
export POOL_COLD_KEYNAME=cold1
export POOL_VRF_KEYNAME=vrf1
export POOL_KES_KEYNAME=kes1

cardano-cli node key-gen \
--cold-verification-key-file $POOL_COLD_KEYNAME.vkey \
--cold-signing-key-file $POOL_COLD_KEYNAME.skey \
--operational-certificate-issue-counter-file $POOL_COLD_KEYNAME.counter
```

Generate VRF Key pair
```sh
cardano-cli node key-gen-VRF \
--verification-key-file $POOL_VRF_KEYNAME.vkey \
--signing-key-file $POOL_VRF_KEYNAME.skey
```


Generate the KES Key pair
```sh
cardano-cli node key-gen-KES \
--verification-key-file $POOL_KES_KEYNAME.vkey \
--signing-key-file $POOL_KES_KEYNAME.skey
```

### Generate Operational Certificate

We need to know the slots per KES period, we get it from the genesis file:
```sh
# Get "slotsPerKESPeriod": 3600,
cat testnet-shelley-genesis.json | grep KESPeriod

# Get the slot value. Ex, 26633911
cardano-cli query tip $NETWORK_ID
```

Calculate KES period
```sh
expr 26633911 / 3600
```

### Generate the certicate

Replace KES period
```sh
cardano-cli node issue-op-cert \
--kes-verification-key-file $CARDANO_ROOT/keys/pool-keys/$POOL_KES_KEYNAME.vkey \
--cold-signing-key-file $CARDANO_ROOT/keys/pool-keys/$POOL_COLD_KEYNAME.skey \
--operational-certificate-issue-counter $CARDANO_ROOT/keys/pool-keys/$POOL_COLD_KEYNAME.counter \
--kes-period 473 \
--out-file node.cert
```sh

Move cold keys to the socure storage.

Finally we have these keys in local:
- kes.skey
- kes.vkey
- node.cert
- vrf.skey
- vrf.vkey


### Make pool metadata

Example of metadata: https://gist.githubusercontent.com/carloslodelar/38c7482070627092a427583cae8fa470/raw/7fddda4d258bf685d24ea3510fbde295b3920188/clrpool.json

```sh
cardano-cli stake-pool metadata-hash --pool-metadata-file $CARDANO_ROOT/keys/pool-keys/pool1_metadata.json
```


### Register the Replay node on-chain


### Generate Stake pool registration certificate

```sh
cardano-cli stake-pool registration-certificate \
--cold-verification-key-file $POOL_COLD_KEYNAME.vkey \
--vrf-verification-key-file $POOL_VRF_KEYNAME.vkey \
--pool-pledge <AMOUNT TO PLEDGE IN LOVELACE> \
--pool-cost <POOL COST PER EPOCH IN LOVELACE> \
--pool-margin 0.1 \
--pool-reward-account-verification-key-file $STAKE_KEYNAME.vkey \
--pool-owner-stake-verification-key-file $STAKE_KEYNAME.vkey \
--mainnet \
--pool-relay-ipv4 <RELAY NODE PUBLIC IP> \
--pool-relay-port <RELAY NODE PORT> \
--single-host-pool-relay STRING <The stake pool relay's DNS name that corresponds to an A or AAAA DNS record> \
--metadata-url https://git.io/JJWdJ \
--metadata-hash <POOL METADATA HASH> \
--out-file $POOL_COLD_KEYNAME-registration.cert
```

# Question
1. Pledging 

a. Can we pledge after pool creation? Can we update Pledge? How will it work? Will the updated pledge be applicable for next Epoch automatically?
Reference: https://www.coincashew.com/coins/overview-ada/guide-how-to-build-a-haskell-stakepool-node/part-iv-administration/updating-stake-pool-information
- After creating the pool, you can update the pledge
- The new value of pledge will take effect after 2 epochs

After changing the pledge, it take effect in two epochs

b. Is Pledging mandatory when creating a pool?

2. What Keys are required for creating a staking wallet?
- payment vkey/skey
- staking vkey/skey
Note: payment address - generated from stake key and payment key

3. What Keys are required for creating a pledging wallet?
- cold vkey/skey
- cold.counter: issue counter
- KES vkey/skey
- VRF vkey/skey


4. Stake Pools are identified by the Pool Key. Any link between pool key and pledging wallet?

5. List of argument needed to setup the pool
- pool-pledge: Pledge lovelace
- pool-cost: operational costs per epoch lovelace
- pool-margin: share of total ada rewards that the operator takes, must be from 0 to 1


Two public service: One for replay node, one for block-producing node
The public URL that can download metadata of the pool
