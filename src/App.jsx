import React, { useEffect, useState } from 'react'
import {
  collection, addDoc, onSnapshot, query, orderBy,
  doc, updateDoc, serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'

const EQUIPE = ['Lucie', 'Noa', 'Sonny']

// ---------- Hooks Firestore ----------
function useCollection(name, order = 'createdAt') {
  const [items, setItems] = useState(null)
  useEffect(() => {
    const q = query(collection(db, name), orderBy(order, 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [name, order])
  return items
}

// ---------- Utilisateur local (qui es-tu ?) ----------
function useUser() {
  const [user, setUser] = useState(() => localStorage.getItem('releves-eau:user') || '')
  const setAndStore = (name) => {
    localStorage.setItem('releves-eau:user', name)
    setUser(name)
  }
  return [user, setAndStore]
}

export default function App() {
  const [user, setUser] = useUser()
  const [view, setView] = useState({ screen: 'liste' }) // liste | residence | adresse | dashboard
  const [showResidenceForm, setShowResidenceForm] = useState(false)
  const [showAddressForm, setShowAddressForm] = useState(false)
  const [showPassageForm, setShowPassageForm] = useState(false)

  const residences = useCollection('residences')
  const adresses = useCollection('adresses')
  const passages = useCollection('passages')

  if (!user) {
    return <LoginGate onSet={setUser} />
  }

  const currentResidence = view.residenceId
    ? residences?.find((r) => r.id === view.residenceId)
    : null
  const currentAdresse = view.adresseId
    ? adresses?.find((a) => a.id === view.adresseId)
    : null

  const ongletsVisibles = view.screen === 'liste' || view.screen === 'dashboard'

  return (
    <div className="app">
      <Hero user={user} onChangeUser={() => setUser('')} view={view} currentResidence={currentResidence} />

      {ongletsVisibles && (
        <div className="tabs">
          <button
            className={`tab ${view.screen === 'liste' ? 'tab--active' : ''}`}
            onClick={() => setView({ screen: 'liste' })}
          >
            Résidences
          </button>
          <button
            className={`tab ${view.screen === 'dashboard' ? 'tab--active' : ''}`}
            onClick={() => setView({ screen: 'dashboard' })}
          >
            Tableau de bord
          </button>
        </div>
      )}

      <div className="content">
        {view.screen === 'liste' && (
          <ListeResidences
            residences={residences}
            adresses={adresses}
            passages={passages}
            onOpen={(id) => setView({ screen: 'residence', residenceId: id })}
          />
        )}

        {view.screen === 'dashboard' && (
          <Dashboard
            user={user}
            residences={residences}
            adresses={adresses}
            passages={passages}
            onOpenAdresse={(residenceId, adresseId) => setView({ screen: 'adresse', residenceId, adresseId })}
          />
        )}

        {view.screen === 'residence' && currentResidence && (
          <ListeAdresses
            residence={currentResidence}
            adresses={adresses?.filter((a) => a.residenceId === currentResidence.id)}
            passages={passages}
            onBack={() => setView({ screen: 'liste' })}
            onOpenAdresse={(id) => setView({ screen: 'adresse', residenceId: currentResidence.id, adresseId: id })}
            onAdd={() => setShowAddressForm(true)}
          />
        )}

        {view.screen === 'adresse' && currentAdresse && (
          <DetailAdresse
            adresse={currentAdresse}
            residence={currentResidence}
            passages={passages?.filter((p) => p.adresseId === currentAdresse.id)}
            onBack={() => setView({ screen: currentResidence ? 'residence' : 'dashboard', residenceId: currentResidence?.id })}
            onNouveauPassage={() => setShowPassageForm(true)}
            user={user}
          />
        )}
      </div>

      {view.screen === 'liste' && (
        <div className="fab">
          <button className="btn-primary" onClick={() => setShowResidenceForm(true)}>
            + Nouvelle résidence
          </button>
        </div>
      )}

      {showResidenceForm && (
        <ResidenceForm
          onClose={() => setShowResidenceForm(false)}
          onSaved={(id) => {
            setShowResidenceForm(false)
            setView({ screen: 'residence', residenceId: id })
          }}
        />
      )}

      {showAddressForm && currentResidence && (
        <AddressForm
          residenceId={currentResidence.id}
          onClose={() => setShowAddressForm(false)}
        />
      )}

      {showPassageForm && currentAdresse && (
        <PassageForm
          adresseId={currentAdresse.id}
          user={user}
          onClose={() => setShowPassageForm(false)}
        />
      )}
    </div>
  )
}

// ---------- Écran de connexion : choix du prénom ----------
function LoginGate({ onSet }) {
  return (
    <div className="app">
      <div className="hero">
        <div className="hero__dial" />
        <p className="hero__eyebrow">Tournée compteurs</p>
        <h1>Relevés d'eau</h1>
        <p className="hero__sub">Choisis ton prénom pour commencer.</p>
      </div>
      <div className="content">
        <div className="card">
          <div className="person-grid">
            {EQUIPE.map((nom) => (
              <button key={nom} className="person-btn" onClick={() => onSet(nom)}>
                {nom}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------- En-tête ----------
function Hero({ user, onChangeUser, view, currentResidence }) {
  const titre = view.screen === 'residence' && currentResidence
    ? currentResidence.nom
    : view.screen === 'adresse'
      ? 'Fiche adresse'
      : view.screen === 'dashboard'
        ? 'Tableau de bord'
        : 'Relevés d\'eau'

  return (
    <div className="hero">
      <div className="hero__dial" />
      <p className="hero__eyebrow">{view.screen === 'liste' ? 'Toutes les résidences' : 'Tournée compteurs'}</p>
      <h1>{titre}</h1>
      {view.screen === 'liste' && (
        <p className="hero__sub">Adresses et suivi des passages, partagés entre vous 3.</p>
      )}
      <div className="hero__user">
        {user} · <button onClick={onChangeUser}>changer</button>
      </div>
    </div>
  )
}

// ---------- Liste des résidences ----------
function ListeResidences({ residences, adresses, passages, onOpen }) {
  if (residences === null) return <Chargement />
  if (residences.length === 0) {
    return (
      <EmptyState
        titre="Aucune résidence pour l'instant"
        texte="Ajoute la première résidence avec le bouton ci-dessous."
      />
    )
  }

  return (
    <div>
      <div className="section-label">Résidences ({residences.length})</div>
      {residences.map((r) => {
        const adressesResidence = adresses?.filter((a) => a.residenceId === r.id) || []
        const fuitesEnCours = passages?.filter(
          (p) => adressesResidence.some((a) => a.id === p.adresseId) && p.fuiteSuspectee && !p.plombierEnvoye
        ).length || 0

        return (
          <div key={r.id} className="card residence-card" onClick={() => onOpen(r.id)}>
            <div>
              <p className="residence-card__name">{r.nom}</p>
              <p className="residence-card__meta">
                {adressesResidence.length} adresse{adressesResidence.length > 1 ? 's' : ''}
              </p>
            </div>
            {fuitesEnCours > 0 ? (
              <span className="badge badge--danger">{fuitesEnCours} fuite{fuitesEnCours > 1 ? 's' : ''}</span>
            ) : (
              <span className="badge badge--ok">OK</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------- Tableau de bord partagé ----------
function Dashboard({ user, residences, adresses, passages, onOpenAdresse }) {
  if (residences === null || adresses === null || passages === null) return <Chargement />

  const totalAdresses = adresses.length
  const adressesFaites = adresses.filter((a) => passages.some((p) => p.adresseId === a.id))
  const adressesRestantes = adresses.filter((a) => !passages.some((p) => p.adresseId === a.id))
  const fuitesEnAttente = passages.filter((p) => p.fuiteSuspectee && !p.plombierEnvoye)

  const parPersonne = EQUIPE.map((nom) => ({
    nom,
    total: passages.filter((p) => p.auteur === nom).length,
  }))

  const labelAdresse = (adresseId) => {
    const a = adresses.find((x) => x.id === adresseId)
    if (!a) return { texte: 'Adresse supprimée', residenceId: null }
    const res = residences.find((r) => r.id === a.residenceId)
    return { texte: `${a.adresse}${res ? ' · ' + res.nom : ''}`, residenceId: a.residenceId, adresseId: a.id }
  }

  const derniersPassages = [...passages]
    .sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0))
    .slice(0, 8)

  const mesPassages = passages.filter((p) => p.auteur === user).length

  return (
    <div>
      <div className="section-label">Avancement global</div>
      <div className="stat-grid">
        <div className="stat-card">
          <p className="stat-card__num">{adressesFaites.length}/{totalAdresses}</p>
          <p className="stat-card__label">Adresses visitées</p>
        </div>
        <div className="stat-card">
          <p className="stat-card__num" style={{ color: fuitesEnAttente.length > 0 ? 'var(--rust)' : 'var(--teal)' }}>
            {fuitesEnAttente.length}
          </p>
          <p className="stat-card__label">Fuites en attente</p>
        </div>
        <div className="stat-card">
          <p className="stat-card__num">{mesPassages}</p>
          <p className="stat-card__label">Mes passages ({user})</p>
        </div>
      </div>

      <div className="section-label">Par personne</div>
      <div className="card">
        {parPersonne.map((p, i) => (
          <div key={p.nom} className="address-row" style={{ borderBottom: i === parPersonne.length - 1 ? 'none' : undefined }}>
            <p className="address-row__label">{p.nom}{p.nom === user ? ' (toi)' : ''}</p>
            <span className="badge badge--ok">{p.total} passage{p.total > 1 ? 's' : ''}</span>
          </div>
        ))}
      </div>

      {fuitesEnAttente.length > 0 && (
        <>
          <div className="section-label">Fuites à traiter</div>
          <div className="card">
            {fuitesEnAttente.map((p, i) => {
              const info = labelAdresse(p.adresseId)
              return (
                <div
                  key={p.id}
                  className="address-row"
                  style={{ cursor: 'pointer', borderBottom: i === fuitesEnAttente.length - 1 ? 'none' : undefined }}
                  onClick={() => info.residenceId && onOpenAdresse(info.residenceId, info.adresseId)}
                >
                  <div>
                    <p className="address-row__label">{info.texte}</p>
                    <p className="address-row__meter">Signalée par {p.auteur}</p>
                  </div>
                  <span className="badge badge--danger">Fuite</span>
                </div>
              )
            })}
          </div>
        </>
      )}

      <div className="section-label">Adresses restantes ({adressesRestantes.length})</div>
      {adressesRestantes.length === 0 ? (
        <EmptyState titre="Tout est à jour" texte="Toutes les adresses ont été visitées au moins une fois." />
      ) : (
        <div className="card">
          {adressesRestantes.map((a, i) => {
            const res = residences.find((r) => r.id === a.residenceId)
            return (
              <div
                key={a.id}
                className="address-row"
                style={{ cursor: 'pointer', borderBottom: i === adressesRestantes.length - 1 ? 'none' : undefined }}
                onClick={() => onOpenAdresse(a.residenceId, a.id)}
              >
                <div>
                  <p className="address-row__label">{a.adresse}</p>
                  <p className="address-row__meter">{res?.nom || ''}</p>
                </div>
                <span className="badge badge--warn">À faire</span>
              </div>
            )
          })}
        </div>
      )}

      <div className="section-label">Activité récente</div>
      {derniersPassages.length === 0 ? (
        <EmptyState titre="Aucune activité" texte="Les passages de toute l'équipe apparaîtront ici." />
      ) : (
        <div className="card">
          {derniersPassages.map((p, i) => {
            const info = labelAdresse(p.adresseId)
            return (
              <div key={p.id} className="address-row" style={{ borderBottom: i === derniersPassages.length - 1 ? 'none' : undefined }}>
                <div>
                  <p className="releve-item__meta" style={{ marginBottom: 3 }}>
                    {p.date?.seconds ? new Date(p.date.seconds * 1000).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '...'}
                    {' · '}<strong>{p.auteur}</strong>
                  </p>
                  <p className="address-row__label" style={{ fontWeight: 400 }}>{info.texte}</p>
                </div>
                {p.fuiteSuspectee && <span className="badge badge--danger">Fuite</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------- Liste des adresses d'une résidence ----------
function ListeAdresses({ residence, adresses, passages, onBack, onOpenAdresse, onAdd }) {
  return (
    <div>
      <button className="back-link" onClick={onBack}>← Toutes les résidences</button>

      <div className="section-label">Adresses</div>
      {adresses === undefined || adresses === null ? (
        <Chargement />
      ) : adresses.length === 0 ? (
        <EmptyState titre="Pas encore d'adresse" texte="Ajoute une adresse pour cette résidence." />
      ) : (
        <div className="card">
          {adresses.map((a) => {
            const dernierPassage = passages
              ?.filter((p) => p.adresseId === a.id)
              ?.sort((x, y) => (y.date?.seconds || 0) - (x.date?.seconds || 0))[0]
            return (
              <div key={a.id} className="address-row" onClick={() => onOpenAdresse(a.id)} style={{ cursor: 'pointer' }}>
                <div>
                  <p className="address-row__label">{a.adresse}</p>
                  {a.notes && <p className="address-row__meter">{a.notes}</p>}
                </div>
                {dernierPassage?.fuiteSuspectee && !dernierPassage?.plombierEnvoye ? (
                  <span className="badge badge--danger">Fuite</span>
                ) : dernierPassage?.plombierEnvoye ? (
                  <span className="badge badge--ok">Plombier ✓</span>
                ) : dernierPassage ? (
                  <span className="badge badge--ok">Fait ({dernierPassage.auteur})</span>
                ) : (
                  <span className="badge badge--warn">À faire</span>
                )}
              </div>
            )
          })}
        </div>
      )}

      <button className="btn-ghost" onClick={onAdd}>+ Ajouter une adresse à {residence.nom}</button>
    </div>
  )
}

// ---------- Détail d'une adresse ----------
function DetailAdresse({ adresse, passages, onBack, onNouveauPassage, user }) {
  const marquerPlombier = async (passageId) => {
    await updateDoc(doc(db, 'passages', passageId), {
      plombierEnvoye: true,
      plombierDate: serverTimestamp(),
      plombierPar: user,
    })
  }

  return (
    <div>
      <button className="back-link" onClick={onBack}>← Retour</button>

      <div className="card">
        <p className="residence-card__name" style={{ marginBottom: 4 }}>{adresse.adresse}</p>
        {adresse.notes && <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>{adresse.notes}</p>}
      </div>

      <button className="btn-primary" onClick={onNouveauPassage} style={{ marginBottom: 18 }}>
        ✓ Marquer un passage ici
      </button>

      <div className="section-label">Historique des passages</div>
      {passages === undefined || passages === null ? (
        <Chargement />
      ) : passages.length === 0 ? (
        <EmptyState titre="Aucun passage" texte="Le premier passage apparaîtra ici." />
      ) : (
        <div className="card">
          {passages
            .sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0))
            .map((p) => (
              <div key={p.id} className="address-row">
                <div>
                  <p className="releve-item__meta" style={{ marginBottom: 3 }}>
                    {p.date?.seconds ? new Date(p.date.seconds * 1000).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '...'}
                    {' · '}<strong>{p.auteur}</strong>
                  </p>
                  {p.commentaire && <p className="releve-item__comment" style={{ margin: '0 0 6px' }}>{p.commentaire}</p>}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {p.fuiteSuspectee && (
                      <span className="badge badge--danger">Fuite suspectée</span>
                    )}
                    {p.plombierEnvoye ? (
                      <span className="badge badge--ok">
                        Plombier passé{p.plombierPar ? ` (${p.plombierPar})` : ''}
                      </span>
                    ) : p.fuiteSuspectee ? (
                      <button className="icon-btn" onClick={() => marquerPlombier(p.id)}>
                        Marquer plombier passé
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

// ---------- Formulaire résidence ----------
function ResidenceForm({ onClose, onSaved }) {
  const [nom, setNom] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!nom.trim()) return
    setSaving(true)
    const docRef = await addDoc(collection(db, 'residences'), {
      nom: nom.trim(),
      createdAt: serverTimestamp(),
    })
    setSaving(false)
    onSaved(docRef.id)
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>Nouvelle résidence</h2>
        <div className="field">
          <label>Nom de la résidence</label>
          <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="ex. Résidence Les Tilleuls" autoFocus />
        </div>
        <div className="sheet-actions">
          <button className="btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn-primary" disabled={!nom.trim() || saving} onClick={submit}>
            {saving ? 'Enregistrement...' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------- Formulaire adresse ----------
function AddressForm({ residenceId, onClose }) {
  const [adresse, setAdresse] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!adresse.trim()) return
    setSaving(true)
    await addDoc(collection(db, 'adresses'), {
      residenceId,
      adresse: adresse.trim(),
      notes: notes.trim(),
      createdAt: serverTimestamp(),
    })
    setSaving(false)
    onClose()
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>Nouvelle adresse</h2>
        <div className="field">
          <label>Adresse complète</label>
          <input value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="ex. 12 rue des Tilleuls, Bât B, Apt 4" autoFocus />
        </div>
        <div className="field">
          <label>Notes (accès, digicode...)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ex. Code B4127, compteur dans le local sous-sol" />
        </div>
        <div className="sheet-actions">
          <button className="btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn-primary" disabled={!adresse.trim() || saving} onClick={submit}>
            {saving ? 'Enregistrement...' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------- Formulaire nouveau passage (sans photo ni numéro) ----------
function PassageForm({ adresseId, user, onClose }) {
  const [fuiteSuspectee, setFuiteSuspectee] = useState(false)
  const [commentaire, setCommentaire] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    await addDoc(collection(db, 'passages'), {
      adresseId,
      fuiteSuspectee,
      plombierEnvoye: false,
      commentaire: commentaire.trim(),
      auteur: user,
      date: serverTimestamp(),
    })
    setSaving(false)
    onClose()
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>Marquer un passage</h2>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: -6, marginBottom: 14 }}>
          Aucune photo ni numéro de compteur n'est enregistré ici, par sécurité. Garde tes photos sur ton téléphone.
        </p>

        <div className="toggle-row">
          <span>Fuite suspectée ?</span>
          <input type="checkbox" checked={fuiteSuspectee} onChange={(e) => setFuiteSuspectee(e.target.checked)} />
        </div>

        <div className="field">
          <label>Commentaire (optionnel)</label>
          <textarea value={commentaire} onChange={(e) => setCommentaire(e.target.value)} placeholder="ex. Compteur tourne alors que rien n'est ouvert" />
        </div>

        <div className="sheet-actions">
          <button className="btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn-primary" disabled={saving} onClick={submit}>
            {saving ? 'Envoi...' : 'Enregistrer le passage'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------- Petits utilitaires d'affichage ----------
function Chargement() {
  return <p style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>Chargement...</p>
}

function EmptyState({ titre, texte }) {
  return (
    <div className="empty-state">
      <strong>{titre}</strong>
      <p>{texte}</p>
    </div>
  )
}
