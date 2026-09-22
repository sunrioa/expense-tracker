import React from 'react';
import ReactDOM from 'react-dom/client';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import isoWeek from 'dayjs/plugin/isoWeek';
import weekday from 'dayjs/plugin/weekday';
import customParseFormat from 'dayjs/plugin/customParseFormat';

import 'antd/dist/reset.css';
import './styles.css';
import App from './App';
import ThemeProvider from './theme/ThemeProvider';

dayjs.extend(weekOfYear);
dayjs.extend(isoWeek);
dayjs.extend(weekday);
dayjs.extend(customParseFormat);
dayjs.locale('zh-cn');

// 原来是 createRoot(document.getElementById('root')) —— 这个元素缺失时
// React 会抛一条不知所云的错。strict 模式逼着处理 null，顺手给条人能看懂的消息。
const container = document.getElementById('root');
if (!container) {
  throw new Error('找不到挂载节点 #root，请检查 index.html');
}

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
