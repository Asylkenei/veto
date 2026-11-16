import { useState } from 'react'
import { Modal } from '../../components/Modal'
import { ErrorNotice } from '../../components/States'
import { api } from '../../lib/api'
import { DeadlinePicker } from '../../components/DeadlinePicker'
import { Toggle } from './CreateDecisionPage'
import { METHODS, type Method, type Room } from './types'

export function RoomSettingsModal({ room, open, onClose, onSaved }: { room: Room; open: boolean; onClose: () => void; onSaved: (r: Room) => void }) {
  const [title, setTitle] = useState(room.title)
  const [question, setQuestion] = useState(room.question)
  const [description, setDescription] = useState(room.description)
  const [method, setMethod] = useState<Method>(room.method)
  const [allowSuggestions, setAllowSuggestions] = useState(room.allow_suggestions)
  const [allowComments, setAllowComments] = useState(room.allow_comments)
  const [hideResults, setHideResults] = useState(room.hide_results)
  const [deadline, setDeadline] = useState<string | null>(room.deadline)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function save() {
    setBusy(true); setError('')
    try {
      onSaved(await api.updateRoom(room.id, { title, question, description, method, allow_suggestions: allowSuggestions, allow_comments: allowComments, hide_results: hideResults, deadline }))
      onClose()
    } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось сохранить') } finally { setBusy(false) }
  }
  return <Modal open={open} onClose={onClose} title="Настройки решения" wide>
    <div className="form">
      <label className="field"><span>Название</span><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={180} /></label>
      <label className="field"><span>Вопрос</span><input className="input" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={500} /></label>
      <label className="field"><span>Контекст</span><textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
      <div className="field"><span>Метод</span><div className="segmented">{(Object.keys(METHODS) as Method[]).map((m) => <button key={m} type="button" className={method === m ? 'active' : ''} onClick={() => setMethod(m)}>{METHODS[m].name}</button>)}</div></div>
      <Toggle title="Участники предлагают варианты" detail="Организатор рассматривает предложения." checked={allowSuggestions} onChange={setAllowSuggestions} />
      <Toggle title="Комментарии" detail="Обсуждение до начала голосования." checked={allowComments} onChange={setAllowComments} />
      <Toggle title="Скрыть голоса до завершения" detail="Чужой выбор не виден во время голосования." checked={hideResults} onChange={setHideResults} />
      <DeadlinePicker value={deadline} onChange={setDeadline} />
      {error && <ErrorNotice message={error} />}
      <div className="modal-actions"><button className="btn" onClick={onClose}>Отмена</button><button className="btn primary" onClick={() => void save()} disabled={busy || !title.trim() || !question.trim()}>{busy ? 'Сохраняем…' : 'Сохранить'}</button></div>
    </div>
  </Modal>
}
