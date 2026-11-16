import { useEffect, useState } from 'react'
import { ArrowLeft, Check, MapPin, X } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { InlineFeedback } from '../../components/States'
import { api } from '../../lib/api'
import { DeadlinePicker } from '../../components/DeadlinePicker'
import { formatDateTime } from '../../lib/format'
import type { Place } from '../discovery/types'
import { METHODS, type Method } from './types'
import { TEMPLATES } from './templates'

const steps = ['Вопрос', 'Метод', 'Настройки', 'Проверка']

export function CreateDecisionPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [step, setStep] = useState(0)
  const [template, setTemplate] = useState('')
  const [title, setTitle] = useState('')
  const [question, setQuestion] = useState('')
  const [description, setDescription] = useState('')
  const [method, setMethod] = useState<Method>('majority')
  const [allowSuggestions, setAllowSuggestions] = useState(true)
  const [allowComments, setAllowComments] = useState(true)
  const [hideResults, setHideResults] = useState(false)
  const [deadline, setDeadline] = useState<string | null>(null)
  const [place, setPlace] = useState<Place | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const q = params.get('q')
    if (q) { setQuestion(q); setTitle(q.length > 60 ? q.slice(0, 57) + '…' : q) }
    const placeId = params.get('place')
    if (!placeId) return
    api.place(placeId).then((p) => {
      setPlace(p)
      setTitle((t) => t || `Идём: ${p.name}?`)
      setQuestion((q) => q || 'Куда пойдём?')
    }).catch(() => setPlace(null))
  }, [params])

  function applyTemplate(id: string) {
    const t = TEMPLATES.find((x) => x.id === id)
    if (!t) return
    setTemplate(t.id); setTitle(t.title); setQuestion(t.question); setDescription(t.description); setMethod(t.method)
  }
  function next() {
    if (step === 0 && (!title.trim() || !question.trim())) { setError('Заполните название и основной вопрос.'); return }
    if (step === 2 && deadline && new Date(deadline) <= new Date()) { setError('Срок голосования должен быть в будущем.'); return }
    setError(''); setStep((v) => Math.min(3, v + 1))
  }
  async function create() {
    setBusy(true); setError('')
    try {
      const room = await api.createRoom({
        title, question, description, method, template, allow_suggestions: allowSuggestions, allow_comments: allowComments,
        hide_results: hideResults, deadline,
        options: place ? [{ title: place.name, description: place.summary, place_id: place.id }] : [],
      })
      navigate(`/rooms/${room.id}`, { state: { created: true } })
    } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось создать решение') } finally { setBusy(false) }
  }

  return <div className="page narrow">
    <Link to="/" className="back-link"><ArrowLeft size={15} />На главную</Link>
    <ol className="stepper" aria-label="Шаги создания">{steps.map((label, i) => <li key={label} className={i < step ? 'done' : i === step ? 'current' : ''} aria-current={i === step ? 'step' : undefined}><span>{i < step ? <Check size={13} /> : i + 1}</span>{label}</li>)}</ol>
    <section className="card wizard">
      {step === 0 && <>
        <h1>Какой вопрос нужно решить?</h1>
        <p className="lead">Начните с шаблона или сформулируйте сами. Всё можно изменить до начала голосования.</p>
        <div className="template-row" role="list">{TEMPLATES.map((t) => <button key={t.id} type="button" role="listitem" className={`template ${template === t.id ? 'selected' : ''}`} onClick={() => applyTemplate(t.id)}><b>{t.name}</b><small>{t.hint}</small></button>)}</div>
        {place && <div className="place-attach"><MapPin size={16} /><span>Первым вариантом будет <b>{place.name}</b></span><button className="icon-btn small" onClick={() => setPlace(null)} aria-label="Убрать место"><X size={14} /></button></div>}
        <div className="form">
          <label className="field"><span>Название решения</span><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например: Куда поедем летом?" maxLength={180} autoFocus /></label>
          <label className="field"><span>Основной вопрос</span><input className="input" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Например: Где провести отпуск в июле?" maxLength={500} /><small className="help">Хорошо работают вопросы, на которые можно ответить конкретным вариантом.</small></label>
          <label className="field"><span>Контекст <em>необязательно</em></span><textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Что участникам важно знать?" rows={3} maxLength={5000} /></label>
        </div>
      </>}
      {step === 1 && <>
        <h1>Как вы хотите договориться?</h1>
        <p className="lead">Правило будет видно всем участникам до голосования.</p>
        <div className="method-grid" role="radiogroup">{(Object.keys(METHODS) as Method[]).map((key) => <button type="button" role="radio" aria-checked={method === key} key={key} onClick={() => setMethod(key)} className={`method ${method === key ? 'selected' : ''}`}>
          <MethodGlyph method={key} /><b>{METHODS[key].name}</b><p>{METHODS[key].detail}</p><small>{METHODS[key].fit}</small>
        </button>)}</div>
      </>}
      {step === 2 && <>
        <h1>Что важно учесть?</h1>
        <p className="lead">Можно оставить настройки по умолчанию.</p>
        <div className="settings-list">
          <Toggle title="Участники предлагают варианты" detail="Организатор принимает или отклоняет предложения." checked={allowSuggestions} onChange={setAllowSuggestions} />
          <Toggle title="Комментарии к вариантам" detail="Обсуждение до начала голосования." checked={allowComments} onChange={setAllowComments} />
          <Toggle title="Скрыть голоса до завершения" detail="Чужой выбор не будет влиять на ваш." checked={hideResults} onChange={setHideResults} />
          <DeadlinePicker value={deadline} onChange={setDeadline} />
          <small className="help">Когда срок истечёт, голосование закроется само, а итог посчитается по поданным голосам. За час до срока не проголосовавшим придёт напоминание.</small>
        </div>
      </>}
      {step === 3 && <>
        <h1>Проверьте решение</h1>
        <p className="lead">После создания пригласите участников по ссылке или коду и добавьте варианты.</p>
        <dl className="review">
          <div><dt>Решение</dt><dd>{title}</dd></div>
          <div><dt>Вопрос</dt><dd>{question}</dd></div>
          <div><dt>Метод</dt><dd>{METHODS[method].name}<small>{METHODS[method].detail}</small></dd></div>
          <div><dt>Настройки</dt><dd>{[allowSuggestions ? 'Участники предлагают варианты' : 'Варианты добавляет только организатор', allowComments ? 'комментарии включены' : 'без комментариев', hideResults ? 'голоса скрыты до конца' : 'голоса видны'].join(', ')}</dd></div>
          {deadline && <div><dt>Срок</dt><dd>{formatDateTime(deadline)}</dd></div>}
          {place && <div><dt>Первый вариант</dt><dd>{place.name}</dd></div>}
        </dl>
      </>}
      <InlineFeedback error={error} />
      <div className="wizard-actions">
        <button type="button" className="btn" onClick={() => (step ? setStep(step - 1) : navigate('/'))}><ArrowLeft size={15} />Назад</button>
        {step < 3 ? <button type="button" className="btn primary" onClick={next}>Продолжить</button> : <button type="button" className="btn primary" onClick={() => void create()} disabled={busy}>{busy ? 'Создаём…' : 'Создать решение'}</button>}
      </div>
    </section>
  </div>
}

export function MethodGlyph({ method }: { method: Method }) {
  // Small diagrams of each rule: most dots, all dots, no crosses.
  return <svg className="method-glyph" viewBox="0 0 48 24" aria-hidden="true">
    {method === 'majority' && <>{[6, 16, 26].map((x) => <circle key={x} cx={x} cy={12} r={4} className="on" />)}<circle cx={38} cy={12} r={4} className="off" /></>}
    {method === 'unanimity' && [6, 16, 26, 38].map((x) => <circle key={x} cx={x} cy={12} r={4} className="on" />)}
    {method === 'objections' && <>{[6, 16, 26, 38].map((x) => <circle key={x} cx={x} cy={12} r={4} className="ring" />)}<path d="M22 4 L30 20" className="slash" /></>}
  </svg>
}

export function Toggle({ title, detail, checked, onChange }: { title: string; detail: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <div className="toggle-row"><div><b>{title}</b><small>{detail}</small></div><button type="button" role="switch" aria-checked={checked} aria-label={title} className={`switch ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)} /></div>
}
