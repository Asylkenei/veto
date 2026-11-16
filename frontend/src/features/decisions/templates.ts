import type { Method } from './types'

export interface Template { id: string; name: string; title: string; question: string; description: string; method: Method; hint: string }
/** Templates reuse the generic constructor — they only pre-fill fields that stay editable. */
export const TEMPLATES: Template[] = [
  { id: 'movie', name: 'Фильм на вечер', title: 'Кино в пятницу', question: 'Какой фильм посмотрим?', description: 'Добавьте по одному-два фильма. Против явных «нет» лучше работает метод без возражений.', method: 'objections', hint: 'Без возражений' },
  { id: 'restaurant', name: 'Куда пойти поесть', title: 'Ужин вместе', question: 'В какое место идём?', description: 'Учтите бюджет и дорогу для всех.', method: 'majority', hint: 'Большинство' },
  { id: 'boardgame', name: 'Настольная игра', title: 'Игровой вечер', question: 'Во что играем?', description: 'Укажите, сколько длится партия и на сколько игроков.', method: 'majority', hint: 'Большинство' },
  { id: 'trip', name: 'Поездка', title: 'Поездка на выходные', question: 'Куда поедем?', description: 'Важно, чтобы ехать хотели все.', method: 'unanimity', hint: 'Единогласие' },
  { id: 'team', name: 'Рабочее решение', title: 'Решение команды', question: 'Какой вариант выбираем?', description: 'Опишите контекст и критерии выбора.', method: 'objections', hint: 'Без возражений' },
  { id: 'gift', name: 'Общий подарок', title: 'Подарок', question: 'Что дарим?', description: 'Укажите ориентир по цене.', method: 'majority', hint: 'Большинство' },
]
