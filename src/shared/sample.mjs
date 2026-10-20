const tr = (zh, en, ja) => ({ 'zh-CN': zh, en, ja });
const editionText = {
  en: [
    { title: 'Evidence before the headline', summary: 'A professional paper should make the conditions behind a claim as clear as the claim itself.', body: ['A useful daily paper begins with a question its reader needs to answer. An engineer may be following the conditions under which a new method works. A founder may want to understand a change in a supply chain. The same headline can mean different things to these readers.', 'Reporting should return to the original material. A benchmark needs its test conditions. An announcement needs a date and a clearly identified speaker. A comparison needs a fair baseline. Without these details, an impressive result is difficult to interpret.', 'Different accounts of an event should be compared before a conclusion is written. Several reports can trace back to one announcement. Repetition makes a claim more visible; it does not provide independent confirmation.', 'The printed edition provides a stopping point. A reader can finish the issue, mark a passage, complete a puzzle and put it down. Tomorrow’s edition should explain what has changed.'], implications: 'Choose sources for the questions you need to answer, and preserve their dates and limits.', uncertainties: 'This is an original design essay, not a report about a current event.' },
    { title: 'A better battery is only the start of the question', summary: 'Hypothetical topic: how a change in battery performance could affect an underground drone mission.', body: ['Suppose a battery design offers higher specific energy. The next question is whether the gain remains at the pack level, including its housing, cooling and safety equipment.', 'A flight team would also need temperature and discharge conditions, payload measurements and flight validation. Only then could it assess whether the aircraft can carry another instrument or remain airborne longer.', 'Mission strategy depends on more than endurance. Navigation, communications, recovery options and the quality of the observations can still limit what a longer flight achieves.'], implications: 'Keep a chain from the material claim to the vehicle test and the operational decision.', uncertainties: 'All progress described here is hypothetical. No battery breakthrough or field result is asserted.' },
  ],
  'zh-CN': [
    { title: '让证据走在标题前面', summary: '一份专业的个人报纸，应当让读者看清一项判断的依据、适用条件，以及仍然没有答案的部分。', body: ['一份有用的日报，从读者真正想回答的问题出发。工程师关心新方法在什么条件下有效，企业经营者关心供应链变化会影响哪一环。相同的标题，对不同读者有不同的分量。', '报道需要回到原始材料。实验结果要交代测试条件，机构公告要说明时间与发布主体，性能比较要给出合理基线。缺少这些内容，再醒目的数字也很难用于判断。', '下结论之前，还应比较不同来源的说法。你可能看到三篇报道来自同一份新闻稿。重复会让一条消息更常见，却不能自动增加独立证据。', '纸张为阅读提供一个停下来的时刻。读者可以读完这一期，标记一段文字，完成一个谜题，然后合上报纸。下一期再解释新的变化。'], implications: '围绕真正需要回答的问题选择来源，并保留资料的时间与边界。', uncertainties: '这是原创编辑理念样文，不是对最新事件的报道。' },
    { title: '电池更好之后，还要追问什么', summary: '假设选题：电池性能的变化，如何影响地下无人机任务。', body: ['假设一种电池设计提高了比能量，下一步要问的是：计入外壳、散热与安全设备之后，优势是否仍在电池包层面成立？', '飞行团队还需要温度与放电条件、载荷测量和实际飞行验证，才能判断能否多带一种传感器，或多飞一段时间。', '任务策略并不只由航时决定。定位、通信、回收方式和观测质量，仍可能限制更长飞行带来的价值。'], implications: '把材料层面的说法、整机测试与任务决策连接起来，逐层核对。', uncertainties: '以上进展均为假设，不代表已经发生的电池突破或现场验证结果。' },
  ],
  ja: [
    { title: '見出しより先に、根拠を', summary: '専門家のための新聞は、主張だけでなく、その条件と限界も伝えるべきです。', body: ['役に立つ日刊紙は、読者が答えを求めている問いから始まります。技術者は新しい手法が機能する条件を、経営者は供給網の変化を知りたいかもしれません。同じ見出しでも、意味は異なります。', '報道は原資料に立ち返る必要があります。実験には試験条件を、発表には日付と発表者を、比較には妥当な基準を示します。条件がなければ、目立つ数字を判断に使うことは困難です。', '結論を出す前に、複数の説明を比べます。三つの記事が一つの発表に基づいていることもあります。繰り返しは認知を広げますが、独立した証拠を増やすわけではありません。', '紙の一号には、読み終える地点があります。気になる箇所に印を付け、パズルを解き、新聞を閉じることができます。次の号では、その後の変化を説明します。'], implications: '必要な問いに合わせて資料を選び、日付と適用範囲を残します。', uncertainties: 'これは編集方針を示すオリジナルの例文であり、最新ニュースではありません。' },
    { title: '電池の改善から、次の問いへ', summary: '仮のテーマ：電池性能の変化は、地下のドローン任務にどう影響するでしょうか。', body: ['ある電池の比エネルギーが向上したと仮定します。筐体、冷却、安全装置を含めた電池パックでも、その利点が残るかを確かめる必要があります。', '温度と放電条件、搭載重量、飛行試験の結果がそろって初めて、センサーを増やせるか、飛行時間を延ばせるかを評価できます。', '任務の方針は航続時間だけでは決まりません。測位、通信、回収手段、観測の質が、長い飛行の価値を制約することもあります。'], implications: '材料の主張から機体試験、運用上の判断まで、条件を一段ずつ確かめます。', uncertainties: 'ここで述べた進展は仮定です。実際の技術突破や現場試験の結果を示すものではありません。' },
  ],
};

const puzzle = ['530070000','600195000','098000060','800060003','400803001','700020006','060000280','000419005','000080079'].map((row) => [...row].map(Number));
const solution = ['534678912','672195348','198342567','859761423','426853791','713924856','961537284','287419635','345286179'].map((row) => [...row].map(Number));
const cat = tr('会呼噜的小动物（英文，3 字母）', 'A small animal that purrs (3)', '喉を鳴らす小さな動物（英語、3文字）');
const are = tr('be 的复数现在式（英文，3 字母）', 'Plural present form of be (3)', 'be の複数現在形（英語、3文字）');
const ten = tr('九之后的数（英文，3 字母）', 'The number after nine (3)', '九の次の数（英語、3文字）');

export function getSampleIssue(reading = {}) {
  const languageA = editionText[reading.languageA] ? reading.languageA : 'en';
  const languageB = editionText[reading.languageB] && reading.languageB !== languageA ? reading.languageB : (languageA === 'zh-CN' ? 'en' : 'zh-CN');
  const issue = {
    id: 'sample', date: '2026-10-20', title: 'The Personal Press', createdAt: '2026-10-20T00:00:00.000Z', cutoffAt: '2026-10-20T00:00:00.000Z', timeZone: 'Asia/Shanghai',
    languageA, languageB, ratio: Number.isFinite(Number(reading.ratio)) ? Number(reading.ratio) : 70, status: 'sample', sample: true,
    articles: editionText[languageA].map((a, index) => { const b = editionText[languageB][index]; return { id: `sample-${index + 1}`, section: index ? 'HYPOTHETICAL TOPIC' : 'EDITORIAL SAMPLE', titleA: a.title, titleB: b.title, summaryA: a.summary, summaryB: b.summary, bodyA: a.body, bodyB: b.body, implicationsA: a.implications, implicationsB: b.implications, uncertaintiesA: a.uncertainties, uncertaintiesB: b.uncertainties, sourceIds: [], review: { status: 'sample', notes: [] } }; }),
    sources: [], review: { status: 'sample', notes: [], model: '' }, model: { provider: 'offline-sample', name: 'original text' },
    entertainment: {
      origin: 'local-original-sample', notice: tr('原创娱乐样例 · 答案可单独展开', 'Original sample diversions · answers open separately', 'オリジナルの例題 · 答えは個別に開けます'),
      sudoku: { grid: puzzle, solution, difficulty: 'easy', title: tr('每日数独', 'Daily Sudoku', '今日の数独') },
      crossword: { grid: [['','',''],['','',''],['','','']], solution: [['C','A','T'],['A','R','E'],['T','E','N']], title: tr('英文单词方阵', 'English word square', '英単語のワードスクエア'), note: tr('三个横向答案与三个纵向答案相同；各语言共用英文谜底。', 'The three rows and three columns contain the same words. Answers are English in every edition.', '横と縦に同じ三つの単語が並びます。どの言語でも答えは英単語です。'), clues: { across: [{ number: 1, row: 0, col: 0, clue: cat }, { number: 4, row: 1, col: 0, clue: are }, { number: 5, row: 2, col: 0, clue: ten }], down: [{ number: 1, row: 0, col: 0, clue: cat }, { number: 2, row: 0, col: 1, clue: are }, { number: 3, row: 0, col: 2, clue: ten }] } },
      riddle: { question: tr('我把整座城市折进口袋，却没搬走一栋楼。我是什么？', 'I fold a city into your pocket without moving a building. What am I?', '建物を動かさず、街を折りたたんでポケットに入れます。何でしょう？'), answer: tr('纸地图。', 'A paper map.', '紙の地図です。') },
      joke: { text: tr('纪要压成一页，讨论字号又开了半小时会。', 'The minutes fit on one page. Choosing the font took another meeting.', '議事録は一枚に収まりました。文字の大きさを決めるため、もう一度会議を開きました。') },
    },
    calendar: [{ id: 'sample-event', date: '2026-10-20', time: '09:00', title: localizedEvent(languageA) }],
  };
  return JSON.parse(JSON.stringify(issue));
}

function localizedEvent(lang) { return ({ en: 'Reading hour · sample appointment', 'zh-CN': '专业阅读 · 示例日程', ja: '読書の時間 · 予定の例' })[lang]; }
export const sampleIssue = getSampleIssue();
