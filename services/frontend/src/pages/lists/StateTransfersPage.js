import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyWorkflows, getUsers } from '../../services/api';
import { useLiveRefresh } from '../../hooks/useLiveRefresh';
import GenericListPage from '../generic/GenericListPage';

const STATUS_LABELS = {
  AWAITING_VERIFICATION: 'En attente de signature acheteur',
  AWAITING_NOTARY: 'À finaliser',
  COMPLETED: 'Finalisé',
  REJECTED: 'Refusé',
};

const COLUMNS = [
  { key: 'id', label: 'ID', render: (r) => `#${r.id}` },
  { key: 'document_token_id', label: 'Document', render: (r) => `Token #${r.document_token_id}` },
  { key: 'sellerName', label: 'Vendeur' },
  { key: 'buyerName', label: 'Acheteur' },
  { key: 'status', label: 'Statut', render: (r) => STATUS_LABELS[r.status] || r.status },
];

/** Ventes de titres fonciers (triple signature vendeur/acheteur/notaire) — patron
 * "Liste" générique de la maquette, clic sur une ligne → signature/suivi du transfert.
 * `onlyAwaitingNotary` restreint aux transferts où c'est au tour du notaire de signer —
 * utilisé par l'onglet dédié "Signatures en attente", une file d'action plutôt qu'une
 * vue d'ensemble (même principe que "Vérifications" séparé de la liste complète). */
export default function StateTransfersPage({ title = 'Transferts en cours', crumb = 'Actes notariés', onlyAwaitingNotary = false }) {
  const navigate = useNavigate();
  // `refreshTick` force GenericListPage à relancer sa recherche (son useEffect dépend de
  // l'identité de `fetcher`) quand un événement WebSocket arrive (useLiveRefresh).
  const [refreshTick, setRefreshTick] = useState(0);
  useLiveRefresh(() => setRefreshTick((t) => t + 1));

  const fetcher = useCallback(async () => {
    const [response, allUsers] = await Promise.all([getMyWorkflows(), getUsers()]);
    const usersById = Object.fromEntries(allUsers.map((u) => [u.id, u.full_name]));
    return response
      .filter((wf) => wf.type === 'LAND_TRANSFER')
      .filter((wf) => !onlyAwaitingNotary || wf.status === 'AWAITING_NOTARY')
      .map((wf) => ({
        ...wf,
        sellerName: usersById[wf.initiator_id] || wf.initiator_id,
        buyerName: usersById[wf.target_user_id] || wf.target_user_id,
      }));
  }, [refreshTick, onlyAwaitingNotary]);

  return (
    <GenericListPage
      title={title}
      crumb={crumb}
      fetcher={fetcher}
      columns={COLUMNS}
      searchKeys={['sellerName', 'buyerName', 'document_token_id']}
      statusKey={onlyAwaitingNotary ? undefined : 'status'}
      onRowClick={(row) => navigate(`/transfer/${row.id}`)}
      emptyLabel={onlyAwaitingNotary ? 'Aucune signature en attente.' : 'Aucune vente en cours.'}
    />
  );
}
