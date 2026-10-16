from pathlib import Path
import base64
B=Path('/home/user/rebrand')
logo='<svg class="symbol" viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M4 33V8h30v25" stroke="currentColor" stroke-width="3"/><path d="M12 16h14" stroke="#C5A56C" stroke-width="3"/><path d="M19 16v11" stroke="currentColor" stroke-width="3"/></svg>'
s=(B/'concept.template.html').read_text().replace('{{LOGO}}',logo)
for key in ['hero','svc-shadow','svc-floating','svc-track','svc-lightlines','hero2']:
 raw=base64.b64encode((B/'assets'/f'{key}.webp').read_bytes()).decode()
 s=s.replace('{{'+key+'}}','data:image/webp;base64,'+raw)
assert '{{' not in s
(B/'POTOLKOVO-CONCEPT-V7.html').write_text(s)
(B/'assets/POTOLKOVO-logo-concept.svg').write_text('''<svg xmlns="http://www.w3.org/2000/svg" width="540" height="94" viewBox="0 0 540 94"><title>ПОТОЛКОВО — концепция знака и логотипа</title><g transform="translate(4 12) scale(1.7)" fill="none"><path d="M4 33V8h30v25" stroke="#173C36" stroke-width="3"/><path d="M12 16h14" stroke="#C5A56C" stroke-width="3"/><path d="M19 16v11" stroke="#173C36" stroke-width="3"/></g><text x="84" y="58" font-family="Arial,Helvetica,sans-serif" font-size="49" font-weight="800" letter-spacing="-2" fill="#173C36">ПОТОЛКОВО</text><text x="87" y="83" font-family="Arial,Helvetica,sans-serif" font-size="10" letter-spacing="3.1" fill="#173C36">ПОТОЛКИ · СВЕТ · МОНТАЖ</text></svg>''')
print('Self-contained concept ready',len(s))
