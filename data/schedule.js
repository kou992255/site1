export const officialPdfUrl = '/assets/yabunishi-gomicalendar.pdf';
export const sourceReference = 'https://www.city.hirakata.osaka.jp/';

export const collectionAreas = {
  name: '枚方市 養父西町',
  note:
    '枚方市が公表している2024年度 資源・ごみ収集カレンダー（養父西町）を基に再構成しています。内容はアプリ内でも確認できます。',
};

export const scheduleRules = [
  {
    id: 'burnable',
    name: '燃やすごみ',
    type: 'weekly',
    weekdays: [2, 5],
    color: '#ff7043',
    description: '台所の生ごみ、紙くず、木くず、革製品など。指定袋を使用してください。',
  },
  {
    id: 'plastic',
    name: '容器包装プラスチック',
    type: 'weekly',
    weekdays: [3],
    color: '#26a69a',
    description: 'プラマークの付いた容器やトレイなどは、軽くすすいでから透明または半透明の袋で。',
  },
  {
    id: 'recyclables',
    name: 'びん・かん・ペットボトル',
    type: 'monthly',
    weekday: 3,
    ordinals: [2, 4],
    color: '#42a5f5',
    description: '飲料用のびん・かん・ペットボトル。キャップとラベルは外して洗浄してください。',
  },
  {
    id: 'paper',
    name: '古紙・布類',
    type: 'monthly',
    weekday: 3,
    ordinals: [1, 3],
    color: '#ab47bc',
    description: '新聞紙、雑誌、段ボール、衣類など。ひもで十字に縛ってまとめます。雨天時は次回に。',
  },
  {
    id: 'nonburnable',
    name: '不燃ごみ',
    type: 'monthly',
    weekday: 4,
    ordinals: [1],
    color: '#8d6e63',
    description: 'ガラス、陶器、金属製品など。45ℓ以下で一度に出せる量は2袋まで。',
  },
  {
    id: 'smallMetal',
    name: '小型金属・スプレー缶',
    type: 'monthly',
    weekday: 4,
    ordinals: [3],
    color: '#fdd835',
    description: '小型家電、金属小物、カセットボンベ。中身を使い切り、透明袋に入れてください。',
  },
];

export const weekdayNames = ['日', '月', '火', '水', '木', '金', '土'];
