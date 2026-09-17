// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title DocumentRegistry
 * @dev Contrat mutualisé pour la gestion de tous types de documents.
 *      - Unicité : docType + docKey
 *      - Hash unique : hashToTokenId
 *      - Historique des versions
 *      - Transfert avec 3 signatures (vendeur, acheteur, notaire)
 *      - Compatible SSI avec DIDs (did:ethr:0x...)
 */
contract DocumentRegistry is ERC721URIStorage, AccessControl {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    // ============================================================
    // RÔLES
    // ============================================================
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant NOTARY_ROLE = keccak256("NOTARY_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // ============================================================
    // STRUCTURES
    // ============================================================

    struct Attribute {
        string key;
        string value;
        string valueType; // "string", "uint256", "address", "date", "boolean"
    }

    struct DocumentVersion {
        string ipfsCid;
        address owner;
        uint256 timestamp;
    }

    struct Document {
        string docType;          // "LAND_TITLE", "DRIVING_LICENSE", "DIPLOMA"
        string docKey;           // "TF-2024-0001", "DL-2024-12345"
        string issuerDid;        // "did:ethr:0xAdmin..."
        address issuerAddress;
        address owner;
        uint256 issuanceDate;
        bool isActive;
        string ipfsCid;          // CID courant
        Attribute[] attributes;
        bool isTransferable;
        DocumentVersion[] versions;
        uint256 versionCount;
    }

    struct TransferRequest {
        address seller;
        address buyer;
        uint256 tokenId;
        bytes sellerSignature;
        bytes buyerSignature;
        bool sellerSigned;
        bool buyerSigned;
        uint256 timestamp;
    }

    // ============================================================
    // MAPPINGS
    // ============================================================

    mapping(uint256 => Document) private _documents;
    mapping(string => uint256) public docTypeKeyToTokenId; // compositeKey → tokenId
    mapping(string => uint256) public hashToTokenId;       // ipfsCid → tokenId
    mapping(uint256 => TransferRequest) public transferRequests;

    // ============================================================
    // ÉVÉNEMENTS
    // ============================================================

    event DocumentIssued(string docType, string docKey, uint256 indexed tokenId, address indexed owner);
    event DocumentTransferred(uint256 indexed tokenId, address indexed from, address indexed to);
    event DocumentRevoked(uint256 indexed tokenId, address indexed by);
    event DocumentVersionAdded(uint256 indexed tokenId, uint256 versionIndex, string ipfsCid);
    event TransferRequested(uint256 indexed tokenId, address seller, address buyer);
    event TransferAccepted(uint256 indexed tokenId, address buyer);
    event TransferCompleted(uint256 indexed tokenId, address buyer, address notary);

    // ============================================================
    // MODIFICATEURS
    // ============================================================

    modifier onlyIssuer() {
        require(hasRole(ISSUER_ROLE, msg.sender), "Caller is not an issuer");
        _;
    }

    modifier onlyOwnerOf(uint256 tokenId) {
        require(_isApprovedOrOwner(msg.sender, tokenId), "Caller is not the owner");
        _;
    }

    modifier documentExists(uint256 tokenId) {
        require(_exists(tokenId), "Document does not exist");
        _;
    }

    modifier documentActive(uint256 tokenId) {
        require(_documents[tokenId].isActive, "Document is inactive or revoked");
        _;
    }

    modifier onlyNotary() {
        require(hasRole(NOTARY_ROLE, msg.sender), "Caller is not a notary");
        _;
    }

    // ============================================================
    // CONSTRUCTEUR
    // ============================================================

    constructor() ERC721("TrustDocument", "TDOC") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(ISSUER_ROLE, msg.sender);
        _setRoleAdmin(ISSUER_ROLE, ADMIN_ROLE);
        _setRoleAdmin(VERIFIER_ROLE, ADMIN_ROLE);
        _setRoleAdmin(NOTARY_ROLE, ADMIN_ROLE);
    }

    // ============================================================
    // ADMINISTRATION
    // ============================================================

    function setWhitelistedIssuer(address issuer, bool status) public onlyRole(ADMIN_ROLE) {
        // À utiliser pour whitelister des émetteurs externes
    }

    // ============================================================
    // FONCTIONS DID (Self-Sovereign Identity)
    // ============================================================

    function _isValidDid(string memory did) internal pure returns (bool) {
        bytes memory didBytes = bytes(did);
        if (didBytes.length < 10) return false;
        bytes memory prefix = bytes("did:ethr:");
        for (uint i = 0; i < prefix.length; i++) {
            if (didBytes[i] != prefix[i]) return false;
        }
        return true;
    }

    function _hexCharToByte(bytes1 char) internal pure returns (uint8) {
        uint8 c = uint8(char);
        if (c >= 48 && c <= 57) return c - 48;        // '0'-'9'
        if (c >= 97 && c <= 102) return c - 87;        // 'a'-'f'
        if (c >= 65 && c <= 70) return c - 55;         // 'A'-'F'
        revert("Invalid hex character in DID");
    }

    // Parse "did:ethr:0x<40 hex chars>" into its 20-byte address, matching msg.sender
    // against the *value* the hex string encodes (not its raw ASCII bytes).
    function _resolveDidToAddress(string memory did) internal pure returns (address) {
        require(_isValidDid(did), "Invalid DID format");
        bytes memory didBytes = bytes(did);
        uint start = 9; // length of "did:ethr:"
        require(
            didBytes.length == start + 42 &&
            didBytes[start] == '0' &&
            (didBytes[start + 1] == 'x' || didBytes[start + 1] == 'X'),
            "Invalid DID address format"
        );
        start += 2;

        bytes memory raw = new bytes(20);
        for (uint i = 0; i < 20; i++) {
            uint8 hi = _hexCharToByte(didBytes[start + i * 2]);
            uint8 lo = _hexCharToByte(didBytes[start + i * 2 + 1]);
            raw[i] = bytes1(hi * 16 + lo);
        }

        bytes20 addrBytes;
        assembly {
            addrBytes := mload(add(raw, 32))
        }
        return address(addrBytes);
    }

    function getIssuerDid(uint256 tokenId) public view documentExists(tokenId) returns (string memory) {
        return _documents[tokenId].issuerDid;
    }

    function getOwnerDid(uint256 tokenId) public view documentExists(tokenId) returns (address) {
        return _documents[tokenId].owner;
    }

    // ============================================================
    // FONCTIONS DE CLÉ COMPOSITE
    // ============================================================

    function _getCompositeKey(string memory docType, string memory docKey)
        internal
        pure
        returns (string memory)
    {
        return string(abi.encodePacked(docType, "#", docKey));
    }

    function existsByTypeAndKey(string memory docType, string memory docKey)
        public
        view
        returns (bool)
    {
        string memory compositeKey = _getCompositeKey(docType, docKey);
        return docTypeKeyToTokenId[compositeKey] != 0;
    }

    function getTokenIdByTypeAndKey(string memory docType, string memory docKey)
        public
        view
        returns (uint256)
    {
        string memory compositeKey = _getCompositeKey(docType, docKey);
        uint256 tokenId = docTypeKeyToTokenId[compositeKey];
        require(tokenId != 0, "Document not found");
        return tokenId;
    }

    function getDocumentByTypeAndKey(string memory docType, string memory docKey)
        public
        view
        returns (Document memory)
    {
        uint256 tokenId = getTokenIdByTypeAndKey(docType, docKey);
        return _documents[tokenId];
    }

    function hashExists(string memory ipfsCid) public view returns (bool) {
        return hashToTokenId[ipfsCid] != 0;
    }

    // ============================================================
    // ÉMISSION DE DOCUMENT
    // ============================================================

    function issueDocument(
        string memory docType,
        string memory docKey,
        string memory issuerDid,
        address toOwner,
        Attribute[] memory attributes,
        string memory ipfsCid,
        bool isTransferable
    ) public onlyIssuer returns (uint256) {
        // 1. Vérifications de base
        require(bytes(docKey).length > 0, "Document key is required");
        require(bytes(docType).length > 0, "Document type is required");
        require(bytes(ipfsCid).length > 0, "IPFS CID is required");
        require(_isValidDid(issuerDid), "Invalid issuer DID");
        require(_resolveDidToAddress(issuerDid) == msg.sender, "DID does not match caller");
        require(toOwner != address(0), "Invalid owner address");

        string memory compositeKey = _getCompositeKey(docType, docKey);

        // 2. Vérifier si la clé composite existe déjà
        if (docTypeKeyToTokenId[compositeKey] != 0) {
            uint256 existingTokenId = docTypeKeyToTokenId[compositeKey];
            string memory existingCid = _documents[existingTokenId].ipfsCid;

            // 2a. Même hash → document déjà existant
            if (keccak256(bytes(existingCid)) == keccak256(bytes(ipfsCid))) {
                revert("Document already exists with this type and key");
            }
            // 2b. Hash différent → admin non autorisé
            else {
                revert("Admin does not have rights to modify this document");
            }
        }

        // 3. Vérifier si le hash existe déjà dans un autre document
        if (hashToTokenId[ipfsCid] != 0) {
            revert("This file is already associated with another document");
        }

        // 4. Émettre le document
        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();

        Document storage newDoc = _documents[newTokenId];
        newDoc.docType = docType;
        newDoc.docKey = docKey;
        newDoc.issuerDid = issuerDid;
        newDoc.issuerAddress = msg.sender;
        newDoc.owner = toOwner;
        newDoc.issuanceDate = block.timestamp;
        newDoc.isActive = true;
        newDoc.ipfsCid = ipfsCid;
        newDoc.isTransferable = isTransferable;

        // 5. Copier les attributs
        for (uint i = 0; i < attributes.length; i++) {
            newDoc.attributes.push(attributes[i]);
        }

        // 6. Ajouter la première version
        newDoc.versions.push(DocumentVersion({
            ipfsCid: ipfsCid,
            owner: toOwner,
            timestamp: block.timestamp
        }));
        newDoc.versionCount = 1;

        // 7. Enregistrer les mappings
        docTypeKeyToTokenId[compositeKey] = newTokenId;
        hashToTokenId[ipfsCid] = newTokenId;

        // 8. Mint du token ERC-721
        _safeMint(toOwner, newTokenId);
        _setTokenURI(newTokenId, string(abi.encodePacked("ipfs://", ipfsCid)));

        emit DocumentIssued(docType, docKey, newTokenId, toOwner);
        return newTokenId;
    }

    // ============================================================
    // GESTION DES VERSIONS
    // ============================================================

    function addDocumentVersion(uint256 tokenId, string memory newCid)
        public
        documentExists(tokenId)
        documentActive(tokenId)
    {
        Document storage doc = _documents[tokenId];
        require(doc.owner == msg.sender || hasRole(NOTARY_ROLE, msg.sender),
                "Only owner or notary can add version");
        require(bytes(newCid).length > 0, "CID is required");
        require(hashToTokenId[newCid] == 0, "This CID is already used");

        doc.versions.push(DocumentVersion({
            ipfsCid: newCid,
            owner: doc.owner,
            timestamp: block.timestamp
        }));
        doc.ipfsCid = newCid;
        doc.versionCount++;

        hashToTokenId[newCid] = tokenId;

        emit DocumentVersionAdded(tokenId, doc.versionCount - 1, newCid);
    }

    function getDocumentVersions(uint256 tokenId)
        public
        view
        documentExists(tokenId)
        returns (DocumentVersion[] memory)
    {
        return _documents[tokenId].versions;
    }

    function getCurrentVersion(uint256 tokenId)
        public
        view
        documentExists(tokenId)
        returns (DocumentVersion memory)
    {
        Document storage doc = _documents[tokenId];
        require(doc.versions.length > 0, "No versions");
        return doc.versions[doc.versions.length - 1];
    }

    function getOwnerAtTimestamp(uint256 tokenId, uint256 timestamp)
        public
        view
        documentExists(tokenId)
        returns (address)
    {
        Document storage doc = _documents[tokenId];
        for (uint i = 0; i < doc.versions.length; i++) {
            if (doc.versions[i].timestamp <= timestamp) {
                if (i == doc.versions.length - 1 ||
                    doc.versions[i+1].timestamp > timestamp) {
                    return doc.versions[i].owner;
                }
            }
        }
        return address(0);
    }

    // ============================================================
    // TRANSFERT DE DOCUMENT
    // ============================================================

    function initiateTransfer(
        uint256 tokenId,
        address buyer,
        bytes memory sellerSignature
    ) public documentExists(tokenId) documentActive(tokenId) {
        Document storage doc = _documents[tokenId];
        require(doc.owner == msg.sender, "Only owner can initiate");
        require(transferRequests[tokenId].seller == address(0), "Transfer already initiated");

        bytes32 message = keccak256(abi.encodePacked(tokenId, buyer, block.chainid));
        require(_recoverSigner(message, sellerSignature) == doc.owner, "Invalid seller signature");

        transferRequests[tokenId] = TransferRequest({
            seller: doc.owner,
            buyer: buyer,
            tokenId: tokenId,
            sellerSignature: sellerSignature,
            buyerSignature: "",
            sellerSigned: true,
            buyerSigned: false,
            timestamp: block.timestamp
        });

        emit TransferRequested(tokenId, doc.owner, buyer);
    }

    function acceptTransfer(
        uint256 tokenId,
        bytes memory buyerSignature
    ) public documentExists(tokenId) {
        TransferRequest storage request = transferRequests[tokenId];
        require(request.seller != address(0), "No transfer request");
        require(!request.buyerSigned, "Buyer already signed");
        require(msg.sender == request.buyer, "Only buyer can accept");

        bytes32 message = keccak256(abi.encodePacked(tokenId, request.buyer, block.chainid));
        require(_recoverSigner(message, buyerSignature) == request.buyer, "Invalid buyer signature");

        request.buyerSignature = buyerSignature;
        request.buyerSigned = true;

        emit TransferAccepted(tokenId, request.buyer);
    }

    function finalizeTransfer(
        uint256 tokenId,
        bytes memory notarySignature,
        string memory newCid
    ) public onlyNotary documentExists(tokenId) {
        TransferRequest storage request = transferRequests[tokenId];
        require(request.sellerSigned && request.buyerSigned, "Both parties must sign");

        bytes32 message = keccak256(abi.encodePacked(tokenId, request.buyer, block.chainid));
        require(_recoverSigner(message, notarySignature) == msg.sender, "Invalid notary signature");

        // Exécuter le transfert
        address previousOwner = request.seller;
        address newOwner = request.buyer;

        Document storage doc = _documents[tokenId];
        doc.owner = newOwner;
        _transfer(previousOwner, newOwner, tokenId);

        // Ajouter une version avec le nouveau CID
        require(bytes(newCid).length > 0, "New CID is required");
        doc.versions.push(DocumentVersion({
            ipfsCid: newCid,
            owner: newOwner,
            timestamp: block.timestamp
        }));
        doc.ipfsCid = newCid;
        doc.versionCount++;

        hashToTokenId[newCid] = tokenId;

        delete transferRequests[tokenId];

        emit TransferCompleted(tokenId, newOwner, msg.sender);
        emit DocumentTransferred(tokenId, previousOwner, newOwner);
        emit DocumentVersionAdded(tokenId, doc.versionCount - 1, newCid);
    }

    function revokeDocument(uint256 tokenId)
        public
        documentExists(tokenId)
        onlyIssuer
    {
        Document storage doc = _documents[tokenId];
        require(doc.isActive, "Document already revoked");
        doc.isActive = false;
        emit DocumentRevoked(tokenId, msg.sender);
    }

    // ============================================================
    // VÉRIFICATION ET LECTURE
    // ============================================================

    function verifyDocument(uint256 tokenId)
        public
        view
        documentExists(tokenId)
        documentActive(tokenId)
        returns (
            bool isValid,
            string memory issuerDid,
            address issuerAddress,
            address owner,
            string memory docType,
            string memory docKey,
            string memory ipfsCid
        )
    {
        Document storage doc = _documents[tokenId];
        return (true, doc.issuerDid, doc.issuerAddress, doc.owner, doc.docType, doc.docKey, doc.ipfsCid);
    }

    function getDocument(uint256 tokenId)
        public
        view
        documentExists(tokenId)
        returns (Document memory)
    {
        return _documents[tokenId];
    }

    function getAttributes(uint256 tokenId)
        public
        view
        documentExists(tokenId)
        documentActive(tokenId)
        returns (Attribute[] memory)
    {
        return _documents[tokenId].attributes;
    }

    function getDocumentCID(uint256 tokenId)
        public
        view
        documentExists(tokenId)
        returns (string memory)
    {
        return _documents[tokenId].ipfsCid;
    }

    function isTransferable(uint256 tokenId)
        public
        view
        documentExists(tokenId)
        returns (bool)
    {
        return _documents[tokenId].isTransferable;
    }

    function getTransferStatus(uint256 tokenId)
        public
        view
        returns (
            bool pending,
            address seller,
            address buyer,
            bool sellerSigned,
            bool buyerSigned
        )
    {
        TransferRequest storage request = transferRequests[tokenId];
        if (request.seller == address(0)) {
            return (false, address(0), address(0), false, false);
        }
        return (true, request.seller, request.buyer, request.sellerSigned, request.buyerSigned);
    }

    // ============================================================
    // FONCTIONS DE SIGNATURE (Récupération)
    // ============================================================

    function _recoverSigner(bytes32 message, bytes memory signature)
        internal
        pure
        returns (address)
    {
        require(signature.length == 65, "Invalid signature length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }
        return ecrecover(message, v, r, s);
    }

    // ============================================================
    // OVERRIDES
    // ============================================================

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
