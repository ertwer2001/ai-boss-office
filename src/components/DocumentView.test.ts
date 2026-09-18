import {createElement} from 'react';
import {it,expect} from 'vitest';import {renderToStaticMarkup} from 'react-dom/server';import {DocumentView} from './DocumentView';
it('報告以標題、粗體、步驟與表格閱讀',()=>{const html=renderToStaticMarkup(createElement(DocumentView,{text:'# 結果\n**已完成**\n1. 開啟成果\n2. 點選按鈕\n\n| 項目 | 狀態 |\n|---|---|\n| 功能 | 完成 |'}));expect(html).toContain('<h3>結果</h3>');expect(html).toContain('<strong>已完成</strong>');expect(html).toContain('<ol>');expect(html).toContain('<table>')});
it('報告內容不能執行 HTML 或腳本',()=>{const html=renderToStaticMarkup(createElement(DocumentView,{text:'<script>alert(1)</script>\n<img src=x onerror=alert(1)>'}));expect(html).not.toContain('<script>');expect(html).not.toContain('<img');expect(html).toContain('&lt;script&gt;')});
