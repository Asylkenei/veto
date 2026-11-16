import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowUp, KeyRound } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { greeting } from '../../lib/format'
import { TEMPLATES } from './templates'
import type { Room } from './types'

/**
 * Hero: VETO's core moment — many opinions settling into one decision —
 * with the fastest path to start: type the question right here.
 */
export function Hero({ name, rooms, message }: { name: string; rooms: Room[] | null; message: string }) {
  const navigate = useNavigate()
  const [question, setQuestion] = useState('')
  function start(e: FormEvent) {
    e.preventDefault()
    navigate(question.trim() ? `/decisions/new?q=${encodeURIComponent(question.trim())}` : '/decisions/new')
  }
  const story = useMemo(() => {
    const done = rooms?.find((r) => r.status === 'COMPLETED' && r.rounds.at(-1)?.result?.winner)
    if (done) {
      const rnd = done.rounds.at(-1)!
      return { options: done.options.filter((o) => rnd.option_ids.includes(o.id)).slice(0, 4).map((o) => o.title), result: rnd.result!.winner!.title, caption: `Ваше решение «${done.title}»`, real: true }
    }
    return { options: ['Кино', 'Боулинг', 'Ужин', 'Квест'], result: 'Боулинг в субботу', caption: 'Так VETO сводит мнения в одно решение', real: false }
  }, [rooms])
  return <section className="hero">
    <div className="hero-copy">
      <p className="hero-greet">{greeting()}, {name}</p>
      <h1 className="hero-title">Что решаем<br />сегодня??</h1>
      <form className="hero-ask" onSubmit={start}>
        <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Например: куда пойдём в субботу?" aria-label="Вопрос для нового решения" maxLength={500} />
        <button className="hero-go" aria-label="Создать решение"><ArrowUp size={20} /></button>
      </form>
      <div className="hero-templates">{TEMPLATES.slice(0, 4).map((t) => <button key={t.id} onClick={() => navigate(`/decisions/new?q=${encodeURIComponent(t.question)}`)}>{t.name}</button>)}
        <Link to="/join" className="hero-code"><KeyRound size={14} />Есть код</Link></div>
      {message.trim() && <p className="hero-status">{message}</p>}
    </div>
    <div className="hero-visual" aria-hidden="true">
      <div className="hero-stage">
        {story.options.map((t, i) => <span key={t + i} className={`hero-chip hc-${i}`} style={{ '--d': `${i * 90}ms` } as React.CSSProperties}>{t}</span>)}
        <span className="hero-result"><i />{story.result}</span>
      </div>
      <p className="hero-caption">{story.caption}</p>
    </div>
  </section>
}
