const tr = (zh, en, ja) => ({ 'zh-CN': zh, en, ja });

function daySeed(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date) {
    throw new Error('Entertainment requires a valid issue date.');
  }
  let hash = 2166136261;
  for (const character of date) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return hash >>> 0;
}

function randomFrom(seed) {
  let state = seed || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function shuffle(values, random) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Count at most `limit` solutions. This also rejects invalid clue grids. */
export function countSudokuSolutions(input, limit = 2) {
  if (!Array.isArray(input) || input.length !== 9 || input.some(row => !Array.isArray(row) || row.length !== 9 || row.some(value => !Number.isInteger(value) || value < 0 || value > 9))) return 0;
  const grid = input.map(row => [...row]);
  const rows = Array(9).fill(0);
  const cols = Array(9).fill(0);
  const boxes = Array(9).fill(0);
  for (let row = 0; row < 9; row++) for (let col = 0; col < 9; col++) {
    const value = grid[row][col];
    if (!value) continue;
    const bit = 1 << value;
    const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
    if ((rows[row] | cols[col] | boxes[box]) & bit) return 0;
    rows[row] |= bit; cols[col] |= bit; boxes[box] |= bit;
  }
  let found = 0;
  function visit() {
    if (found >= limit) return;
    let chosen;
    let best = 10;
    for (let row = 0; row < 9; row++) for (let col = 0; col < 9; col++) {
      if (grid[row][col]) continue;
      const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
      const available = 0x3fe & ~(rows[row] | cols[col] | boxes[box]);
      let count = 0;
      for (let mask = available; mask; mask &= mask - 1) count++;
      if (count === 0) return;
      if (count < best) { chosen = { row, col, box, available }; best = count; }
    }
    if (!chosen) { found++; return; }
    const { row, col, box, available } = chosen;
    for (let value = 1; value <= 9 && found < limit; value++) {
      const bit = 1 << value;
      if (!(available & bit)) continue;
      grid[row][col] = value;
      rows[row] |= bit; cols[col] |= bit; boxes[box] |= bit;
      visit();
      rows[row] ^= bit; cols[col] ^= bit; boxes[box] ^= bit;
      grid[row][col] = 0;
    }
  }
  visit();
  return found;
}

function sudoku(seed) {
  const random = randomFrom(seed ^ 0x9e3779b9);
  const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], random);
  const ordered = () => shuffle([0, 1, 2], random).flatMap(group => shuffle([0, 1, 2], random).map(offset => 3 * group + offset));
  const rows = ordered();
  const cols = ordered();
  const solution = rows.map(row => cols.map(col => digits[(row * 3 + Math.floor(row / 3) + col) % 9]));
  const grid = solution.map(row => [...row]);
  let removed = 0;
  for (const index of shuffle(Array.from({ length: 81 }, (_, i) => i), random)) {
    if (removed >= 43) break;
    const row = Math.floor(index / 9);
    const col = index % 9;
    const value = grid[row][col];
    grid[row][col] = 0;
    if (countSudokuSolutions(grid) === 1) removed++;
    else grid[row][col] = value;
  }
  if (countSudokuSolutions(grid) !== 1) throw new Error('The local Sudoku could not be validated.');
  return { title: tr('每日数独', 'Daily Sudoku', '今日の数独'), grid, solution, difficulty: 'unrated' };
}

// Independently written miniature clues and jokes, bundled with this project.
// The English word-square answers are not presented as native-language crosswords.
const WORD_SQUARES = [
  { words: ['CAT', 'ARE', 'TEN'], across: [tr('会发出呼噜声的家养动物（英语，3字母）', 'A household animal that purrs (3)', 'のどを鳴らす身近な動物（英語3文字）'), tr('英语中与 we 搭配的 be 动词现在式（3字母）', 'Present-tense “be” after “we” (3)', 'we に続く be 動詞の現在形（英語3文字）'), tr('双手手指的通常总数（英语，3字母）', 'The usual number of fingers on two hands (3)', '両手の指の通常の合計（英語3文字）')], down: [tr('英文单词 kitten 的成年动物（3字母）', 'What a kitten grows into (3)', 'kitten が成長した動物（英語3文字）'), tr('补全英语句子：They ___ ready.（3字母）', 'Complete: They ___ ready. (3)', '英文を完成：They ___ ready.（3文字）'), tr('九之后的整数（英语，3字母）', 'The whole number after nine (3)', '9 の次の整数（英語3文字）')] },
  { words: ['SUN', 'USE', 'NET'], across: [tr('太阳系中心的恒星（英语，3字母）', 'The star at the center of our solar system (3)', '太陽系の中心にある恒星（英語3文字）'), tr('把一件工具派上用场（英语，3字母）', 'Put a tool to work (3)', '道具を役立てること（英語3文字）'), tr('网球场中间的网（英语，3字母）', 'The barrier across a tennis court (3)', 'テニスコートを二分する網（英語3文字）')], down: [tr('晴日白昼提供自然光的天体（英语，3字母）', 'Our natural source of daylight (3)', '昼の自然光をもたらす天体（英語3文字）'), tr('英语短语 “___ a pencil” 中的动词（3字母）', 'Verb in “___ a pencil” (3)', '“___ a pencil” に入る動詞（英語3文字）'), tr('捕鱼时使用的网（英语，3字母）', 'Mesh used to catch fish (3)', '魚を捕るための網（英語3文字）')] },
  { words: ['MAP', 'AGE', 'PET'], across: [tr('用符号表示道路和地点的图（英语，3字母）', 'A drawing that helps you locate roads and places (3)', '道や場所を記号で示す図（英語3文字）'), tr('生日过后通常会增加一的数值（英语，3字母）', 'A number that usually increases on a birthday (3)', '誕生日に通常一つ増える数（英語3文字）'), tr('作为家庭伙伴饲养的动物（英语，3字母）', 'An animal kept as a household companion (3)', '家庭の仲間として飼う動物（英語3文字）')], down: [tr('徒步旅行者用来辨路的图（英语，3字母）', 'A hiker’s diagram for finding the way (3)', 'ハイカーが道を探すために使う図（英語3文字）'), tr('衡量一个人已经活了多久（英语，3字母）', 'How long a person has lived (3)', '人が何年生きたかを示す言葉（英語3文字）'), tr('轻轻抚摸动物，作为英语动词（3字母）', 'Gently stroke an animal, as a verb (3)', '動物を優しくなでるという動詞（英語3文字）')] },
];

const RIDDLES = [
  { question: tr('我在报纸上旅行，却没有脚；到一栏底部就跳到另一栏顶部。读者正在移动什么？', 'I travel down a newspaper without feet, then jump to the top of the next column. What is the reader moving?', '足はないのに新聞の段を下り、次の段の上へ飛びます。読者が動かしているものは？'), answer: tr('视线。', 'Their gaze.', '視線。') },
  { question: tr('我没有记忆，却把下周的约定留在小方格里。有人添上一笔，我就少了一块空白。我是什么？', 'I have no memory, but keep next week’s appointments in little squares. Each new note leaves me less empty. What am I?', '記憶はないけれど、来週の予定を小さな四角に残します。書き込むほど空白が減る私は何？'), answer: tr('纸质行事历。', 'A paper calendar.', '紙のカレンダー。') },
  { question: tr('在我的方格里，拿走一个数字会增加工作，填回正确数字会减少工作。我是哪种报纸游戏？', 'In my squares, removing a number creates work; restoring the right number removes work. Which newspaper puzzle am I?', '私のマスから数字を消すと仕事が増え、正しい数字を戻すと仕事が減ります。どの新聞パズル？'), answer: tr('数独。', 'Sudoku.', '数独。') },
  { question: tr('我比正文小，却能告诉你正文从何而来；顺着我走，可能读到另一家报纸。我是什么？', 'I am smaller than the story, but tell you where it came from. Follow me and you may reach another newspaper. What am I?', '本文より小さいけれど、その出どころを教えます。たどると別の新聞に着くかもしれません。私は何？'), answer: tr('来源注释或引用。', 'A source note or citation.', '出典の注記や引用。') },
];

const JOKES = [
  tr('编辑：“我们需要一个短一点的会议。”排字员：“我可以把字号缩小。”', 'Editor: “We need a shorter meeting.” Typesetter: “I can make the font smaller.”', '編集者「会議をもっと短くしたいね。」組版担当「文字を小さくしましょうか。」'),
  tr('行事历：“我有一个空闲日。”铅笔：“小声点，安排会议的人还在旁边。”', 'Calendar: “I have a free day.” Pencil: “Keep your voice down. The meeting planner is nearby.”', 'カレンダー「空いている日があるよ。」鉛筆「小声で。会議を入れる人が近くにいるから。」'),
  tr('读者：“这份报纸没有电池。”报纸：“那你为什么一直让我刷新？”', 'Reader: “This newspaper has no battery.” Newspaper: “Then why do you keep asking me to refresh?”', '読者「この新聞には電池がないんだね。」新聞「じゃあ、どうして何度も更新を頼むの？」'),
  tr('研究员给待办事项加了一个任务：“整理待办事项。”清单看起来终于很有研究方向。', 'A researcher added “organize the to-do list” to the to-do list. At last, the list had a research direction.', '研究者がやることリストに「リストを整理する」を追加した。ついにリストにも研究方針ができた。'),
];

function crossword(seed) {
  const entry = WORD_SQUARES[seed % WORD_SQUARES.length];
  const solution = entry.words.map(word => [...word]);
  for (let col = 0; col < 3; col++) if (solution.map(row => row[col]).join('') !== entry.words[col]) throw new Error('Invalid local word square.');
  return {
    title: tr('迷你英语填字', 'Mini English word square', 'ミニ英単語クロスワード'),
    note: tr('本地原创提示；答案均为3个英文字母。中文和日文是提示译文。小题库会循环。', 'Original local clues; all answers are three English letters. Chinese and Japanese are clue translations. This small bank repeats.', 'ローカルのオリジナルヒント。答えはすべて英語3文字。中国語と日本語はヒントの翻訳です。小さな問題集を繰り返します。'),
    grid: solution.map(row => row.map(() => '')), solution,
    clues: {
      across: entry.across.map((clue, row) => ({ number: row === 0 ? 1 : row + 3, row, col: 0, clue: { ...clue } })),
      down: entry.down.map((clue, col) => ({ number: col + 1, row: 0, col, clue: { ...clue } })),
    },
  };
}

export function makeEntertainment(date, languages = ['zh-CN', 'en', 'ja']) {
  const seed = daySeed(date);
  const selectedLanguages = (Array.isArray(languages) ? languages : ['zh-CN', 'en', 'ja']).filter(language => ['zh-CN', 'en', 'ja'].includes(language));
  const riddle = RIDDLES[seed % RIDDLES.length];
  return {
    origin: 'local-original-v0.1', languages: [...new Set(selectedLanguages)],
    notice: tr('v0.1本地原创小题库；数独按日期生成并检验唯一解。谜语、笑话和迷你英语填字会循环，不含商业漫画。', 'v0.1 original local puzzle bank. Sudoku is date-seeded and checked for a unique solution. Riddles, jokes and mini English word squares repeat; no commercial cartoons are included.', 'v0.1 のローカルオリジナル問題集。数独は日付を基に生成し、唯一解を確認します。なぞなぞ、ジョーク、ミニ英単語問題は繰り返し掲載され、商業漫画は含みません。'),
    sudoku: sudoku(seed), crossword: crossword(seed),
    riddle: { question: { ...riddle.question }, answer: { ...riddle.answer } },
    joke: { text: { ...JOKES[(seed >>> 5) % JOKES.length] } },
  };
}
