/* ============ 名言库：随机显示在主页底部 ============ */
export const QUOTES = [
  { en: 'Success is the sum of small efforts, repeated day in and day out.', zh: '成功是日复一日重复的小努力的累积。', author: 'Robert Collier' },
  { en: 'The secret of getting ahead is getting started.', zh: '领先的秘诀就是开始行动。', author: 'Mark Twain' },
  { en: 'Do not watch the clock; do what it does. Keep going.', zh: '不要盯着时钟，要像它一样永不停歇地前行。', author: 'Sam Levenson' },
  { en: 'It does not matter how slowly you go as long as you do not stop.', zh: '只要不停下，走得再慢也没关系。', author: 'Confucius' },
  { en: 'Learning never exhausts the mind.', zh: '学习永远不会让头脑疲惫。', author: 'Leonardo da Vinci' },
  { en: 'The best way to predict the future is to create it.', zh: '预测未来最好的方式，就是去创造未来。', author: 'Peter Drucker' },
  { en: 'Believe you can and you are halfway there.', zh: '相信你自己能做到，你就已经成功了一半。', author: 'Theodore Roosevelt' },
  { en: 'Education is the most powerful weapon which you can use to change the world.', zh: '教育是改变世界最强大的武器。', author: 'Nelson Mandela' },
  { en: 'A journey of a thousand miles begins with a single step.', zh: '千里之行，始于足下。', author: 'Lao Tzu' },
  { en: 'The only way to do great work is to love what you do.', zh: '成就伟大事业的唯一途径，是热爱你所做的事。', author: 'Steve Jobs' },
  { en: 'Never give up, for that is just the place and time that the tide will turn.', zh: '永远不要放弃，因为潮水转向的时刻往往就在那里。', author: 'Harriet Beecher Stowe' },
  { en: 'Genius is one percent inspiration and ninety-nine percent perspiration.', zh: '天才是百分之一的灵感加上百分之九十九的汗水。', author: 'Thomas Edison' },
];

// 随机返回一条名言
export function randomQuote() {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)];
}
