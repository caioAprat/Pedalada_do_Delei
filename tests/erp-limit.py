"""Run with Python Playwright installed and the app served on port 8000."""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(reduced_motion='reduce')
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://127.0.0.1:8000/', wait_until='domcontentloaded')
    results = page.evaluate('''() => {
      produtoAtual = {cod:'TESTE', nome:'Teste'};
      historicoGlobal = [];
      const doc = (n, tam, saldo=null) => ({numeroDoc:n,tamanhoOriginal:tam,ativo:true,saldoMin:saldo});
      const check = (ok, message) => { if (!ok) throw Error(message); };
      docsDisponiveis = [doc('1', 1)];
      let pl = planejar(100, 80);
      check(pl.passos[0].pctNum === 999.99, 'cap at 999.99');
      check(pl.mov === 9.9999 && pl.rest === 10.0001, 'uncovered remainder');
      docsDisponiveis.push(doc('2', 2));
      pl = planejar(100,80);
      check(pl.rest === 0 && pl.passos.length === 2, 'spread across REQs');
      check(pl.passos.every(p=>p.pctNum<=999.99), 'all steps within limit');
      docsDisponiveis = [doc('1', 1, 3)];
      check(planejar(100,80).mov === 3, 'stock limit still respected');
      check(planejar(100,101).passos[0].pctNum === 95, 'reversal margin preserved');
      for (const tam of [.0001,.001,.1,.3333,1,10,1234.5678]) {
        docsDisponiveis = [doc('1',tam)];
        const plan = planejar(100000,0);
        check(plan.passos.every(p=>p.pctNum<=999.99 && p.erpQtd<=maxQtdErp(tam)+.0001), 'decimal boundary '+tam);
      }
      let rejected = false;
      try { montarPasso('1', 1, 10); } catch(e) { rejected = e instanceof RangeError; }
      check(rejected, 'invalid step rejected');
      $('calcTam').value='1'; $('calcQtd').value='10';calcPct();
      check($('calcCopiar').disabled && !calcValor, 'calculator blocks 1000%');
      $('calcQtd').value='9,9999';calcPct();
      check(!$('calcCopiar').disabled && calcValor==='999,9900', 'calculator accepts limit');
      sol = {idx:0, passos:[{numeroDoc:'1',pctStr:'1000,0000'}]};
      acaoCopiar('pct',true);
      check($('toast').textContent.includes('999,99'), 'old session copy blocked');
      sol = null;
      return 'Regression scenarios passed (including undo)';
    }''')
    page.evaluate('''async () => {
      historicoGlobal = [{id:'undo-test', produto:'TESTE', nome:'Teste', op:'estorno', atual:100,
        passos:[{numeroDoc:'1', tam:1, q:.95, pctStr:'95,0000', copiado:true}]}];
      dialogo = async () => true;
      await desfazerAjuste('undo-test');
      if (!sol || sol.passos[0].pctNum > 999.99 || sol.rest <= 0) throw Error('undo limit');
      limparGeral();
    }''')
    for width in [390,768,1440]:
        page.set_viewport_size({'width':width,'height':1000})
        for theme in ['escuro','claro']:
            page.evaluate('(theme)=>setAparencia("tema",theme)',theme)
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (width,theme)
            page.screenshot(path=f'/tmp/pedalada-{width}-{theme}.png',full_page=True)
    assert not errors, errors
    print(results, '; desktop/mobile, light/dark: no overflow or JS errors')
    browser.close()
