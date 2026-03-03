export interface DomElement {
  tag: string
  text: string
  id?: string
  className?: string
  path: string
  attributes?: Record<string, string>
}

export function buildGetDomExpression(opts: { selector?: string }): string {
  return `${GET_DOM_SCRIPT}(${JSON.stringify({ selector: opts.selector })})`
}

export function buildCollectElementsExpression(opts: {
  selector?: string
}): string {
  return `${COLLECT_ELEMENTS_SCRIPT}(${JSON.stringify({ selector: opts.selector })})`
}

const GET_DOM_SCRIPT = `(function(o) {
var root = o.selector ? document.querySelector(o.selector) : document.documentElement;
if (!root) return '';
return root.outerHTML;
})`

const COLLECT_ELEMENTS_SCRIPT = `(function(o) {
var SKIP = {SCRIPT:1,STYLE:1,NOSCRIPT:1,SVG:1,TEMPLATE:1,HEAD:1};
var SEARCH_ATTRS = ['href','src','alt','title','aria-label','data-testid','name','value','placeholder','type','role','for','action'];
var root = o.selector ? document.querySelector(o.selector) : document.body;
if (!root) return [];

var results = [];
var max = 5000;

function cssPath(el) {
  var parts = [];
  var cur = el;
  while (cur && cur !== document.body && cur !== document.documentElement) {
    var tag = cur.tagName.toLowerCase();
    if (cur.id) { parts.unshift(tag + '#' + cur.id); break; }
    var cls = cur.className && typeof cur.className === 'string'
      ? '.' + cur.className.trim().split(/\\s+/).slice(0, 2).join('.')
      : '';
    parts.unshift(tag + cls);
    cur = cur.parentElement;
  }
  return parts.join(' > ');
}

function walk(el) {
  if (results.length >= max) return;
  if (el.nodeType !== 1) return;
  var tag = el.tagName;
  if (SKIP[tag]) return;

  var text = '';
  for (var i = 0; i < el.childNodes.length; i++) {
    if (el.childNodes[i].nodeType === 3)
      text += el.childNodes[i].textContent;
  }
  text = text.trim().substring(0, 200);

  var entry = {
    tag: tag.toLowerCase(),
    text: text,
    id: el.id || undefined,
    className: (typeof el.className === 'string' && el.className.trim()) || undefined,
    path: cssPath(el)
  };

  var attrs = {};
  var hasAttrs = false;
  for (var j = 0; j < SEARCH_ATTRS.length; j++) {
    var val = el.getAttribute(SEARCH_ATTRS[j]);
    if (val) { attrs[SEARCH_ATTRS[j]] = val.substring(0, 200); hasAttrs = true; }
  }
  if (hasAttrs) entry.attributes = attrs;

  if (text || entry.id || entry.className || hasAttrs) {
    results.push(entry);
  }

  for (var k = 0; k < el.children.length; k++) {
    walk(el.children[k]);
  }
}

walk(root);
return results;
})`
