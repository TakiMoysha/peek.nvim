import { hashCode, uniqueIdGen } from './util.js';
import highlight from 'highlight.js';
import MarkdownIt from 'markdown-it';
import { full as MarkdownItEmoji } from 'markdown-it-emoji';
import MarkdownItFootnote from 'markdown-it-footnote';
import MarkdownItTaskLists from 'markdown-it-task-lists';
import MarkdownItTexmath from 'markdown-it-texmath';
import Katex from 'katex';

// Simple argument parser for syntax highlighting
function parseSimpleArgs(args: string[]) {
  const result: Record<string, any> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      if (value !== undefined) {
        result[key] = value;
      } else if (args[i + 1] && !args[i + 1].startsWith('--')) {
        result[key] = args[i + 1];
        i++;
      } else {
        result[key] = true;
      }
    }
  }
  return result;
}

const __args = parseSimpleArgs(process.argv.slice(2));

const md = new MarkdownIt('default', {
  html: true,
  typographer: true,
  linkify: true,
  langPrefix: 'language-',
  highlight: __args['syntax'] && ((code, language) => {
    if (language && highlight.getLanguage(language)) {
      try {
        return highlight.highlight(code, { language }).value;
      } catch {
        return code;
      }
    }

    return '';
  }),
}).use(MarkdownItEmoji)
  .use(MarkdownItFootnote)
  .use(MarkdownItTaskLists, { enabled: false, label: true })
  .use(MarkdownItTexmath, {
    engine: Katex,
    delimiters: ['gitlab', 'dollars'],
    katexOptions: {
      macros: { '\\R': '\\mathbb{R}' },
      strict: false,
      throwOnError: false,
    },
  });

md.renderer.rules.link_open = (tokens, idx, options) => {
  const token = tokens[idx];
  const href = token.attrGet('href');

  if (href && href.startsWith('#')) {
    token.attrSet('onclick', `location.hash='${href}'`);
  }

  token.attrSet('href', 'javascript:return');

  return md.renderer.renderToken(tokens, idx, options);
};

md.renderer.rules.heading_open = (tokens, idx, options) => {
  tokens[idx].attrSet(
    'id',
    tokens[idx + 1].content
      .trim()
      .split(' ')
      .filter((a) => a)
      .join('-')
      .replace(/[^a-z0-9-]/gi, '')
      .toLowerCase(),
  );

  return md.renderer.renderToken(tokens, idx, options);
};

md.renderer.rules.math_block = (() => {
  const math_block = md.renderer.rules.math_block!;

  return (tokens, idx, options, env, self) => {
    return `
      <div
        data-line-begin="${tokens[idx].attrGet('data-line-begin')}"
      >
        ${math_block(tokens, idx, options, env, self)}
      </div>
    `;
  };
})();

md.renderer.rules.math_block_eqno = (() => {
  const math_block_eqno = md.renderer.rules.math_block_eqno!;

  return (tokens, idx, options, env, self) => {
    return `
      <div
        data-line-begin="${tokens[idx].attrGet('data-line-begin')}"
      >
        ${math_block_eqno(tokens, idx, options, env, self)}
      </div>
    `;
  };
})();

md.renderer.rules.fence = (() => {
  const fence = md.renderer.rules.fence!;
  const escapeHtml = md.utils.escapeHtml;
  const regex = new RegExp(
    /^(?<frontmatter>---[\s\S]+---)?\s*(?<content>(?<charttype>flowchart|sequenceDiagram|gantt|classDiagram|stateDiagram|pie|journey|C4Context|erDiagram|requirementDiagram|gitGraph)[\s\S]+)/,
  );

  return (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const content = token.content.trim();

    if (regex.test(content)) {
      const match = regex.exec(content);
      return `
        <div
          class="peek-mermaid-container"
          data-line-begin="${token.attrGet('data-line-begin')}"
        >
          <div
            id="graph-mermaid-${env.genId(hashCode(content))}"
            data-graph="mermaid"
            data-graph-definition="${escapeHtml(match?.groups?.content || '')}"
          >
            <div class="peek-loader"></div>
          </div>
        </div>
      `;
    }

    return fence(tokens, idx, options, env, self);
  };
})();

export function render(markdown: string) {
  const tokens = md.parse(markdown, {});

  tokens.forEach((token) => {
    if (token.map && token.level === 0) {
      token.attrSet('data-line-begin', String(token.map[0] + 1));
    }
  });

  return md.renderer.render(tokens, md.options, { genId: uniqueIdGen() });
}
