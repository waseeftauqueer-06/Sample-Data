import { AfterViewInit, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AnnouncementService } from './Services/announcement.service';
import { QuillModule } from 'ngx-quill';
import Quill from 'quill';
import QuillBetterTable from 'quill-better-table';

const FontStyle = Quill.import('attributors/style/font') as any;
const SizeStyle = Quill.import('attributors/style/size') as any;
const AlignStyle = Quill.import('attributors/style/align') as any;
const ColorStyle = Quill.import('attributors/style/color') as any;
const BackgroundStyle = Quill.import('attributors/style/background') as any;

FontStyle.whitelist = null;
SizeStyle.whitelist = null;

Quill.register(FontStyle, true);
Quill.register(SizeStyle, true);
Quill.register(AlignStyle, true);
Quill.register(ColorStyle, true);
Quill.register(BackgroundStyle, true);

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, QuillModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements AfterViewInit {
  mainTitle = '';
  postedDate = '';
  titleColor = '#dc2626';
  textColor = '#000000';
  textColorText = '#000000';
  bodyContent = '';
  private quillInstance?: Quill;

  touched = {
    mainTitle: false,
    postedDate: false,
    bodyContent: false
  };

  get titleError(): string {
    return this.touched.mainTitle && !this.mainTitle.trim()
      ? 'Title is required'
      : '';
  }

  get dateError(): string {
    return this.touched.postedDate && !this.postedDate.trim()
      ? 'Posted date is required'
      : '';
  }

  get bodyError(): string {
    return this.touched.bodyContent &&
      (!this.quillInstance || this.quillInstance.getText().trim().length === 0)
      ? 'Body content is required'
      : '';
  }

  onTitleBlur(): void {
    this.touched.mainTitle = true;
  }

  onDateBlur(): void {
    this.touched.postedDate = true;
  }

  onBodyBlur(): void {
    this.touched.bodyContent = true;
  }

  quillConfig = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }], // Retains Word Headings
      ['bold', 'italic', 'underline'],
      [{ 'color': [] }, { 'background': [] }], // Retains Word text/highlight colors
      [{ list: 'ordered' }, { list: 'bullet' }],
      [{ align: [] }],
      ['link'],
      ['clean']
    ],
    table: false,
    'better-table': {},
    keyboard: {
      bindings: QuillBetterTable.keyboardBindings
    },
    clipboard: {
      matchVisual: false
    }
  };

  quillCustomModules = [
    {
      path: 'modules/better-table',
      implementation: QuillBetterTable
    }
  ];

  quillFormats = [
    'header',
    'bold',
    'italic',
    'underline',
    'color',
    'background',
    'list',
    'align',
    'link',
    'font',
    'size',
    'table',
    'table-row',
    'table-body',
    'table-col',
    'table-col-group',
    'table-cell-line',
    'table-container',
    'table-view'
  ];

  previewHtml: SafeHtml = '';
  snippetHtml = '';

  toastMessage = '';
  toastVisible = false;

  constructor(
    private sanitizer: DomSanitizer,
    private announcementService: AnnouncementService
  ) {}

  ngAfterViewInit(): void {
    this.updateDerived();
  }

  onTextInput(): void {
    this.updateDerived();
  }

  onQuillContentChanged(value: string): void {
    this.bodyContent = value || '';
    this.updateDerived();
  }

  onEditorCreated(editor: Quill): void {
    this.quillInstance = editor;
    
    // REMOVED the clipboard.addMatcher block that was forcing plain text
  }

  onTextColorSwatchChange(value: string): void {
    this.textColor = value;
    this.textColorText = value;
    this.updateDerived();
  }

  onTextColorTextChange(value: string): void {
    this.textColorText = value;
    if (this.isValidHexColor(value)) {
      this.textColor = value;
      this.updateDerived();
    }
  }

  cancel(): void {
    this.showToast('Changes discarded.');
  }

  save(): void {
    this.touched.mainTitle = true;
    this.touched.postedDate = true;
    this.touched.bodyContent = true;

    const titleEmpty = !this.mainTitle.trim();
    const dateEmpty = !this.postedDate.trim();
    const bodyEmpty = !this.quillInstance || this.quillInstance.getText().trim().length === 0;

    if (titleEmpty || dateEmpty || bodyEmpty) {
      this.showToast('Please fill in all required fields');
      return;
    }

    const snippet = this.generateSnippet(
      this.mainTitle,
      this.postedDate,
      this.textColor,
      this.bodyContent
    );

    const payload = {
      title: this.mainTitle,
      htmlContent: snippet,
      createdAt: new Date().toISOString()
    };

    this.announcementService.saveAnnouncement(payload).subscribe({
      next: () => {
        this.showToast('Saved to database successfully');
      },
      error: (err) => {
        console.error(err);
        this.showToast('Failed to save');
      }
    });
  }

  clearAll(): void {
    this.mainTitle = '';
    this.postedDate = '';
    this.bodyContent = '';
    this.touched = { mainTitle: false, postedDate: false, bodyContent: false };
    this.updateDerived();
    this.showToast('Cleared all fields.');
  }

  copyCode(): void {
    navigator.clipboard.writeText(this.snippetHtml).then(
      () => this.showToast('Code copied to clipboard'),
      () => this.showToast('Failed to copy')
    );
  }

  downloadCode(): void {
    const blob = new Blob([this.snippetHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hinn-portal-snippet.html';
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('Download started');
  }

  private updateDerived(): void {
    const snippet = this.generateSnippet(
      this.mainTitle,
      this.postedDate,
      this.textColor,
      this.bodyContent
    );

    const fullDocument = this.wrapForIframe(snippet);
    this.snippetHtml = fullDocument;
    this.previewHtml = this.sanitizer.bypassSecurityTrustHtml(fullDocument);
  }

  private generateSnippet(
    title: string,
    postedDate: string,
    textColor: string,
    content: string
  ): string {
    const lines: string[] = [];
    lines.push(`<div class="hinn-portal-wrapper" style="color: ${textColor};">`);

    if (title.trim()) {
      lines.push(`  <h3 class="hinn-main-title" style="color: ${this.titleColor}; text-align: center;">`);
      lines.push(`    ${this.escapeHtml(title)}`);
      lines.push(`  </h3>`);
    }

    if (postedDate.trim()) {
      const formattedDate = this.formatPostedDate(postedDate);
      lines.push(
        `  <div class="hinn-posted-date" style="margin-top: 12px; font-size: 14px; opacity: 0.8; text-align: center; color: ${this.titleColor};">`
      );
      lines.push(`    (Posted ${formattedDate})`);
      lines.push(`  </div>`);
    }

    if (content.trim()) {
      const cleanedContent = this.convertQuillLists(content);
      const linkedContent = this.linkifyHtml(cleanedContent);
      lines.push(`  <style>${this.getQuillListStyles()}</style>`);
      lines.push(`  <div class="hinn-body-content" style="margin-top: 24px; line-height: 1.6;">`);
      lines.push(`    ${linkedContent}`);
      lines.push(`  </div>`);
    }

    lines.push(`</div>`);
    return lines.join('\n');
  }

  private convertQuillLists(html: string): string {
    return html;
  }

  private getQuillListStyles(): string {
    return `
      .hinn-body-content {
        counter-reset: list-0 list-1 list-2 list-3 list-4 list-5 list-6 list-7 list-8 list-9;
      }
      .hinn-body-content p,
      .hinn-body-content ol,
      .hinn-body-content pre,
      .hinn-body-content blockquote,
      .hinn-body-content h1,
      .hinn-body-content h2,
      .hinn-body-content h3,
      .hinn-body-content h4,
      .hinn-body-content h5,
      .hinn-body-content h6 {
        counter-reset: list-0 list-1 list-2 list-3 list-4 list-5 list-6 list-7 list-8 list-9;
      }
      .hinn-body-content ol { padding-left: 1.5em; }
      .hinn-body-content li { list-style-type: none; padding-left: 1.5em; position: relative; }
      .hinn-body-content li > .ql-ui:before {
        display: inline-block;
        margin-left: -1.5em;
        margin-right: .3em;
        text-align: right;
        white-space: nowrap;
        width: 1.2em;
      }
      .hinn-body-content li[data-list=bullet] > .ql-ui:before { content: '\\2022'; }
      .hinn-body-content li[data-list] { counter-reset: list-1 list-2 list-3 list-4 list-5 list-6 list-7 list-8 list-9; }
      .hinn-body-content li[data-list=ordered] { counter-increment: list-0; }
      .hinn-body-content li[data-list=ordered] > .ql-ui:before { content: counter(list-0, decimal) '. '; }

      .hinn-body-content li[data-list=ordered].ql-indent-1 { counter-increment: list-1; }
      .hinn-body-content li[data-list=ordered].ql-indent-1 > .ql-ui:before { content: counter(list-1, lower-alpha) '. '; }
      .hinn-body-content li[data-list].ql-indent-1 { counter-reset: list-2 list-3 list-4 list-5 list-6 list-7 list-8 list-9; }
      .hinn-body-content li[data-list=ordered].ql-indent-2 { counter-increment: list-2; }
      .hinn-body-content li[data-list=ordered].ql-indent-2 > .ql-ui:before { content: counter(list-2, lower-roman) '. '; }
      .hinn-body-content li[data-list].ql-indent-2 { counter-reset: list-3 list-4 list-5 list-6 list-7 list-8 list-9; }
      .hinn-body-content li[data-list=ordered].ql-indent-3 { counter-increment: list-3; }
      .hinn-body-content li[data-list=ordered].ql-indent-3 > .ql-ui:before { content: counter(list-3, decimal) '. '; }
      .hinn-body-content li[data-list].ql-indent-3 { counter-reset: list-4 list-5 list-6 list-7 list-8 list-9; }
      .hinn-body-content li[data-list=ordered].ql-indent-4 { counter-increment: list-4; }
      .hinn-body-content li[data-list=ordered].ql-indent-4 > .ql-ui:before { content: counter(list-4, lower-alpha) '. '; }
      .hinn-body-content li[data-list].ql-indent-4 { counter-reset: list-5 list-6 list-7 list-8 list-9; }
      .hinn-body-content li[data-list=ordered].ql-indent-5 { counter-increment: list-5; }
      .hinn-body-content li[data-list=ordered].ql-indent-5 > .ql-ui:before { content: counter(list-5, lower-roman) '. '; }
      .hinn-body-content li[data-list].ql-indent-5 { counter-reset: list-6 list-7 list-8 list-9; }
      .hinn-body-content li[data-list=ordered].ql-indent-6 { counter-increment: list-6; }
      .hinn-body-content li[data-list=ordered].ql-indent-6 > .ql-ui:before { content: counter(list-6, decimal) '. '; }
      .hinn-body-content li[data-list].ql-indent-6 { counter-reset: list-7 list-8 list-9; }
      .hinn-body-content li[data-list=ordered].ql-indent-7 { counter-increment: list-7; }
      .hinn-body-content li[data-list=ordered].ql-indent-7 > .ql-ui:before { content: counter(list-7, lower-alpha) '. '; }
      .hinn-body-content li[data-list].ql-indent-7 { counter-reset: list-8 list-9; }
      .hinn-body-content li[data-list=ordered].ql-indent-8 { counter-increment: list-8; }
      .hinn-body-content li[data-list=ordered].ql-indent-8 > .ql-ui:before { content: counter(list-8, lower-roman) '. '; }
      .hinn-body-content li[data-list].ql-indent-8 { counter-reset: list-9; }
      .hinn-body-content li[data-list=ordered].ql-indent-9 { counter-increment: list-9; }
      .hinn-body-content li[data-list=ordered].ql-indent-9 > .ql-ui:before { content: counter(list-9, decimal) '. '; }

      .hinn-body-content li.ql-indent-1:not(.ql-direction-rtl) { padding-left: 4.5em; }
      .hinn-body-content li.ql-indent-2:not(.ql-direction-rtl) { padding-left: 7.5em; }
      .hinn-body-content li.ql-indent-3:not(.ql-direction-rtl) { padding-left: 10.5em; }
      .hinn-body-content li.ql-indent-4:not(.ql-direction-rtl) { padding-left: 13.5em; }
      .hinn-body-content li.ql-indent-5:not(.ql-direction-rtl) { padding-left: 16.5em; }
      .hinn-body-content li.ql-indent-6:not(.ql-direction-rtl) { padding-left: 19.5em; }
      .hinn-body-content li.ql-indent-7:not(.ql-direction-rtl) { padding-left: 22.5em; }
      .hinn-body-content li.ql-indent-8:not(.ql-direction-rtl) { padding-left: 25.5em; }
      .hinn-body-content li.ql-indent-9:not(.ql-direction-rtl) { padding-left: 28.5em; }
    `;
  }

  private wrapForIframe(snippet: string): string {
    return `<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      margin: 0;
      padding: 40px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .hinn-main-title { margin: 0; font-size: 20px; font-weight: 600; }
    a { color: #0b5cbf; text-decoration: underline; }
    .ql-align-center { text-align: center; }
    .ql-align-right { text-align: right; }
    .ql-align-justify { text-align: justify; }
    .ql-align-left { text-align: left; }
    ul { list-style-type: disc; padding-left: 1.5em; margin: 0.5em 0; }
    ol { list-style-type: decimal; padding-left: 1.5em; margin: 0.5em 0; }
    table { width: 100%; border-collapse: collapse; margin: 0.75em 0; }
    td, th { border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: top; }
  </style>
</head>
<body>
  ${snippet}
</body>
</html>`;
  }

  private linkifyHtml(html: string): string {
    const tokens = html.split(/(<[^>]+>)/g);
    const urlRegex = /((https?:\/\/|www\.)[^\s<]+)/g;
    let inAnchor = false;

    return tokens
      .map((token) => {
        if (token.startsWith('<')) {
          if (/^<a\b/i.test(token)) {
            inAnchor = true;
          } else if (/^<\/a\b/i.test(token)) {
            inAnchor = false;
          }
          return token;
        }

        if (inAnchor) {
          return token;
        }

        return token.replace(urlRegex, (match) => {
          const href = match.startsWith('http') ? match : `https://${match}`;
          return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color: #0b5cbf; text-decoration: underline;">${match}</a>`;
        });
      })
      .join('');
  }

  private formatPostedDate(value: string): string {
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month} ${day}, ${year}`;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private showToast(message: string): void {
    this.toastMessage = message;
    this.toastVisible = true;
    window.setTimeout(() => {
      this.toastVisible = false;
    }, 3000);
  }

  private isValidHexColor(value: string): boolean {
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
  }

  private isResizing = false;

  startResize(event: MouseEvent): void {
    event.preventDefault();
    this.isResizing = true;

    const formCard = (event.target as HTMLElement).parentElement!;
    const startX = event.clientX;
    const startWidth = formCard.getBoundingClientRect().width;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!this.isResizing) return;
      const newWidth = startWidth + (moveEvent.clientX - startX);
      const clampedWidth = Math.max(280, Math.min(newWidth, 720));
      formCard.style.width = `${clampedWidth}px`;
    };

    const onMouseUp = () => {
      this.isResizing = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }
}
