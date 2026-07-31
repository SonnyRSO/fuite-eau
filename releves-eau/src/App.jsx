import React, { useEffect, useState } from 'react'
import {
  collection, addDoc, onSnapshot, query, orderBy,
  doc, updateDoc, serverTimestamp,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from './firebase'

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
  const [view, setView] = useState({ screen: 'liste' }) // liste | residence | adresse
  const [showResidenceForm, setShowResidenceForm] = useState(false)
  const [showAddressForm, setShowAddressForm] = useState(false)
  const [showReleveForm, setShowReleveForm] = useState(false)

  const residences = useCollection('residences')
  const adresses = useCollection('adresses')
  const releves = useCollection('releves')

  if (!user) {
    return <LoginGate onSet={setUser} />
  }

  const currentResidence = view.residenceId
    ? residences?.find((r) => r.id === view.residenceId)
    : null
  const currentAdresse = view.adresseId
    ? adresses?.find((a) => a.id === view.adresseId)
    : null

  return (
    <div className="app">
      <Hero user={user} onChangeUser={() => setUser('')} view={view} currentResidence={currentResidence} />

      <div className="content">
        {view.screen === 'liste' && (
          <ListeResidences
            residences={residences}
            adresses={adresses}
            releves={releves}
            onOpen={(id) => setView({ screen: 'residence', residenceId: id })}
          />
        )}

        {view.screen === 'residence' && currentResidence && (
          <ListeAdresses
            residence={currentResidence}
            adresses={adresses?.filter((a) => a.residenceId === currentResidence.id)}
            releves={releves}
            onBack={() => setView({ screen: 'liste' })}
            onOpenAdresse={(id) => setView({ screen: 'adresse', residenceId: currentResidence.id, adresseId: id })}
            onAdd={() => setShowAddressForm(true)}
          />
        )}

        {view.screen === 'adresse' && currentAdresse && (
          <DetailAdresse
            adresse={currentAdresse}
            residence={currentResidence}
            releves={releves?.filter((r) => r.adresseId === currentAdresse.id)}
            onBack={() => setView({ screen: 'residence', residenceId: currentResidence.id })}
            onNouveauReleve={() => setShowReleveForm(true)}
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

      {showReleveForm && currentAdresse && (
        <ReleveForm
          adresseId={currentAdresse.id}
          user={user}
          onClose={() => setShowReleveForm(false)}
        />
      )}
    </div>
  )
}

// ---------- Écran de connexion légère ----------
function LoginGate({ onSet }) {
  const [name, setName] = useState('')
  return (
    <div className="app">
      <div className="hero">
        <div className="hero__dial" />
        <p className="hero__eyebrow">Tournée compteurs</p>
        <h1>Relevés d'eau</h1>
        <p className="hero__sub">Adresses, compteurs et suivi des fuites, partagés entre vous 3.</p>
      </div>
      <div className="content">
        <div className="card">
          <div className="field">
            <label>Ton prénom (pour identifier tes relevés)</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex. Karim"
              autoFocus
            />
          </div>
          <button
            className="btn-primary"
            disabled={!name.trim()}
            onClick={() => onSet(name.trim())}
          >
            Continuer
          </button>
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
      : 'Relevés d\'eau'

  return (
    <div className="hero">
      <div className="hero__dial" />
      <p className="hero__eyebrow">{view.screen === 'liste' ? 'Toutes les résidences' : 'Tournée compteurs'}</p>
      <h1>{titre}</h1>
      {view.screen === 'liste' && (
        <p className="hero__sub">Adresses, compteurs et suivi des fuites, partagés entre vous 3.</p>
      )}
      <div className="hero__user">
        {user} · <button onClick={onChangeUser}>changer</button>
      </div>
    </div>
  )
}

// ---------- Liste des résidences ----------
function ListeResidences({ residences, adresses, releves, onOpen }) {
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
        const fuitesEnCours = releves?.filter(
          (rl) => adressesResidence.some((a) => a.id === rl.adresseId) && rl.fuiteSuspectee && !rl.plombierEnvoye
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

// ---------- Liste des adresses d'une résidence ----------
function ListeAdresses({ residence, adresses, releves, onBack, onOpenAdresse, onAdd }) {
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
            const dernierReleve = releves
              ?.filter((r) => r.adresseId === a.id)
              ?.sort((x, y) => (y.date?.seconds || 0) - (x.date?.seconds || 0))[0]
            return (
              <div key={a.id} className="address-row" onClick={() => onOpenAdresse(a.id)} style={{ cursor: 'pointer' }}>
                <div>
                  <p className="address-row__label">{a.adresse}</p>
                  <p className="address-row__meter">Compteur n° {a.numeroCompteur || '—'}</p>
                </div>
                {dernierReleve?.fuiteSuspectee && !dernierReleve?.plombierEnvoye ? (
                  <span className="badge badge--danger">Fuite</span>
                ) : dernierReleve?.plombierEnvoye ? (
                  <span className="badge badge--ok">Plombier ✓</span>
                ) : (
                  <span className="badge badge--warn">À vérifier</span>
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
function DetailAdresse({ adresse, releves, onBack, onNouveauReleve, user }) {
  const marquerPlombier = async (releveId) => {
    await updateDoc(doc(db, 'releves', releveId), {
      plombierEnvoye: true,
      plombierDate: serverTimestamp(),
      plombierPar: user,
    })
  }

  return (
    <div>
      <button className="back-link" onClick={onBack}>← Retour aux adresses</button>

      <div className="card">
        <p className="residence-card__name" style={{ marginBottom: 8 }}>{adresse.adresse}</p>
        <div className="meter-display">{adresse.numeroCompteur || '——————'}</div>
        {adresse.notes && <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>{adresse.notes}</p>}
      </div>

      <button className="btn-primary" onClick={onNouveauReleve} style={{ marginBottom: 18 }}>
        📷 Nouveau relevé (photo)
      </button>

      <div className="section-label">Historique des relevés</div>
      {releves === undefined || releves === null ? (
        <Chargement />
      ) : releves.length === 0 ? (
        <EmptyState titre="Aucun relevé" texte="Le premier relevé apparaîtra ici après une photo." />
      ) : (
        <div className="card">
          {releves
            .sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0))
            .map((r) => (
              <div key={r.id} className="releve-item">
                {r.photoURL && <img src={r.photoURL} alt="compteur" />}
                <div style={{ flex: 1 }}>
                  <p className="releve-item__meta">
                    {r.date?.seconds ? new Date(r.date.seconds * 1000).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '...'}
                    {' · '}{r.auteur}
                  </p>
                  {r.commentaire && <p className="releve-item__comment">{r.commentaire}</p>}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {r.fuiteSuspectee && (
                      <span className="badge badge--danger">Fuite suspectée</span>
                    )}
                    {r.plombierEnvoye ? (
                      <span className="badge badge--ok">
                        Plombier passé{r.plombierPar ? ` (${r.plombierPar})` : ''}
                      </span>
                    ) : r.fuiteSuspectee ? (
                      <button className="icon-btn" onClick={() => marquerPlombier(r.id)}>
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
  const [numeroCompteur, setNumeroCompteur] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!adresse.trim()) return
    setSaving(true)
    await addDoc(collection(db, 'adresses'), {
      residenceId,
      adresse: adresse.trim(),
      numeroCompteur: numeroCompteur.trim(),
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
          <label>Numéro de compteur</label>
          <input value={numeroCompteur} onChange={(e) => setNumeroCompteur(e.target.value)} placeholder="ex. 0044821" />
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

// ---------- Formulaire nouveau relevé (photo) ----------
function ReleveForm({ adresseId, user, onClose }) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [fuiteSuspectee, setFuiteSuspectee] = useState(false)
  const [commentaire, setCommentaire] = useState('')
  const [saving, setSaving] = useState(false)

  const onFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const submit = async () => {
    setSaving(true)
    let photoURL = null
    if (file) {
      const path = `releves/${adresseId}/${Date.now()}_${file.name}`
      const storageRef = ref(storage, path)
      await uploadBytes(storageRef, file)
      photoURL = await getDownloadURL(storageRef)
    }
    await addDoc(collection(db, 'releves'), {
      adresseId,
      photoURL,
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
        <h2>Nouveau relevé</h2>

        <div className="field">
          <label>Photo du compteur</label>
          <input type="file" accept="image/*" capture="environment" onChange={onFile} />
        </div>
        {preview && (
          <img src={preview} alt="aperçu" style={{ width: '100%', borderRadius: 10, marginBottom: 12 }} />
        )}

        <div className="toggle-row">
          <span>Fuite suspectée ?</span>
          <input type="checkbox" checked={fuiteSuspectee} onChange={(e) => setFuiteSuspectee(e.target.checked)} />
        </div>

        <div className="field">
          <label>Commentaire</label>
          <textarea value={commentaire} onChange={(e) => setCommentaire(e.target.value)} placeholder="ex. Compteur tourne alors que rien n'est ouvert" />
        </div>

        <div className="sheet-actions">
          <button className="btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn-primary" disabled={saving} onClick={submit}>
            {saving ? 'Envoi...' : 'Enregistrer le relevé'}
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
