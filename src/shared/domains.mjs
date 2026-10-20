const label = (zh, en, ja) => ({ 'zh-CN': zh, en, ja });
const branch = (id, zh, en, ja, topics) => ({ id, label: label(zh, en, ja), topics: topics.split(';').map(row => { const [cn, english, japanese] = row.split('|'); return { value: cn, label: label(cn, english || cn, japanese || cn) }; }) });
const domain = (id, zh, en, ja, branches) => ({ id, label: label(zh, en, ja), branches });

export const domains = [
  domain('digital','信息技术与数字产品','Technology & digital products','情報技術・デジタル製品',[
    branch('ai','人工智能','Artificial intelligence','人工知能','大语言模型|Large language models|大規模言語モデル;智能体与应用|Agents & applications|エージェントと応用;计算机视觉|Computer vision|コンピュータービジョン;模型评测|Model evaluation|モデル評価'),
    branch('software','软件与数据','Software & data','ソフトウェア・データ','软件工程|Software engineering|ソフトウェア工学;数据平台|Data platforms|データ基盤;云计算|Cloud computing|クラウド;开发工具|Developer tools|開発ツール'),
    branch('security','网络与信息安全','Cybersecurity','情報セキュリティ','数据安全|Data security|データ保護;软件供应链|Software supply chains|ソフトウェア供給網;身份与访问|Identity & access|認証とアクセス;安全运营|Security operations|セキュリティ運用'),
    branch('electronics','电子、通信与半导体','Electronics, telecom & chips','電子・通信・半導体','芯片设计|Chip design|半導体設計;制造工艺|Fabrication|製造プロセス;无线通信|Wireless communication|無線通信;边缘计算|Edge computing|エッジ計算')
  ]),
  domain('industry','工业、机器人与制造','Industry, robotics & manufacturing','産業・ロボット・製造',[
    branch('robotics','机器人与自主系统','Robotics & autonomous systems','ロボット・自律システム','SLAM与定位建图|SLAM & mapping|SLAM・位置推定;多传感器融合|Sensor fusion|センサー融合;具身智能|Embodied intelligence|身体性知能;工业部署|Industrial deployment|産業導入'),
    branch('equipment','工业装备与自动化','Equipment & automation','産業設備・自動化','运动控制|Motion control|動作制御;生产线自动化|Production automation|生産ライン自動化;预测维护|Predictive maintenance|予知保全;工业软件|Industrial software|産業ソフトウェア'),
    branch('materials','材料与制造工艺','Materials & processes','材料・製造技術','先进材料|Advanced materials|先端材料;增材制造|Additive manufacturing|積層造形;精密制造|Precision manufacturing|精密製造;质量检测|Quality inspection|品質検査'),
    branch('vehicles','汽车与移动装备','Vehicles & mobile equipment','自動車・移動機器','电动化|Electrification|電動化;智能驾驶|Automated driving|自動運転;整车制造|Vehicle manufacturing|車両製造;零部件供应链|Component supply chains|部品供給網')
  ]),
  domain('health','医疗健康与生命科学','Health & life sciences','医療・生命科学',[
    branch('medicine','临床与公共卫生','Clinical medicine & public health','臨床・公衆衛生','临床研究|Clinical research|臨床研究;诊疗指南更新|Clinical guidelines|診療指針;公共卫生|Public health|公衆衛生;医疗服务|Healthcare delivery|医療提供'),
    branch('pharma','药物与生物技术','Pharma & biotechnology','医薬・バイオ技術','药物研发|Drug discovery|創薬;临床试验|Clinical trials|臨床試験;生物制造|Biomanufacturing|バイオ生産;转化研究|Translational research|橋渡し研究'),
    branch('devices','医疗器械与诊断','Medical devices & diagnostics','医療機器・診断','医学影像|Medical imaging|医用画像;检验与诊断|Testing & diagnostics|検査・診断;器械研发|Device development|機器開発;数字健康|Digital health|デジタルヘルス'),
    branch('care','医疗管理与健康服务','Health management & care','医療経営・ケア','医院运营|Hospital operations|病院運営;支付与医保|Payment & insurance|医療保険・支払;养老与照护|Ageing & care|高齢者ケア;健康管理|Health management|健康管理')
  ]),
  domain('finance','金融与商业服务','Finance & business services','金融・ビジネスサービス',[
    branch('banking','银行与金融科技','Banking & fintech','銀行・フィンテック','信贷与支付|Credit & payments|融資・決済;金融基础设施|Financial infrastructure|金融基盤;金融科技|Fintech|フィンテック;风险管理|Risk management|リスク管理'),
    branch('investment','投资与资本市场','Investment & capital markets','投資・資本市場','企业融资|Corporate financing|企業金融;创业投资|Venture capital|ベンチャー投資;资产研究|Asset research|資産調査;市场结构|Market structure|市場構造'),
    branch('insurance','保险与精算','Insurance & actuarial science','保険・保険数理','保险产品|Insurance products|保険商品;风险定价|Risk pricing|リスク価格付け;保险科技|Insurtech|保険テック;长期风险|Long-term risks|長期リスク'),
    branch('services','会计、咨询与企业服务','Accounting, consulting & enterprise','会計・コンサルティング','企业经营|Business operations|企業経営;组织管理|Organization|組織管理;财务与审计|Finance & audit|財務・監査;跨境业务|Cross-border business|国際事業')
  ]),
  domain('law','法律、政策与公共事务','Law, policy & public affairs','法律・政策・公共分野',[
    branch('legal','法律服务','Legal services','法務','知识产权|Intellectual property|知的財産;公司与商业|Corporate & commercial|企業・商取引;劳动与用工|Employment law|労働・雇用;争议解决|Dispute resolution|紛争解決'),
    branch('policy','公共政策','Public policy','公共政策','产业政策|Industrial policy|産業政策;科技政策|Science & technology policy|科学技術政策;财政与公共服务|Fiscal & public services|財政・公共サービス;政策评估|Policy evaluation|政策評価'),
    branch('governance','公共治理','Governance','公共ガバナンス','城市治理|Urban governance|都市運営;公共采购|Public procurement|公共調達;数字政务|Digital government|電子政府;应急管理|Emergency management|危機管理'),
    branch('international','国际事务','International affairs','国際関係','国际组织|International institutions|国際機関;贸易与合作|Trade & cooperation|貿易・協力;区域研究|Regional studies|地域研究;地缘经济|Geoeconomics|地経学')
  ]),
  domain('energy','能源、资源与环境','Energy, resources & environment','エネルギー・資源・環境',[
    branch('power','电力与新能源','Power & clean energy','電力・新エネルギー','储能|Energy storage|蓄電;电网与调度|Grids & dispatch|電力網・需給運用;太阳能与风能|Solar & wind|太陽光・風力;能源系统|Energy systems|エネルギーシステム'),
    branch('resources','资源与矿业','Resources & mining','資源・鉱業','资源勘查|Resource exploration|資源探査;矿山技术|Mining technology|採鉱技術;关键矿产|Critical minerals|重要鉱物;资源供应链|Resource supply chains|資源供給網'),
    branch('environment','环境与气候','Environment & climate','環境・気候','污染治理|Pollution control|汚染対策;气候研究|Climate research|気候研究;环境监测|Environmental monitoring|環境監視;生态修复|Ecological restoration|生態系修復'),
    branch('utilities','公用事业','Utilities','公共インフラ','水务|Water services|水事業;城市能源|Urban energy|都市エネルギー;基础设施运维|Infrastructure maintenance|インフラ維持;资源循环|Circular resources|資源循環')
  ]),
  domain('built','建筑、土木与城市','Architecture, civil engineering & cities','建築・土木・都市',[
    branch('architecture','建筑与设计','Architecture & design','建築・設計','建筑设计|Architectural design|建築設計;建筑技术|Building technology|建築技術;空间体验|Spatial experience|空間体験;可持续建筑|Sustainable buildings|持続可能な建築'),
    branch('civil','土木与工程建设','Civil engineering & construction','土木・建設','结构与材料|Structures & materials|構造・材料;岩土工程|Geotechnical engineering|地盤工学;项目交付|Project delivery|事業実施;工程安全|Engineering safety|工事安全'),
    branch('cities','城市与规划','Cities & planning','都市・計画','城市更新|Urban renewal|都市再生;交通与空间|Transport & space|交通・空間;土地与住房|Land & housing|土地・住宅;城市数据|Urban data|都市データ'),
    branch('digital','建造数字化','Digital construction','建設のデジタル化','BIM|BIM|BIM;数字孪生|Digital twins|デジタルツイン;施工机器人|Construction robotics|建設ロボット;地下设施测绘|Underground mapping|地下施設計測')
  ]),
  domain('mobility','交通、物流与航空航天','Transport, logistics & aerospace','交通・物流・航空宇宙',[
    branch('transport','道路、铁路与交通系统','Road, rail & mobility systems','道路・鉄道・交通','交通运行|Traffic operations|交通運用;铁路技术|Rail technology|鉄道技術;自动驾驶运营|Autonomous operations|自動運転運用;出行服务|Mobility services|移動サービス'),
    branch('logistics','物流与供应链','Logistics & supply chains','物流・供給網','仓储自动化|Warehouse automation|倉庫自動化;港口与航运|Ports & shipping|港湾・海運;末端配送|Last-mile delivery|最終配送;供应链韧性|Supply-chain resilience|供給網の強靱性'),
    branch('aviation','航空与无人系统','Aviation & drones','航空・無人機','航空技术|Aviation technology|航空技術;无人机应用|Drone applications|無人機応用;空域与运营|Airspace & operations|空域・運航;航空制造|Aerospace manufacturing|航空機製造'),
    branch('space','航天与空间探索','Space & exploration','宇宙・探査','月球与行星探测|Lunar & planetary missions|月・惑星探査;卫星系统|Satellite systems|衛星システム;空间机器人|Space robotics|宇宙ロボット;空间基础设施|Space infrastructure|宇宙基盤')
  ]),
  domain('earth','地理空间与地球科学','Geospatial & earth science','地理空間・地球科学',[
    branch('geomatics','测绘与地理信息','Geomatics & GIS','測量・地理情報','定位与导航|Positioning & navigation|測位・航法;摄影测量|Photogrammetry|写真測量;地理信息系统|GIS|地理情報システム;三维地图|3D mapping|三次元地図'),
    branch('remote','遥感与地球观测','Remote sensing & observation','リモートセンシング・地球観測','激光雷达|LiDAR|LiDAR;光学与雷达遥感|Optical & radar sensing|光学・レーダー観測;变化检测|Change detection|変化検出;地球观测应用|Earth observation applications|地球観測応用'),
    branch('geoscience','地球与环境过程','Earth & environmental processes','地球・環境プロセス','地质与地球物理|Geology & geophysics|地質・地球物理;水文|Hydrology|水文学;地表过程|Surface processes|地表プロセス;自然灾害|Natural hazards|自然災害'),
    branch('ocean','海洋与大气','Ocean & atmosphere','海洋・大気','海洋观测|Ocean observation|海洋観測;海洋工程|Ocean engineering|海洋工学;气象与大气|Weather & atmosphere|気象・大気;气候系统|Climate systems|気候システム')
  ]),
  domain('agriculture','农业、食品与生物资源','Agriculture, food & bioresources','農業・食品・生物資源',[
    branch('farming','种植与农业系统','Farming & agricultural systems','栽培・農業システム','精准农业|Precision agriculture|精密農業;作物与育种|Crops & breeding|作物・育種;农机与机器人|Machinery & robots|農業機械・ロボット;农业经营|Farm management|農業経営'),
    branch('livestock','养殖与水产','Livestock & aquaculture','畜産・水産養殖','动物健康|Animal health|動物衛生;智能养殖|Smart livestock systems|スマート畜産;水产系统|Aquaculture systems|養殖システム;饲料与营养|Feed & nutrition|飼料・栄養'),
    branch('food','食品与供应链','Food & supply chains','食品・供給網','食品研发|Food R&D|食品研究開発;食品安全|Food safety|食品安全;加工工艺|Food processing|加工技術;冷链与流通|Cold chains & distribution|低温物流・流通'),
    branch('forestry','林业与生物资源','Forestry & bioresources','林業・生物資源','森林监测|Forest monitoring|森林監視;生物多样性|Biodiversity|生物多様性;林业经营|Forest management|森林経営;生物资源利用|Bioresource use|生物資源利用')
  ]),
  domain('consumer','消费、零售与服务','Consumer, retail & services','消費・小売・サービス',[
    branch('retail','零售与电商','Retail & commerce','小売・電子商取引','渠道与平台|Channels & platforms|販売経路・プラットフォーム;品牌经营|Brand operations|ブランド経営;消费者研究|Consumer research|消費者研究;零售运营|Retail operations|小売運営'),
    branch('goods','消费品与产品','Consumer goods & products','消費財・製品','产品创新|Product innovation|製品革新;消费趋势|Consumer trends|消費動向;设计与供应链|Design & supply chains|設計・供給網;品牌增长|Brand growth|ブランド成長'),
    branch('hospitality','餐饮、酒店与旅游','Hospitality & travel','飲食・宿泊・観光','旅游与目的地|Travel & destinations|観光地・旅行;酒店运营|Hotel operations|ホテル運営;餐饮经营|Food-service operations|飲食経営;客户体验|Customer experience|顧客体験'),
    branch('business','服务与创业','Services & entrepreneurship','サービス・起業','商业模式|Business models|事業モデル;中小企业经营|Small business|中小企業経営;客户服务|Customer service|顧客サービス;创业生态|Startup ecosystems|起業エコシステム')
  ]),
  domain('education','教育、社会科学与人文','Education, society & humanities','教育・社会科学・人文',[
    branch('learning','教育与学习','Education & learning','教育・学習','学校教育|School education|学校教育;高等教育|Higher education|高等教育;职业培训|Vocational training|職業訓練;教育技术|Education technology|教育技術'),
    branch('society','社会与行为','Society & behaviour','社会・行動','社会研究|Social research|社会研究;心理与行为|Psychology & behaviour|心理・行動;人口与劳动|Population & labour|人口・労働;社会政策|Social policy|社会政策'),
    branch('economics','经济与发展','Economics & development','経済・開発','产业经济|Industrial economics|産業経済;区域发展|Regional development|地域開発;劳动与教育经济|Labour & education economics|労働・教育経済;经济数据|Economic data|経済データ'),
    branch('humanities','人文与历史','Humanities & history','人文・歴史','历史与档案|History & archives|歴史・史料;语言与文化|Language & culture|言語・文化;哲学与思想|Philosophy & thought|哲学・思想;数字人文|Digital humanities|デジタル人文学')
  ]),
  domain('creative','传媒、文化与设计','Media, culture & design','メディア・文化・デザイン',[
    branch('media','新闻与出版','News & publishing','報道・出版','专业新闻|Professional journalism|専門報道;出版与阅读|Publishing & reading|出版・読書;内容分发|Content distribution|コンテンツ配信;媒体经营|Media business|メディア経営'),
    branch('film','影视、音乐与文化','Film, music & culture','映像・音楽・文化','影视制作|Film production|映像制作;音乐产业|Music industry|音楽産業;文化机构|Cultural institutions|文化機関;数字版权|Digital rights|デジタル著作権'),
    branch('games','游戏与互动内容','Games & interactive media','ゲーム・対話型コンテンツ','游戏开发|Game development|ゲーム開発;交互技术|Interactive technology|インタラクション技術;数字资产|Digital assets|デジタルアセット;发行与运营|Publishing & operations|配信・運営'),
    branch('design','设计与创意','Design & creativity','デザイン・創作','视觉与品牌|Visual & brand design|視覚・ブランド;工业设计|Industrial design|工業デザイン;用户体验|User experience|ユーザー体験;创意工具|Creative tools|創作ツール')
  ]),
  domain('science','数学、物理与基础科学','Maths, physics & basic science','数学・物理・基礎科学',[
    branch('math','数学与统计','Mathematics & statistics','数学・統計','应用数学|Applied mathematics|応用数学;统计方法|Statistical methods|統計手法;优化|Optimization|最適化;计算方法|Computational methods|計算法'),
    branch('physics','物理与天文学','Physics & astronomy','物理・天文学','凝聚态与材料物理|Condensed matter|物性物理;量子科学|Quantum science|量子科学;天文学|Astronomy|天文学;仪器与实验|Instruments & experiments|装置・実験'),
    branch('chemistry','化学与化学工程','Chemistry & chemical engineering','化学・化学工学','合成与催化|Synthesis & catalysis|合成・触媒;分析方法|Analytical methods|分析法;化学材料|Chemical materials|化学材料;过程工程|Process engineering|プロセス工学'),
    branch('computation','科学计算与交叉方法','Scientific computing & methods','科学計算・学際的手法','数值计算|Numerical computing|数値計算;建模与仿真|Modelling & simulation|モデル化・シミュレーション;科学数据|Scientific data|科学データ;计算实验|Computational experiments|計算実験')
  ])
];

export const lenses = [
  ['research','研究进展','Research','研究'],['engineering','工程实践','Engineering','技術実践'],['management','管理与运营','Management','経営・運用'],['product','产品与用户','Products & users','製品・ユーザー'],['investment','投资与产业','Investment & industry','投資・産業'],['policy','政策与规范','Policy & standards','政策・規格'],['learning','学习与入门','Learning','学習']
].map(([id,zh,en,ja]) => ({ id, label:label(zh,en,ja) }));

export const depths = [
  ['速览','Brief','速読'],['行业简报','Industry briefing','業界概観'],['专业阅读','Professional','専門読書'],['深入分析','In-depth','詳細分析'],['专家视角','Expert','専門家向け']
].map(([zh,en,ja],i) => ({ value:i+1,label:label(zh,en,ja) }));

export function localLabel(map,language='zh-CN') { return map?.[language] || map?.en || map?.['zh-CN'] || ''; }
export function describeTrack(track,language='zh-CN') {
  const d=domains.find(item=>item.id===track.domain), b=d?.branches.find(item=>item.id===track.branch);
  return [localLabel(d?.label,language),localLabel(b?.label,language),...(track.topics||[]).map(value=>localLabel(b?.topics.find(item=>item.value===value)?.label,language)||value),track.custom].filter(Boolean).join(' / ');
}
