from web3 import Web3
import json
import os
from pathlib import Path
from typing import List, Dict

from .services.signature_service import sign_raw_hash

ABI_PATH = Path(__file__).parent / "contracts" / "DocumentRegistry.abi.json"


class BlockchainClient:
    def __init__(self):
        self.rpc_url = os.getenv("BESU_RPC_URL", "http://besu-node-4:8545")
        self.contract_address = os.getenv("CONTRACT_ADDRESS")
        self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
        self.abi = self._load_abi()
        self.contract = self.w3.eth.contract(
            address=self.contract_address,
            abi=self.abi
        ) if self.contract_address else None

    def _load_abi(self):
        with open(ABI_PATH) as f:
            return json.load(f)

    def _revert_reason(self, fn_call, from_address: str) -> str:
        """Rejoue un appel de fonction en `.call()` (sans envoyer de transaction) pour
        récupérer le message de `require`/`revert` exact du contrat."""
        try:
            fn_call.call({'from': from_address})
        except Exception as e:
            text = str(e)
            if '(' in text and text.rstrip().endswith(')'):
                return text[text.index('(') + 1: text.rstrip().rindex(')')]
            return text
        return "Transaction échouée (raison inconnue)"

    def _require_success(self, receipt, fn_call, from_address: str):
        """Une transaction minée avec `status == 0` a été rejetée par le contrat (revert) —
        web3.py ne lève pas d'exception dans ce cas, il faut vérifier explicitement, sinon
        le code appelant plante plus loin (ex: aucun event à décoder) avec une erreur opaque."""
        if receipt.status == 0:
            raise ValueError(self._revert_reason(fn_call, from_address))

    def fund_account(self, address: str, amount_eth: float = 1.0) -> Dict:
        """Envoie de l'ETH depuis le compte plateforme vers `address` — nécessaire pour
        qu'un acteur nouvellement créé puisse payer le gas de ses propres transactions
        (signature de documents, transferts, ...). Ne dépend pas du contrat déployé."""
        account = self.w3.eth.account.from_key(os.getenv("PRIVATE_KEY"))

        tx = {
            'from': account.address,
            'to': Web3.to_checksum_address(address),
            'value': self.w3.to_wei(amount_eth, 'ether'),
            'gas': 21000,
            'gasPrice': self.w3.eth.gas_price,
            'nonce': self.w3.eth.get_transaction_count(account.address),
        }
        signed_tx = self.w3.eth.account.sign_transaction(tx, os.getenv("PRIVATE_KEY"))
        tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)

        return {"txHash": tx_hash.hex(), "status": receipt.status}

    def issue_document(self, doc_type: str, doc_key: str, issuer_did: str, owner: str,
                       attributes: List[Dict], ipfs_cid: str, is_transferable: bool,
                       signer_private_key: str) -> int:
        """Émet un document. Doit être signé par la clé dont l'adresse correspond au
        `issuer_did` fourni — le contrat vérifie `_resolveDidToAddress(issuerDid) == msg.sender`."""
        if not self.contract:
            raise ValueError("Contract not deployed")

        attrs = [(a['key'], a['value'], a['valueType']) for a in attributes]

        account = self.w3.eth.account.from_key(signer_private_key)

        fn_call = self.contract.functions.issueDocument(
            doc_type, doc_key, issuer_did, owner, attrs, ipfs_cid, is_transferable
        )
        tx = fn_call.build_transaction({
            'from': account.address,
            'gas': 2000000,
            'gasPrice': self.w3.eth.gas_price,
            'nonce': self.w3.eth.get_transaction_count(account.address)
        })

        signed_tx = self.w3.eth.account.sign_transaction(tx, signer_private_key)
        tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        self._require_success(receipt, fn_call, account.address)

        event = self.contract.events.DocumentIssued().process_receipt(receipt)
        return event[0]['args']['tokenId']

    def exists_by_type_and_key(self, doc_type: str, doc_key: str) -> bool:
        if not self.contract:
            raise ValueError("Contract not deployed")
        return self.contract.functions.existsByTypeAndKey(doc_type, doc_key).call()

    def get_document_by_type_and_key(self, doc_type: str, doc_key: str) -> Dict:
        if not self.contract:
            raise ValueError("Contract not deployed")
        result = self.contract.functions.getDocumentByTypeAndKey(doc_type, doc_key).call()
        # Document struct: (docType, docKey, issuerDid, issuerAddress, owner, issuanceDate,
        # isActive, ipfsCid, attributes, isTransferable, versions, versionCount)
        return {
            "docType": result[0],
            "docKey": result[1],
            "issuerDid": result[2],
            "issuerAddress": result[3],
            "owner": result[4],
            "isActive": result[6],
            "ipfsCid": result[7],
        }

    def verify_document(self, token_id: int) -> Dict:
        if not self.contract:
            raise ValueError("Contract not deployed")

        result = self.contract.functions.verifyDocument(token_id).call()
        return {
            "isValid": result[0],
            "issuerDid": result[1],
            "issuer": result[2],
            "owner": result[3],
            "docType": result[4],
            "docKey": result[5],
            "ipfsCid": result[6]
        }

    def get_document_versions(self, token_id: int) -> List[Dict]:
        if not self.contract:
            raise ValueError("Contract not deployed")

        result = self.contract.functions.getDocumentVersions(token_id).call()
        return [
            {"cid": v[0], "owner": v[1], "timestamp": v[2]}
            for v in result
        ]

    def get_owner_at_timestamp(self, token_id: int, timestamp: int) -> str:
        if not self.contract:
            raise ValueError("Contract not deployed")
        return self.contract.functions.getOwnerAtTimestamp(token_id, timestamp).call()

    def get_token_id_by_cid(self, cid: str) -> int:
        """Retrouve le token_id à partir de l'empreinte IPFS d'un fichier (mapping on-chain
        hashToTokenId, déjà utilisé par le contrat pour interdire la réutilisation d'un CID) —
        permet de vérifier un document déposé sans connaître son Token ID au préalable.
        Renvoie 0 si ce CID n'est associé à aucun document (valeur par défaut Solidity)."""
        if not self.contract:
            raise ValueError("Contract not deployed")
        return self.contract.functions.hashToTokenId(cid).call()

    # ============================================================
    # VENTE ENTRE PARTICULIERS (triple signature)
    # ============================================================
    def _transfer_message_hash(self, token_id: int, buyer_address: str) -> bytes:
        return Web3.solidity_keccak(
            ['uint256', 'address', 'uint256'],
            [token_id, Web3.to_checksum_address(buyer_address), self.w3.eth.chain_id]
        )

    def cid_exists(self, cid: str) -> bool:
        if not self.contract:
            raise ValueError("Contract not deployed")
        return self.contract.functions.hashToTokenId(cid).call() != 0

    def initiate_transfer(self, token_id: int, buyer_address: str, seller_private_key: str) -> Dict:
        """Le vendeur (propriétaire actuel) signe et initie la vente."""
        if not self.contract:
            raise ValueError("Contract not deployed")

        message_hash = self._transfer_message_hash(token_id, buyer_address)
        signature = bytes.fromhex(sign_raw_hash(seller_private_key, message_hash)[2:])
        account = self.w3.eth.account.from_key(seller_private_key)

        fn_call = self.contract.functions.initiateTransfer(
            token_id, Web3.to_checksum_address(buyer_address), signature
        )
        tx = fn_call.build_transaction({
            'from': account.address,
            'gas': 300000,
            'gasPrice': self.w3.eth.gas_price,
            'nonce': self.w3.eth.get_transaction_count(account.address)
        })

        signed_tx = self.w3.eth.account.sign_transaction(tx, seller_private_key)
        tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        self._require_success(receipt, fn_call, account.address)

        return {"txHash": tx_hash.hex(), "status": receipt.status, "signature": "0x" + signature.hex()}

    def accept_transfer(self, token_id: int, buyer_address: str, buyer_private_key: str) -> Dict:
        """L'acheteur signe et accepte l'offre."""
        if not self.contract:
            raise ValueError("Contract not deployed")

        message_hash = self._transfer_message_hash(token_id, buyer_address)
        signature = bytes.fromhex(sign_raw_hash(buyer_private_key, message_hash)[2:])
        account = self.w3.eth.account.from_key(buyer_private_key)

        fn_call = self.contract.functions.acceptTransfer(token_id, signature)
        tx = fn_call.build_transaction({
            'from': account.address,
            'gas': 300000,
            'gasPrice': self.w3.eth.gas_price,
            'nonce': self.w3.eth.get_transaction_count(account.address)
        })

        signed_tx = self.w3.eth.account.sign_transaction(tx, buyer_private_key)
        tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        self._require_success(receipt, fn_call, account.address)

        return {"txHash": tx_hash.hex(), "status": receipt.status, "signature": "0x" + signature.hex()}

    def finalize_transfer(self, token_id: int, buyer_address: str, new_cid: str, notary_private_key: str) -> Dict:
        """Le notaire signe et finalise : transfert de propriété + nouvelle version (nouveau
        CID) exécutés on-chain en une seule transaction."""
        if not self.contract:
            raise ValueError("Contract not deployed")

        message_hash = self._transfer_message_hash(token_id, buyer_address)
        signature = bytes.fromhex(sign_raw_hash(notary_private_key, message_hash)[2:])
        account = self.w3.eth.account.from_key(notary_private_key)

        fn_call = self.contract.functions.finalizeTransfer(token_id, signature, new_cid)
        tx = fn_call.build_transaction({
            'from': account.address,
            'gas': 400000,
            'gasPrice': self.w3.eth.gas_price,
            'nonce': self.w3.eth.get_transaction_count(account.address)
        })

        signed_tx = self.w3.eth.account.sign_transaction(tx, notary_private_key)
        tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        self._require_success(receipt, fn_call, account.address)

        return {"txHash": tx_hash.hex(), "status": receipt.status, "signature": "0x" + signature.hex()}

    def revoke_document(self, token_id: int, signer_private_key: str) -> Dict:
        """Révoque un document (ex: émis par erreur au mauvais destinataire). Doit être
        signé par un compte ISSUER_ROLE (le contrat impose `onlyIssuer`)."""
        if not self.contract:
            raise ValueError("Contract not deployed")

        account = self.w3.eth.account.from_key(signer_private_key)

        fn_call = self.contract.functions.revokeDocument(token_id)
        tx = fn_call.build_transaction({
            'from': account.address,
            'gas': 200000,
            'gasPrice': self.w3.eth.gas_price,
            'nonce': self.w3.eth.get_transaction_count(account.address)
        })

        signed_tx = self.w3.eth.account.sign_transaction(tx, signer_private_key)
        tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        self._require_success(receipt, fn_call, account.address)

        return {"txHash": tx_hash.hex(), "status": receipt.status}

    def grant_role(self, role_name: str, address: str) -> Dict:
        if not self.contract:
            raise ValueError("Contract not deployed")

        role_hash = getattr(self.contract.functions, role_name)().call()

        account = self.w3.eth.account.from_key(os.getenv("PRIVATE_KEY"))

        tx = self.contract.functions.grantRole(role_hash, address).build_transaction({
            'from': account.address,
            'gas': 200000,
            'gasPrice': self.w3.eth.gas_price,
            'nonce': self.w3.eth.get_transaction_count(account.address)
        })

        signed_tx = self.w3.eth.account.sign_transaction(tx, os.getenv("PRIVATE_KEY"))
        tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)

        return {"txHash": tx_hash.hex(), "status": receipt.status}

    def revoke_role(self, role_name: str, address: str) -> Dict:
        """Retire un rôle AccessControl (ex: après régénération de clé, pour qu'une adresse
        abandonnée ne conserve pas de permission on-chain active)."""
        if not self.contract:
            raise ValueError("Contract not deployed")

        role_hash = getattr(self.contract.functions, role_name)().call()

        account = self.w3.eth.account.from_key(os.getenv("PRIVATE_KEY"))

        tx = self.contract.functions.revokeRole(role_hash, address).build_transaction({
            'from': account.address,
            'gas': 200000,
            'gasPrice': self.w3.eth.gas_price,
            'nonce': self.w3.eth.get_transaction_count(account.address)
        })

        signed_tx = self.w3.eth.account.sign_transaction(tx, os.getenv("PRIVATE_KEY"))
        tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)

        return {"txHash": tx_hash.hex(), "status": receipt.status}
